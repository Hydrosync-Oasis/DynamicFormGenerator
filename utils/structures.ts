/** 目前的表单完成情况：
 * 核心部分：
 * 1) 内部对象：存字段键、值、以及"是否显示"visible；用 immer 做 set/get。
 * 2) 值支持：标量值 + 单选（Radio）。(多选可用数组扩展，示例先不做)
 * 3) 多步骤：用二维数组 stepsLayout 来指示每个步骤的字段集合，数据共享一个 store。
 * 4) 动态生成：用 registerRule(deps, fn) 注册"像 useEffect 的函数"。当依赖字段变化时，触发 fn 控制其他字段的 visible。
 */

// ----------------------------- 内部模型层 -----------------------------
import { z, ZodType, ZodError } from "zod";
import { ComponentType } from "react";

type FieldKey = string;

type FieldPath = FieldKey[];
type FieldValue = any; // 可扩展为数组等

type ControlType = "input" | "radio" | "select"
  | ComponentType<{
    value?: FieldValue, onChange?: (value: FieldValue) => void,
    [key: string]: any
  }>; // 自定义渲染表单组件，用户也可以传入自己的组件渲染

interface FieldSchema {
  key?: FieldKey;
  label?: string;
  // 是否是包含字段的数组
  isArray?: boolean;
  validate?: ZodType;
  control?: ControlType;
  // 对于枚举型的字段组件：提供 options
  options?: Array<{ label: string; value: string | number | boolean }>;
  // 初始可见性
  initialVisible?: boolean;
  // 单独给字段组件设置的prop
  itemProps?: Record<string, unknown>;
  // 默认值
  defaultValue?: FieldValue;
  // 帮助说明
  helpTip?: string | JSX.Element;
  // 嵌套子字段
  childrenFields?: FieldSchema[];
  // 字段是否禁用
  disabled?: boolean;
}


interface FieldWithStateSchema {
  key: FieldKey;
  path: FieldPath;
  state?: FieldState;
  isArray?: boolean;
  schemaData?: Omit<FieldSchema, 'key' | 'validate'>;
  effect?: ReactiveEffect[];
  // 递归
  children: FieldWithStateSchema[];
  // 校验对象的缓存，是全量的，不考虑分页（部分校验），只考虑是否可见
  cache?: {
    zodObj?: ZodType
  }
}

// 存放字段运行时的响应式字段
interface FieldState {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  options: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: string;
  errorMessage?: string;
  validation?: ZodType; // 响应式校验规则
  disabled: boolean; // 字段组件是否被禁用
}

interface FormSchema {
  fields: FieldSchema[];
}

type ReactiveEffect = (ctx: {
  get: (path: FieldPath) => FieldValue;
  set: (path: FieldPath | FieldPath[], prop: keyof FieldState, value: FieldValue) => void;
}) => void;

interface ReactiveRule {
  deps: FieldPath[];
  fn: ReactiveEffect;
}

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  private compiledData: FieldWithStateSchema;

  private listeners = new Set<(stateSchema: FieldWithStateSchema[]) => void>();

  private rules: ReactiveRule[] = [];

  constructor(schema: FormSchema) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    this.compiledData = {
      key: 'dummy',
      path: ['dummy'],
      children: []
    };

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    const copyOneNode = (item: FieldSchema, path: FieldPath): FieldWithStateSchema => {
      const res: FieldWithStateSchema = {
        key: item.key!,
        path: path, //[...seenPath, item.key],
        isArray: item.isArray,
        state: {
          value: item.defaultValue,
          visible: item.initialVisible ?? true,
          options: item.options ?? [],
          validation: item.validate || z.unknown().nonoptional({ message: '请填写！' }),
          disabled: item.disabled ?? false
        },
        schemaData: {
          label: item.label,
          options: item.options ?? [],
          initialVisible: item.initialVisible,
          itemProps: item.itemProps,
          control: item.control,
          helpTip: item.helpTip,
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
      let i = 0;
      for (let item of schema.childrenFields || []) {
        if (!item.key) {
          item.key = i.toString();
        }
        const newNode: FieldWithStateSchema = copyOneNode(item, [...seenPath, item.key]);
        dfs(item, newNode, [...seenPath, item.key]);
        structure.children.push(newNode)
        i++;
      }
    }

    dfs({
      childrenFields: schema.fields,
      key: ''
    }, this.compiledData, []);

    // 构建并缓存所有的 zod schema
    this.rebuildDynamicSchema();
  }

  public findNodeByPath(path: FieldPath): FieldWithStateSchema | undefined {
    if (path.length === 0) {
      return this.compiledData;
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

      // 如果设置的是校验规则，清除整个路径的缓存并触发重建
      if (prop === 'validation') {
        this.clearPathCache(path);
        this.rebuildDynamicSchema();
      } else if (prop === 'value') { // 值变化后，触发依赖该字段的规则
        this.triggerRulesFor(path);
      } else if (prop === 'visible') {
        this.rebuildDynamicSchema();
      }

    } else if (prop === 'visible') {
      // 如果是非叶子节点，批量设置所有叶子节点
      for (const item of node.children) {
        this.set(item.path, prop, value);
      }
    } else {
      throw new Error('invalid set operation');
    }
    this.rebuildDynamicSchema();

    this.notify();
  };


  /** 清除指定路径及其所有父路径的缓存 */
  private clearPathCache(path: FieldPath) {
    // 清除从根到指定路径的所有节点缓存
    for (let i = 0; i <= path.length; i++) {
      const currentPath = path.slice(0, i);
      const node = this.findNodeByPath(currentPath);
      if (node && node.cache) {
        node.cache.zodObj = undefined;
      }
    }
  }

  getSnapshot(): FieldWithStateSchema[] {
    return this.compiledData.children;
  }

  /** 注册规则 */
  registerRule(effect: ReactiveEffect) {
    // 自动分析该副作用的依赖
    const deps: FieldPath[] = [];
    effect({
      get: (path: FieldPath) => void deps.push(path), // 只收集依赖，其余什么也不做
      set: () => { },
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
    this.runEffects(this.rules.map((r) => {
      return r.fn
    }));
  }

  /**
   * 运行指定的副作用函数
   * @param effects 副作用函数数组
   */
  private runEffects(effects: ReactiveEffect[]) {
    for (const effect of effects) {
      effect({
        get: (k) => this.get(k, 'value'),
        set: (key, prop, value) => {
          if (Array.isArray(key) && Array.isArray(key[0])) {
            (key as FieldPath[]).forEach((k) => {
              this.set(k, prop, value);
              if (prop === "validation" || prop === "visible") {
                // 如果设置的是校验规则
                this.clearPathCache(k);
              }
            })
          } else if (Array.isArray(key)) {
            this.set(key as FieldPath, prop, value);
            if (prop === "validation" || prop === "visible") {
              // 如果设置的是校验规则
              this.clearPathCache(key as FieldPath);
            }
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
    this.runEffects(list);
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
   * 全量JSON
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
          let nestedObj: Record<string, any> = {};
          if (node.isArray) {
            nestedObj = [];
          }
          node.children.forEach(child => {
            processNode(child, nestedObj);
          });

          // 只有当嵌套对象有属性时才添加到结果中
          if (Object.keys(nestedObj).length > 0) {
            if (Array.isArray(currentObj)) {
              currentObj.push(nestedObj);
            } else {
              currentObj[node.key] = nestedObj;
            }
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

  /**
   * 校验指定字段，无论是否显示
   * @param path 字段路径
   * @returns 校验结果
   */
  validateField(path: FieldPath): Promise<any> {
    const node = this.findNodeByPath(path);
    if (!node || !node.state) {
      return Promise.reject(new Error('Field not found or has no state'));
    }

    // 优先使用响应式校验规则，否则使用缓存的 schema
    const schema = node.state.validation || node.cache?.zodObj;

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

  /**
   * 校验部分字段，无论是否显示
   * @param paths 字段路径
   * @returns 校验结果
   */
  validateFields(paths: FieldPath[]): Promise<any> {
    return this.validateFieldsWithEnhancer(paths);
  }

  /**
   * 动态生成局部 Schema 并一次性校验（支持跨字段校验增强）
   * @param paths 要校验的叶子字段路径集合（必须是叶子路径）
   */
  validateFieldsWithEnhancer(paths: FieldPath[]): Promise<any> {
    if (!paths || paths.length === 0) return Promise.resolve({});

    // 收集对应节点（假定传入的是叶子节点路径）
    const targetNodeSet = new Set<FieldWithStateSchema>();
    for (const p of paths) {
      const node = this.findNodeByPath(p);
      if (!node) throw new Error('field not found: ' + p.join('.'));
      if (node.children && node.children.length > 0) {
        throw new Error('path is not a leaf field: ' + p.join('.'));
      }
      targetNodeSet.add(node);
    }

    type BuildResult = { schema?: ZodType; data?: any; included: boolean };

    const build = (node: FieldWithStateSchema): BuildResult => {
      // 叶子节点
      if (!node.children || node.children.length === 0) {
        if (targetNodeSet.has(node)) {
          // 优先使用响应式校验规则，否则使用缓存或默认 schema
          const schema = node.state?.validation || z.any();
          const value = node.state?.value;
          return { schema, data: value, included: true };
        }
        return { included: false };
      }

      // 非叶子：递归孩子
      const shape: Record<string, ZodType> = {};
      const dataObj: Record<string, any> = {};
      let anyIncluded = false;
      for (const child of node.children) {
        const childRes = build(child);
        if (childRes.included && childRes.schema) {
          shape[child.key] = childRes.schema;
          dataObj[child.key] = childRes.data;
          anyIncluded = true;
        }
      }
      if (!anyIncluded) return { included: false };
      const objSchema = z.object(shape);
      return { schema: objSchema, data: dataObj, included: true };
    };

    // 直接从 dummy root 递归，得到一个整体的 schema/data
    const rootRes = build(this.compiledData);
    if (!rootRes.included || !rootRes.schema) {
      return Promise.resolve({});
    }

    let rootSchema: ZodType = rootRes.schema;

    // 先清理这些字段的旧错误
    for (const p of paths) {
      try { this.set(p, 'errorMessage', undefined); } catch {/* ignore */ }
    }

    try {
      const parsed = (rootSchema as any).parse(rootRes.data);
      return Promise.resolve(parsed);
    } catch (err) {
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          const issuePath = issue.path.map(String) as FieldPath;
          try { this.set(issuePath, 'errorMessage', issue.message); } catch {/* ignore non-leaf */ }
        }
      }
      return Promise.reject(err);
    }
  }

  /** 重新构建 schema（当字段可见性发生变化后应再次调用，全量构建，不分页） ，用于验证整个表单*/
  private rebuildDynamicSchema(): ZodType | null {
    // 递归构建考虑可见性的 zod schema
    const buildDynamicZodSchema = (node: FieldWithStateSchema): ZodType | null => {
      // 如果节点不可见，返回null代表无校验规则
      if (node.state && !node.state.visible) {
        return null;
      }

      if (node.cache && node.cache.zodObj) {
        return node.cache.zodObj;
      }

      // 如果是叶子节点且有 schema
      if ((!node.children || node.children.length === 0) && node.state) {
        if (!node.cache) {
          node.cache = {};
        }
        node.cache.zodObj = node.state.validation;
        return node.state.validation || null;
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


        // 将子字段按顺序放入 tuple，支持异质数组校验
        const tupleItems = (node.children || [])
          .map((c) => shape[c.key])
          .filter((s) => !!s);
        const zodObj = Object.keys(shape).length > 0
          ? (node.isArray ? z.tuple(tupleItems as any) : z.object(shape))
          : z.unknown().nonoptional();

        if (!node.cache) {
          node.cache = {};
        }
        node.cache.zodObj = zodObj;

        return zodObj;
      }

      return null;
    };

    // 构建根级别的动态 schema
    let rootZod = buildDynamicZodSchema(this.compiledData);
    rootZod = z.object({
      [this.compiledData.key]: rootZod,
    });

    return rootZod;
  }

  /**
   * 验证所有可见字段，有缓存加速
   * @param enhance 可选：对生成的根 schema 做 refine/superRefine 等增强以实现跨字段校验
   */
  validateAllFields(enhance?: (schema: ZodType) => ZodType): Promise<any> {
    // 使用动态构建的 schema 来处理字段可见性
    const dynamicSchema = this.rebuildDynamicSchema();

    if (!dynamicSchema) {
      // 如果没有任何可见字段需要校验，直接返回表单数据
      return Promise.resolve(this.compiledData);
    }

    const form = this.compiledData;

    // 先清空所有字段的错误信息
    const allLeafPaths = this.getAllLeafPaths();
    allLeafPaths.forEach(path => {
      this.set(path, 'errorMessage', undefined);
    });
    console.log(this.compiledData);

    try {
      const data = {
        [this.compiledData.key]: this.getJSONData()
      }

      // 应用增强函数（如果提供）
      let finalSchema = dynamicSchema;
      if (enhance) {
        finalSchema = enhance(dynamicSchema);
      }

      const result = finalSchema.parse(data);
      return Promise.resolve(result);
    } catch (error) {
      console.log(error);

      if (error instanceof ZodError) {
        // 处理验证错误，设置对应字段的错误信息
        error.issues.forEach((issue) => {
          const path = issue.path.map(String); // 将路径转换为字符串数组
          this.set(path.slice(1), 'errorMessage', issue.message);
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