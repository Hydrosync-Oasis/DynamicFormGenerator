// ----------------------------- 内部模型层 -----------------------------
import { z, ZodType, ZodError } from "zod";
import { ComponentType } from "react";

type FieldKey = string;

type FieldPath = FieldKey[];
type FieldValue = any; // 可扩展为数组等

type ControlType =
  | "input"
  | "radio"
  | "select"
  | ComponentType<{
      value?: FieldValue;
      onChange?: (value: FieldValue) => void;
      [key: string]: any;
    }>; // 自定义渲染表单组件，用户也可以传入自己的组件渲染

type FieldType = "array" | "object" | "field";

interface FieldSchema {
  key: FieldKey;
  label?: string;
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

class NodeChildrenCache {
  public child: Record<string, NodeChildrenCache> = {};
  public value: FieldValue;
}

interface NodeCache {
  zodObj?: ZodType;
  children?: NodeChildrenCache;
}

interface CompiledFieldNode {
  key: FieldKey;
  path: FieldPath;
  state?: FieldState;
  type: FieldType;
  /**
   * 如果是数组型嵌套字段下的字段，需要有一个指向最靠近根字段的属性
   */
  rootArrayField?: CompiledFieldNode;
  schemaData?: Omit<FieldSchema, "key" | "validate">;
  /**
   * 字段运行时的响应式字段，如果字段是isArray: true的子节点，则无效
   */
  effect?: Set<ReactiveEffect>;
  // 递归
  children: CompiledFieldNode[];
  // 校验对象的缓存，是全量的，不考虑分页（部分校验），只考虑是否可见
  cache?: NodeCache;
}

// 存放字段运行时的响应式字段
interface FieldState {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  options: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: React.ReactNode;
  errorMessage?: string;
  validation?: ZodType; // 响应式校验规则
  disabled: boolean; // 字段组件是否被禁用
}

type FieldProp = {
  children: FieldSchema[];
} & FieldState;

interface FormSchema {
  fields: FieldSchema[];
}

type EffectInvokeReason =
  | "children-updated"
  | "value-changed"
  | "dependencies-collecting"
  | "initial-run";

type ReactiveEffect = (
  ctx: ReactiveEffectContext,
  cause: EffectInvokeReason,
  info?: { changedPath?: FieldPath }
) => void;

type ReactiveEffectContext = {
  /**
   * Read a field's value.
   * @param path The field path to read.
   * @param isDependency Whether this access should be tracked as a reactive dependency
   *                     when used inside rule registration's dependency collection phase.
   *                     Default true. Pass false to read without tracking.
   */
  get: (path: FieldPath, isDependency?: boolean) => FieldValue;
  setVisible: (path: FieldPath, visible: boolean) => void;
  setValue: (
    path: FieldPath,
    value: FieldValue,
    option?: { invokeOnChange?: boolean; invokeEffect?: boolean }
  ) => void;
  setValidation: (path: FieldPath, validator: ZodType) => void;
  updateChildren: (
    path: FieldPath,
    value: FieldSchema[],
    option?: { keepPreviousData?: boolean; shouldTriggerRule?: boolean }
  ) => void;
  setAlertTip: (path: FieldPath, content: React.ReactNode) => void;
  /** 设置字段禁用状态；若 path 指向非叶子，则批量设置其所有后代叶子 */
  setDisable: (path: FieldPath, isDisable: boolean) => void;
};

interface ReactiveRule {
  deps: FieldPath[];
  fn: ReactiveEffect;
}

function compileOneNode(item: FieldSchema, path: FieldPath): CompiledFieldNode {
  let type: FieldType = "field";
  if (item.isArray) {
    type = "array";
  } else if (item.childrenFields && item.childrenFields?.length > 0) {
    type = "object";
  }
  const res: CompiledFieldNode = {
    key: item.key,
    path: path, //[...seenPath, item.key],
    type,
    state: {
      value: item.defaultValue,
      visible: item.initialVisible ?? true,
      options: item.options ?? [],
      validation:
        item.validate || z.unknown().nonoptional({ message: "请填写！" }),
      disabled: item.disabled ?? false,
    },
    schemaData: {
      label: item.label,
      options: item.options ?? [],
      initialVisible: item.initialVisible,
      itemProps: item.itemProps,
      control: item.control,
      helpTip: item.helpTip,
    },
    children: [],
  };

  return res;
}

const compileNodes = (
  schema: FieldSchema,
  cur: CompiledFieldNode,
  seenPath: FieldPath,
  rootArrayField?: CompiledFieldNode
) => {
  let root = rootArrayField;
  // 设置根数组节点的逻辑
  if (schema.isArray && !root) {
    root = cur;
  }
  if (root) {
    cur.rootArrayField = root;
  }

  for (let item of schema.childrenFields || []) {
    const newNode: CompiledFieldNode = compileOneNode(item, [
      ...seenPath,
      item.key,
    ]);

    compileNodes(item, newNode, [...seenPath, item.key], root);
    cur.children.push(newNode);
  }
};

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  private compiledData: CompiledFieldNode;

  private listeners = new Set<(stateSchema: CompiledFieldNode[]) => void>();

  private rules: Set<ReactiveRule> = new Set();

  public onChange?: (path: FieldPath, value: FieldValue) => void;

  constructor(schema: FormSchema) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    this.compiledData = {
      key: "dummy",
      path: ["dummy"],
      type: "object",
      children: [],
    };

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    compileNodes(
      {
        childrenFields: schema.fields,
        key: "",
      },
      this.compiledData,
      []
    );

    // 构建并缓存所有的 zod schema
    this.rebuildDynamicSchema();
  }

  public findNodeByPath(path: FieldPath): CompiledFieldNode | undefined {
    if (path.length === 0) {
      return this.compiledData;
    }

    let curObj: CompiledFieldNode | undefined = this.compiledData;
    if (!curObj) return undefined;

    for (let i = 0; i < path.length; i++) {
      if (!curObj) return undefined;
      curObj = curObj?.children.find((x) => {
        return x.key === path[i];
      });
    }
    return curObj;
  }

  private getNodesOnPath(path: FieldPath): CompiledFieldNode[] | undefined {
    const nodes: CompiledFieldNode[] = [];
    if (!path || path.length === 0) return undefined;

    let current: CompiledFieldNode | undefined = this.compiledData;
    for (let i = 0; i < path.length; i++) {
      if (!current || !current.children) return undefined;
      const nextNode: CompiledFieldNode | undefined = current.children.find(
        (child: CompiledFieldNode) => child.key === path[i]
      );
      if (!nextNode) return undefined;
      nodes.push(nextNode);
      current = nextNode;
    }
    return nodes;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this.compiledData.children);
  }

  get(path: FieldPath, prop: keyof FieldProp = "value"): any {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");

    if (prop === "children") {
      if (node.type === "array") {
        return node.children;
      } else {
        throw new Error("only array-type fields can retrieve child nodes.");
      }
    } else {
      if (!node.state) {
        throw new Error("node has no state: " + path.join("."));
      }
      // 对于非叶子节点，如果要获取value，返回undefined或者抛出错误
      if (prop === "value") {
        if (node.type === "array") {
          return node.children;
        } else if (node.type !== "field") {
          throw new Error(
            "cannot get value from non-leaf node: " + path.join(".")
          );
        }
      }

      return node.state[prop];
    }
  }

  setVisible(path: FieldPath, visible: boolean) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }

    const dfs = (node: CompiledFieldNode) => {
      if (node.type === "field") {
        node.state!.visible = visible;
        this.clearPathZodCache(node.path);
        return;
      }

      for (let i of node.children) {
        dfs(i);
      }
    };

    dfs(node);
    this.rebuildDynamicSchema();
    this.notify();
  }

  setValue(
    path: FieldPath,
    value: FieldValue,
    option?: {
      invokeOnChange?: boolean;
      invokeEffect?: boolean;
    }
  ) {
    const nodes = this.getNodesOnPath(path);
    const node = nodes?.[nodes.length - 1];
    const invokeOnChange = option?.invokeOnChange;
    const invokeEffect = option?.invokeEffect ?? true;

    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type === "object") {
      throw new Error("the field is not leaf-node:" + path);
    }
    if (!node.state) {
      return;
    }

    if (nodes.some((x) => x.type === "array")) {
      if (node.type === "array") {
        throw new Error("please use updateChildren to set array field value");
      } else {
        node.state.value = value;

        // 值变化后，触发依赖该字段的规则
        const root = node.rootArrayField;
        if (root && invokeEffect) {
          this.runEffects(
            root.effect || new Set<ReactiveEffect>(),
            "value-changed",
            { changedPath: path }
          );
        }
      }
    } else {
      node.state.value = value;
      // 值变化后，触发依赖该字段的规则
      if (invokeEffect) {
        this.triggerEffectsFor(path, "value-changed");
      }
    }
    if (invokeOnChange) {
      this.onChange?.(path, value);
    }

    this.notify();
  }

  setValidation(path: FieldPath, validator: z.ZodType) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (!node.state) {
      throw new Error("the field is not leaf-node:" + path);
    }

    node.state.validation = validator;
    this.clearPathZodCache(path);
    this.rebuildDynamicSchema();
  }

  /**
   *
   * @param path 数组型嵌套字段的路径
   * @param value 内部字段（可继续嵌套）
   * @param option 选项配置对象
   */
  updateChildren(
    path: FieldPath,
    value: FieldSchema[],
    option?: {
      keepPreviousData?: boolean;
      shouldTriggerRule?: boolean;
    }
  ) {
    const node = this.findNodeByPath(path);

    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type !== "array") {
      throw new Error("updateChildren can only be used on array-type fields.");
    }

    const shouldTriggerRule = option?.shouldTriggerRule ?? true;
    // 生成新节点
    const dummySource: FieldSchema = {
      key: "dummy",
      childrenFields: value,
    };
    // 编译后的节点，值全部为空
    const dummyTarget: CompiledFieldNode = {
      key: "dummy",
      path: ["dummy"],
      children: [],
      type: "object",
    };
    compileNodes(dummySource, dummyTarget, path, node);

    // 遍历target树，一边遍历一边从缓存里找对应节点，并尝试复制value，结构不一致不会报错，但也不会复制
    const dfsFindCache = (
      target: CompiledFieldNode,
      cache: NodeChildrenCache
    ) => {
      if (!cache.child) {
        return;
      }
      if (target.type === "field") {
        // 叶子结点
        if (cache && !(cache.child instanceof NodeChildrenCache)) {
          target.state!.value = cache.value;
        }
      } else {
        for (let childTarget of target.children) {
          const childCache = Object.entries(cache.child).find((x) => {
            return x[0] === childTarget.key;
          })?.[1];
          if (childCache && childCache instanceof NodeChildrenCache) {
            dfsFindCache(childTarget, childCache);
          }
        }
      }
    };
    // 不管是否使用缓存，都要把新来的存一下
    if (!node.cache) {
      node.cache = {};
    }
    if (!node.cache.children) {
      node.cache.children = new NodeChildrenCache();
    }

    // 生成缓存的函数
    const dfsGenerateCache = (
      curNode: CompiledFieldNode,
      cache: NodeChildrenCache
    ) => {
      if (curNode.type === "field") {
        // 叶子结点了
        cache.value = curNode.state!.value;
        return;
      }

      for (let i of curNode.children) {
        if (!cache.child) {
          cache.child = {};
        }
        if (!(cache.child[i.key] instanceof NodeChildrenCache)) {
          cache.child[i.key] = new NodeChildrenCache();
        }
        dfsGenerateCache(i, cache.child[i.key]);
      }
    };

    dfsGenerateCache(node, node.cache.children);

    if (node.cache?.children && option?.keepPreviousData) {
      dfsFindCache(dummyTarget, node.cache?.children);
    }

    // 更新前，清除校验对象缓存
    const leafNodes = this.getAllLeafPaths(node);
    leafNodes.forEach((p) => {
      this.clearPathZodCache(p);
    });

    // 更新
    node.children = dummyTarget.children;

    if (shouldTriggerRule) {
      this.runEffects(
        node.effect || new Set<ReactiveEffect>(),
        "children-updated"
      );
    }
    this.rebuildDynamicSchema();

    this.notify();
  }

  setAlertTip(path: FieldPath, content: React.ReactNode) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (!node.state) {
      throw new Error("the field is not leaf-node:" + path);
    }

    node.state.alertTip = content;
    this.notify();
  }

  setDisable(path: FieldPath, isDisable: boolean) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    const dfs = (n: CompiledFieldNode) => {
      if (n.type === "field") {
        if (n.state) {
          n.state.disabled = isDisable;
        }
        return;
      }
      if (n.children && n.children.length > 0) {
        n.children.forEach((c) => dfs(c));
      }
    };

    dfs(node);
    this.notify();
  }

  /** 清除指定路径及其所有父路径的缓存 */
  private clearPathZodCache(path: FieldPath) {
    const nodes = this.getNodesOnPath(path);
    if (!nodes) return;
    if (!this.compiledData.cache) {
      this.compiledData.cache = {};
    }
    this.compiledData.cache.zodObj = undefined;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.cache && node.cache.zodObj) {
        node.cache.zodObj = undefined;
      }
    }
  }

  getSnapshot(): CompiledFieldNode[] {
    return this.compiledData.children;
  }

  /** 注册规则 */
  registerRule(effect: ReactiveEffect) {
    // 自动分析该副作用的依赖
    const deps: FieldPath[] = [];
    effect(
      {
        get: (path: FieldPath, isDependency: boolean = true) => {
          if (isDependency) deps.push(path);
          console.log(path);

          // During dependency collection we don't need the concrete value
          // and we must satisfy the return type
          return undefined as any;
        },
        setVisible: () => void 0,
        setValue: () => void 0,
        setValidation: () => void 0,
        updateChildren: () => void 0,
        setAlertTip: () => void 0,
        setDisable: () => void 0,
      },
      "dependencies-collecting"
    );
    // 将依赖装入Rule
    const rule: ReactiveRule = { deps, fn: effect };
    this.rules.add(rule);
    // 建 dep 索引
    rule.deps.forEach((dep) => {
      const node = this.findNodeByPath(dep);
      if (!node) throw new Error("the field is not found: " + dep);
      if (!node.effect) node.effect = new Set();
      node.effect.add(rule.fn);
    });

    return () => {
      rule.deps.forEach((dep) => {
        const node = this.findNodeByPath(dep)!;
        node.effect!.delete(rule.fn);
      });
    };
  }

  /** 主动触发一次全量规则（初始化时可用） */
  runAllRules() {
    this.runEffects(
      new Set(
        [...this.rules].map((r) => {
          return r.fn;
        })
      ),
      "initial-run"
    );
  }

  /**
   * 运行指定的副作用函数
   * @param effects 副作用函数数组
   */
  private runEffects(
    effects: Set<ReactiveEffect>,
    cause: EffectInvokeReason,
    info?: { changedPath?: FieldPath }
  ) {
    for (const effect of effects) {
      effect(
        {
          get: (k, _isDependency?: boolean) => this.get(k, "value"),
          setVisible: (path, visible) => this.setVisible(path, visible),
          setValue: (path, value, option) => this.setValue(path, value, option),
          setValidation: (path, validator) =>
            this.setValidation(path, validator as any),
          updateChildren: (path, chilren, option) =>
            this.updateChildren(path, chilren, option),
          setAlertTip: (path, content) => this.setAlertTip(path, content),
          setDisable: (path, isDisable) => this.setDisable(path, isDisable),
        },
        cause,
        info
      );
      this.notify();
    }
  }

  private triggerEffectsFor(
    depFieldPath: FieldPath,
    cause: EffectInvokeReason
  ) {
    const node = this.findNodeByPath(depFieldPath);
    if (!node) throw new Error("the field is not found");
    const list = node.effect;
    if (!list) return;
    this.runEffects(list, cause, { changedPath: depFieldPath });
  }

  /**
   * 获取所有叶子节点的路径数组
   * @returns 二维数组，每个内部数组代表一个叶子节点的完整路径
   */
  /**
   * 获取指定节点（可选，默认根）的所有叶子节点路径
   * @param node 可选的起始节点；若不传则从表单根开始
   */
  getAllLeafPaths(node?: CompiledFieldNode): FieldPath[] {
    const result: FieldPath[] = [];

    const collectLeafPaths = (n: CompiledFieldNode) => {
      // 如果是叶子节点（没有子节点或子节点为空）
      if (n.type === "field") {
        result.push([...n.path]); // 添加当前节点的路径到结果中
      }
      // 如果有子节点，递归处理
      else if (n.children && n.children.length > 0) {
        n.children.forEach((child) => {
          collectLeafPaths(child);
        });
      }
    };

    // 从传入节点或根节点开始
    collectLeafPaths(node ?? this.compiledData);
    return result;
  }

  /**
   * 获取嵌套stateStructure中所有叶子节点的数据，并保持嵌套结构
   * 全量JSON
   * @returns 保持嵌套结构的数据对象
   */
  getJSONData(shouldGenerateArray: boolean): Record<string, any> {
    const result: Record<string, any> = {};

    const processNode = (
      node: CompiledFieldNode,
      currentObj: Record<string, any>
    ) => {
      // 如果是叶子节点（没有子节点或子节点为空）且节点可见，则添加值
      if (node.type === "field" && node.state?.visible) {
        if (Array.isArray(currentObj)) {
          currentObj.push(node.state.value);
        } else {
          currentObj[node.key] = node.state.value;
        }
      }
      // 如果有子节点，创建嵌套对象并递归处理
      else if (node.children && node.children.length > 0) {
        // 只有当节点可见时才处理其子节点
        if (node.state?.visible !== false) {
          let nestedObj: Record<string, any> = {};
          if (node.type === "array" && shouldGenerateArray) {
            nestedObj = [];
          }
          node.children.forEach((child) => {
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
    this.compiledData.children.forEach((node) => {
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
      return Promise.reject(new Error("Field not found or has no state"));
    }

    // 优先使用响应式校验规则，否则使用缓存的 schema
    const schema = node.state.validation || node.cache?.zodObj;

    if (!schema) {
      // 没有校验规则时，直接通过
      node.state.errorMessage = undefined;
      return Promise.resolve(node.state.value);
    }

    try {
      const result = schema.parse(node.state.value);
      // 校验成功，清除错误信息
      node.state.errorMessage = undefined;
      return Promise.resolve(result);
    } catch (error) {
      // 校验失败，设置错误信息
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        const errorMessage = firstError?.message;
        node.state.errorMessage = errorMessage;
      }
      return Promise.reject(error);
    } finally {
      this.notify();
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
   * 动态生成局部 Schema 并一次性校验
   * @param paths 要校验的叶子字段路径集合（必须是叶子路径）
   */
  validateFieldsWithEnhancer(paths: FieldPath[]): Promise<any> {
    if (!paths || paths.length === 0) return Promise.resolve({});

    // 收集对应节点（假定传入的是叶子节点路径）
    const targetNodeSet = new Set<CompiledFieldNode>();
    for (const p of paths) {
      const node = this.findNodeByPath(p);
      if (!node) throw new Error("field not found: " + p.join("."));
      if (node.type !== "field") {
        throw new Error("path is not a leaf field: " + p.join("."));
      }
      targetNodeSet.add(node);
    }

    type BuildResult = { schema?: ZodType; data?: any; included: boolean };

    const build = (node: CompiledFieldNode): BuildResult => {
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
      try {
        const node = this.findNodeByPath(p);
        if (node?.state?.errorMessage) {
          node.state.errorMessage = undefined;
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const parsed = (rootSchema as any).parse(rootRes.data);
      return Promise.resolve(parsed);
    } catch (err) {
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          const issuePath = issue.path.map(String) as FieldPath;
          try {
            const node = this.findNodeByPath(issuePath);
            if (node?.state) {
              node.state.errorMessage = issue.message;
            }
          } catch {
            /* ignore non-leaf */
          }
        }
      }
      return Promise.reject(err);
    } finally {
      this.notify();
    }
  }

  /** 重新构建 schema（当字段可见性发生变化后应再次调用，全量构建，不分页） ，用于验证整个表单*/
  private rebuildDynamicSchema(): ZodType | undefined {
    // 递归构建考虑可见性的 zod schema
    const buildDynamicZodSchema = (
      node: CompiledFieldNode
    ): ZodType | undefined => {
      // 如果节点不可见，返回null代表无校验规则
      if (node.state && !node.state.visible) {
        return undefined;
      }

      if (node.cache && node.cache.zodObj) {
        return node.cache.zodObj;
      }

      // 如果是叶子节点且有 schema
      if (node.type === "field" && node.state) {
        if (!node.cache) {
          node.cache = {};
        }
        node.cache.zodObj = node.state.validation;
        return node.state.validation;
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

        const zodObj =
          Object.keys(shape).length > 0 ? z.object(shape) : undefined;

        if (!node.cache) {
          node.cache = {};
        }
        node.cache.zodObj = zodObj;

        return zodObj;
      }

      return undefined;
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

    // 先清空所有字段的错误信息
    const allLeafPaths = this.getAllLeafPaths(this.compiledData);
    allLeafPaths.forEach((path) => {
      const node = this.findNodeByPath(path);
      if (node?.state) {
        node.state.errorMessage = undefined;
      }
    });

    try {
      const data = {
        [this.compiledData.key]: this.getJSONData(false),
      };

      // 应用增强函数（如果提供）
      let finalSchema = dynamicSchema;
      if (enhance) {
        finalSchema = enhance(dynamicSchema);
      }

      const result = finalSchema.parse(data);
      return Promise.resolve(result);
    } catch (error) {
      if (error instanceof ZodError) {
        // 处理验证错误，设置对应字段的错误信息
        error.issues.forEach((issue) => {
          const path = issue.path.map(String); // 将路径转换为字符串数组
          const node = this.findNodeByPath(path.slice(1));
          if (node?.state) {
            node.state.errorMessage = issue.message;
          }
        });
      }
      return Promise.reject(error);
    } finally {
      this.notify();
    }
  }
}

export { FormModel };
export type {
  FieldPath,
  FieldKey,
  FieldValue,
  FieldSchema,
  FormSchema,
  FieldState,
  ControlType,
  CompiledFieldNode as FieldWithStateSchema,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
};
