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
import { z, ZodType, ZodError, ZodIssue } from "zod";
import { ComponentType } from "react";

type FieldKey = string;

type FieldPath = FieldKey[];
type FieldValue = any; // 可扩展为数组等

type ControlType = "input" | "radio"
  | ComponentType<{ value: FieldValue, onChange: (value: FieldValue) => void }>; // 自定义渲染表单组件，用户也可以传入自己的组件渲染

interface FieldSchema {
  key: FieldKey;
  label?: string;
  validate?: ZodType;
  control?: ControlType;
  // 对于枚举型的字段组件：提供 options
  options?: Array<{ label: string; value: string | number | boolean }>;
  schema?: ZodType; // 使用 zod schema 替代 rules
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
  private compiledData: FieldWithStateSchema;
  private rootSchema: ZodType | null = null; // 缓存根级别的 zod schema
  private fieldSchemaMap: Map<string, ZodType> = new Map(); // 缓存每个字段的 schema

  private listeners = new Set<(stateSchema: FieldWithStateSchema[]) => void>();

  private rules: ReactiveRule[] = [];

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
          schema: item.schema,
          control: item.control,
          validate: item.validate
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

    const dfs = (schema: FieldSchema, structure: FieldWithStateSchema, seenPath: FieldPath) => {
      for (let item of schema.childrenFields || []) {
        const newNode: FieldWithStateSchema = copyOneNode(item, [...seenPath, item.key]);
        dfs(item, newNode, [...seenPath, item.key]);
        structure.children.push(newNode)
      }
    }

    dfs({
      childrenFields: schema.fields,
      key: ''
    }, this.compiledData, []);

    // 构建并缓存所有的 zod schema
    this.buildSchemas();
  }

  /** 构建并缓存所有字段的 zod schema 
   * 优化说明：
   * 1. 在构造函数中一次性构建所有 schema，避免每次校验时重复构建
   * 2. 使用 Map 缓存字段级别的 schema，提高单字段校验性能
   * 3. 为动态字段可见性提供专门的重建方法
   */
  private buildSchemas() {
    // 递归构建 zod schema
    const buildZodSchema = (node: FieldWithStateSchema): ZodType | null => {
      // 如果是叶子节点且有 schema
      if ((!node.children || node.children.length === 0) && node.schemaData) {
        const fieldSchema = node.schemaData.schema || node.schemaData.validate || z.any();
        // 缓存字段级别的 schema
        this.fieldSchemaMap.set(node.path.join('.'), fieldSchema);
        return fieldSchema;
      }
      
      // 如果有子节点，构建对象 schema
      if (node.children && node.children.length > 0) {
        const shape: Record<string, ZodType> = {};
        
        for (const child of node.children) {
          const childSchema = buildZodSchema(child);
          if (childSchema) {
            shape[child.key] = childSchema;
          }
        }
        
        if (Object.keys(shape).length > 0) {
          const objectSchema = z.object(shape);
          // 缓存对象级别的 schema
          this.fieldSchemaMap.set(node.path.join('.'), objectSchema);
          return objectSchema;
        }
      }
      
      return null;
    };
    
    // 构建根级别的 schema
    const rootShape: Record<string, ZodType> = {};
    for (const child of this.compiledData.children) {
      const childSchema = buildZodSchema(child);
      if (childSchema) {
        rootShape[child.key] = childSchema;
      }
    }
    
    if (Object.keys(rootShape).length > 0) {
      this.rootSchema = z.object(rootShape);
    }

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

  /** 获取指定字段的 schema */
  getFieldSchema(path: FieldPath): ZodType | null {
    const fieldKey = path.join('.');
    return this.fieldSchemaMap.get(fieldKey) || null;
  }

  /** 获取所有字段的 schema 映射 */
  getAllFieldSchemas(): Map<string, ZodType> {
    return new Map(this.fieldSchemaMap);
  }

  validateField(path: FieldPath): Promise<any> {
    const node = this.findNodeByPath(path);
    if (!node || !node.state) {
      return Promise.reject(new Error('Field not found or has no state'));
    }

    // 从缓存中获取 schema
    const fieldKey = path.join('.');
    const schema = this.fieldSchemaMap.get(fieldKey);
    
    if (!schema) {
      // 没有校验规则时，直接通过
      this.set(path, 'errorMessage', undefined);
      return Promise.resolve(node.state.value);
    }

    try {
      const result = schema.parse(node.state.value);
      // 校验成功，清除错误信息
      this.set(path, 'errorMessage', undefined);
      return Promise.resolve(result);
    } catch (error) {
      // 校验失败，设置错误信息
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        const errorMessage = firstError?.message || 'Validation failed';
        this.set(path, 'errorMessage', errorMessage);
      }
      return Promise.reject(error);
    }
  }

  validateFields(paths: FieldPath[]): Promise<any> {
    const promises = paths.map(path => this.validateField(path));
    return Promise.all(promises);
  }

  /** 重新构建 schema（当字段可见性发生变化时调用） */
  private rebuildDynamicSchema(): ZodType | null {
    // 递归构建考虑可见性的 zod schema
    const buildDynamicZodSchema = (node: FieldWithStateSchema): ZodType | null => {
      // 如果节点不可见，跳过
      if (node.state && !node.state.visible) {
        return null;
      }
      
      // 如果是叶子节点且有 schema
      if ((!node.children || node.children.length === 0) && node.schemaData) {
        const fieldKey = node.path.join('.');
        return this.fieldSchemaMap.get(fieldKey) || null;
      }
      
      // 如果有子节点，构建对象 schema
      if (node.children && node.children.length > 0) {
        const shape: Record<string, ZodType> = {};
        
        for (const child of node.children) {
          const childSchema = buildDynamicZodSchema(child);
          if (childSchema) {
            shape[child.key] = childSchema;
          }
        }
        
        return Object.keys(shape).length > 0 ? z.object(shape) : null;
      }
      
      return null;
    };
    
    // 构建根级别的动态 schema
    const rootShape: Record<string, ZodType> = {};
    for (const child of this.compiledData.children) {
      const childSchema = buildDynamicZodSchema(child);
      if (childSchema) {
        rootShape[child.key] = childSchema;
      }
    }
    
    return Object.keys(rootShape).length > 0 ? z.object(rootShape) : null;
  }

  validateAllFields(): Promise<any> {
    // 使用动态构建的 schema 来处理字段可见性
    const dynamicSchema = this.rebuildDynamicSchema();
    
    if (!dynamicSchema) {
      // 如果没有任何可见字段需要校验，直接返回表单数据
      return Promise.resolve(this.getJSONData());
    }

    const form = this.getJSONData();
    
    // 先清空所有字段的错误信息
    const allLeafPaths = this.getAllLeafPaths();
    allLeafPaths.forEach(path => {
      this.set(path, 'errorMessage', undefined);
    });
    
    try {
      const result = dynamicSchema.parse(form);
      return Promise.resolve(result);
    } catch (error) {
      if (error instanceof ZodError) {
        // 处理验证错误，设置对应字段的错误信息
        error.issues.forEach((issue) => {
          const path = issue.path.map(String); // 将路径转换为字符串数组
          this.set(path, 'errorMessage', issue.message);
        });
      }
      return Promise.reject(error);
    }
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
