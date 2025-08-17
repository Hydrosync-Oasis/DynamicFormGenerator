/**

目前的表单完成情况：
/**
 * 按你的三点想法的极简原型：
 * 1) 内部对象：存字段键、值、以及"是否显示"visible；用 immer 做 set/get。
 * 2) 值支持：标量值 + 单选（Radio）。(多选可用数组扩展，示例先不做)
 * 3) 多步骤：用二维数组 stepsLayout 来指示每个步骤的字段集合，数据共享一个 store。
 * 4) 动态生成：用 registerRule(deps, fn) 注册"像 useEffect 的函数"。当依赖字段变化时，触发 fn 控制其他字段的 visible。
 */

// ----------------------------- 内部模型层 -----------------------------
import Schema, { RuleItem, ValidateError, Values } from "async-validator";
import { ComponentType } from "react";

type FieldKey = string;

type FieldPath = FieldKey[];
type FieldValue = any; // 可扩展为数组等

type ControlType = "input" | "radio"
  | ComponentType<{ value: FieldValue, onChange: (value: FieldValue) => void }>; // 自定义渲染表单组件，用户也可以传入自己的组件渲染

interface FieldSchema {
  key: FieldKey;
  label?: string;
  type?: RuleItem['type'];
  control?: ControlType;
  // 对于枚举型的字段组件：提供 options
  options?: Array<{ label: string; value: string | number | boolean }>;
  rules?: RuleItem[];
  // 初始可见性
  initialVisible?: boolean;
  // 单独给字段组件设置的prop
  itemProps?: object;

  // 嵌套子字段
  childrenFields?: FieldSchema[];
}


interface FieldWithStateSchema {
  key: FieldKey;
  path: FieldPath;
  state?: FieldState;
  schemaData?: Omit<FieldSchema, 'key'>;
  effect?: ReflectiveEffect[];
  // 递归
  children: FieldWithStateSchema[];
}

// 存放字段运行时的响应式字段
interface FieldState {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  options: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: string;
  errorMessage?: string;
}

interface FormSchema {
  fields: FieldSchema[];
}

type ReflectiveEffect = (ctx: {
  get: (path: FieldPath) => FieldValue;
  set: (path: FieldPath | FieldPath[], prop: keyof FieldState, value: FieldValue) => void;
}) => void;

interface ReactiveRule {
  deps: FieldPath[]; 
  fn: ReflectiveEffect;
}

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  // 存放编译后的树状数据
  private compiledData: FieldWithStateSchema;
  // 存放校验规则，只用给async-validators适配
  private descriptor: Values;

  private listeners = new Set<(stateSchema: FieldWithStateSchema[]) => void>();

  private rules: ReactiveRule[] = [];

  /** 做两件事：dfs构建编译后的节点，dfs构建用于给async-validator库使用的descriptor */
  constructor(schema: FormSchema, initialValues?: Record<FieldKey, FieldValue>) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    this.compiledData = {
      key: 'dummy-root',
      path: ['dummy'],
      children: []
    };

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    const copyOneNode = (item: FieldSchema, path: FieldPath): FieldWithStateSchema => {
      const res: FieldWithStateSchema = {
        key: item.key,
        path: path, //[...seenPath, item.key],
        state: {
          visible: item.initialVisible ?? true,
          options: item.options ?? []
        },
        schemaData: {
          label: item.label,
          options: item.options ?? [],
          initialVisible: item.initialVisible,
          itemProps: item.itemProps,
          rules: item.rules || [],
          control: item.control,
          type: item.type
        },
        children: []
      }

      if (item.childrenFields && item.childrenFields.length > 0) {
        // 说明是嵌套字段，本身没有值
        res.schemaData = undefined;
        res.state = undefined;
      }

      return res;
    }

    const dfsForSchema = (schema: FieldSchema, structure: FieldWithStateSchema, seenPath: FieldPath) => {
      for (let item of schema.childrenFields || []) {
        const newNode: FieldWithStateSchema = copyOneNode(item, [...seenPath, item.key]);
        dfsForSchema(item, newNode, [...seenPath, item.key]);
        structure.children.push(newNode)
      }
    }

    dfsForSchema({
      childrenFields: schema.fields,
      key: ''
    }, this.compiledData, []);


    // 构建validator

    this.descriptor = {};

    const dfsForValidator = (sourceData: FieldWithStateSchema, validator: {
      [key: string]: any
    }) => {
      // 复制孩子结点
      for (let i of sourceData.children) {
        if (i.schemaData) { // 说明已经是叶子结点
          this.set(i.path, 'errorMessage', undefined);
          
          // 复制Rule
          let rules: RuleItem[] = i.schemaData.rules! || [];
          if (!rules.find((r) => { return r.type }) && i.schemaData.type) {
            rules.push({
              'type': i.schemaData.type,
              message: `The type must be ${i.schemaData.type}, or you should specify a type.`
            });
          }

          validator[i.key] = rules;
        } else {
          validator[i.key] = {
            type: 'object',
            fields: {}
          };
          dfsForValidator(i, validator[i.key].fields);
        }
      }
    }

    dfsForValidator(this.compiledData, this.descriptor)

    console.log(this.descriptor);

  }

  public findNodeByPath(path: FieldPath): FieldWithStateSchema | undefined {
    if (path.length === 0) {
      throw new Error('不能查找顶层');
    }
    let curObj: FieldWithStateSchema | undefined = this.compiledData.children.find((x) => {
      return x.key === path[0]
    });
    if (!curObj) return undefined;

    if (path.length === 1) {
      return curObj;
    } else {
      for (let i = 1; i < path.length; i++) {
        if (!curObj) return undefined;
        curObj = curObj?.children.find((x) => {
          return x.key === path[i]
        })
      }
      return curObj;
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  // 触发更新
  private notify() {
    for (const fn of this.listeners) fn(
      this.compiledData.children
    );
  }

  get(path: FieldPath, prop: keyof FieldState = 'value'): any {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error('the field is not found');
    if (!node.state) throw new Error('node has no state: ' + path.join('.'));
    
    // 对于非叶子节点，如果要获取value，返回undefined或者抛出错误
    if (prop === 'value' && node.children && node.children.length > 0) {
      throw new Error('cannot get value from non-leaf node: ' + path.join('.'));
    }
    
    return node.state[prop];
  }

  /** 设置响应式属性的函数 */
  set = (path: FieldPath, prop: keyof FieldState, value: any) => {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error('the field is not found:' + path);
    // 如果是叶子节点（没有子节点），直接设置
    if (node.state && (!node.children || node.children.length === 0)) {
      node.state[prop] = value;
      
      // 值变化后，触发依赖该字段的规则
      if (prop === 'value') {
        this.triggerRulesFor(path);
      }
    } else {
      // 如果是非叶子节点，批量设置所有叶子节点
      this.setAllLeafNodes(node, prop, value);
    }
    
    this.notify();
  };

  /** 批量设置某个节点下所有叶子节点的属性 */
  private setAllLeafNodes = (parentNode: FieldWithStateSchema, prop: keyof FieldState, value: any) => {
    const setLeafNode = (node: FieldWithStateSchema) => {
      // 如果是叶子节点，设置属性
      if (!node.children || node.children.length === 0) {
        if (node.state) {
          node.state[prop] = value;
          
          // 如果是设置value属性，触发相关规则
          if (prop === 'value') {
            this.triggerRulesFor(node.path);
          }
        }
      } else {
        // 如果有子节点，递归处理
        node.children.forEach(child => {
          setLeafNode(child);
        });
      }
    };
    
    // 递归处理所有子节点
    parentNode.children.forEach(child => {
      setLeafNode(child);
    });
  };
  
  getSnapshot(): FieldWithStateSchema[] {
    return this.compiledData.children;
  }

  /** 注册规则 */
  registerRule(effect: ReflectiveEffect) {
    // 自动分析该副作用的依赖
    const deps: FieldPath[] = [];
    effect({
      get: (path: FieldPath) => void deps.push(path), // 只收集依赖，其余什么也不做
      set: () => {},
    });
    // 将依赖装入Rule
    const rule: ReactiveRule = { deps, fn: effect };
    this.rules.push(rule);
    // 建 dep 索引
    rule.deps.forEach((dep) => {
      const node = this.findNodeByPath(dep);
      if (!node) throw new Error('the field is not found');
      if (!node.effect) node.effect = [];
      node.effect.push(rule.fn);
    });
  }

  /** 主动触发一次全量规则（初始化时可用） */
  runAllRules() {
    for (const rule of this.rules) {
      rule.fn({
        get: (k) => this.get(k, 'value'),
        set: (key, prop, value) => {
          if (Array.isArray(key) && Array.isArray(key[0])) {
            (key as FieldPath[]).forEach((k) => {
              this.set(k, prop, value);
            })
          } else if (Array.isArray(key)) {
            this.set(key as FieldPath, prop, value);
          }
        },
      });
    }
    this.notify();
  }

  private triggerRulesFor(depFieldPath: FieldPath) {
    const node = this.findNodeByPath(depFieldPath);
    if (!node) throw new Error('the field is not found')
    const list = node.effect;
    if (!list) return;
    for (const rule of list) {
      rule({
        get: (k) => {
          return this.get(k, 'value')
        },
        set: (key, prop, value) => {
          if (Array.isArray(key) && Array.isArray(key[0])) {
            (key as FieldPath[]).forEach((k) => {
              this.set(k, prop, value);
            })
          } else {
            this.set(key as FieldPath, prop, value);
          }
        },
      });
    }
  }


  /**
   * 获取所有叶子节点的路径数组
   * @returns 二维数组，每个内部数组代表一个叶子节点的完整路径
   */
  getAllLeafPaths(): FieldPath[] {
    const result: FieldPath[] = [];
    
    const collectLeafPaths = (node: FieldWithStateSchema) => {
      // 如果是叶子节点（没有子节点或子节点为空）
      if (!node.children || node.children.length === 0) {
        result.push([...node.path]); // 添加当前节点的路径到结果中
      } 
      // 如果有子节点，递归处理
      else if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          collectLeafPaths(child);
        });
      }
    };
    
    // 处理顶层节点
    this.compiledData.children.forEach(node => {
      collectLeafPaths(node);
    });
    
    return result;
  }
  
  /**
   * 获取嵌套stateStructure中所有叶子节点的数据，并保持嵌套结构
   * @returns 保持嵌套结构的数据对象
   */
  getJSONData(): Record<string, any> {
    const result: Record<string, any> = {};
    
    const processNode = (node: FieldWithStateSchema, currentObj: Record<string, any>) => {
      // 如果是叶子节点（没有子节点或子节点为空）且节点可见，则添加值
      if ((!node.children || node.children.length === 0) && node.state?.visible) {
        currentObj[node.key] = node.state.value;
      } 
      // 如果有子节点，创建嵌套对象并递归处理
      else if (node.children && node.children.length > 0) {
        // 只有当节点可见时才处理其子节点
        if (node.state?.visible !== false) {
          const nestedObj: Record<string, any> = {};
          node.children.forEach(child => {
            processNode(child, nestedObj);
          });
          
          // 只有当嵌套对象有属性时才添加到结果中
          if (Object.keys(nestedObj).length > 0) {
            currentObj[node.key] = nestedObj;
          }
        }
      }
    };
    
    // 处理顶层节点
    this.compiledData.children.forEach(node => {
      processNode(node, result);
    });
    
    return result;
  }

  validateFields(paths: FieldPath[]): Promise<Values> {
    return this.validateFieldsHelper(paths);
  }


  /**
   * 校验指定路径的表单字段。
   *
   * 该方法通过路径定位字段节点，构建基于字段规则的校验 schema，并校验当前字段值。
   * 校验成功时会清除字段的错误信息，校验失败则设置错误信息。
   * 方法返回一个 Promise，成功时返回校验结果，失败时抛出校验错误。
   *
   * @param path - 字段路径（字符串数组）。
   * @returns Promise，成功返回校验值，失败抛出校验错误。
   */
  validateField(path: FieldPath) {
    const node = this.findNodeByPath(path);
    const descriptor: any = {};
    // 字段名(使用点分隔)
    const fieldName = path.join('.');

    descriptor[fieldName] = node?.schemaData?.rules;
    const schema = new Schema(descriptor);

    return schema.validate({
      [path.join('.')]: node?.state?.value
    }).then((values) => {
      // 校验成功，清除错误信息
      this.set(path, 'errorMessage', undefined);
      return values;
    }).catch((error) => {
      // 校验失败，设置错误信息
      if (error.fields && error.fields[fieldName]) {
        const errors = error.fields[fieldName] as ValidateError[];
        const errorMessage = errors.length > 0 ? errors[0].message : undefined;
        this.set(path, 'errorMessage', errorMessage);
      }
      throw error;
    });
  }

  async validateFieldsHelper(paths?: FieldPath[]): Promise<Values> {
    const form = this.getJSONData();
    
    // 直接拿validator
    const schema = new Schema(this.descriptor);
    // 根据是否有fields区分情况
    
    try {
      return await schema.validate(form,
        paths ? {
          keys: paths.map((path) => path.join('.')),
        }
          : undefined);
    } catch (error) {
      const fields = (error as any).fields;

      // 先清空传入的所有字段的错误信息
      const allLeafPaths = paths ?? this.getAllLeafPaths();
      allLeafPaths.forEach(path_1 => {
        this.set(path_1, 'errorMessage', undefined);
      });

      // 根据验证错误设置对应字段的错误信息
      if (fields) {
        Object.entries(fields).forEach(([fieldPath, errors]) => {
          // 将用点分隔的字符串转换为路径数组
          const path_3 = fieldPath.split('.');

          // 获取第一个错误信息作为显示内容，确保类型安全
          const errorArray = errors as ValidateError[];
          const errorMessage = errorArray.length > 0 ? errorArray[0].message : undefined;
          // 设置字段的错误信息
          this.set(path_3, 'errorMessage', errorMessage);
        });
      }
      console.log(this.compiledData);
      return (error as any).fields;
    }
  }

  validateAllFields() {
    return this.validateFieldsHelper();
  }
}

export {
    FormModel
};
export type {
    FieldPath,
    FieldKey,
    FieldValue,
    FieldSchema,
    FormSchema,
    FieldState,
    ControlType,
    FieldWithStateSchema
};
