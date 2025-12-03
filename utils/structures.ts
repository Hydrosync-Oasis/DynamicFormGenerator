// ----------------------------- 内部模型层 -----------------------------
import { z, ZodType, ZodError } from "zod";
import { mutableNodeToImmutableNode, setMutableNode } from "./immutableHelper";
import { PlainObjectCacheManager } from "./plainObjectCacheManager";
import { ValidatorCacheManager } from "./validatorCacheManager";
import {
  FieldValue,
  FieldSchema,
  LeafDynamicProp,
  FieldPath,
  MutableFieldNode,
  FieldKey,
  ControlType,
  ImmutableFormState,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
  ReactiveRule,
  FormCommands,
  IncludePolicyLeafField,
  FieldSource,
  IncludePolicyNestedField,
} from "./type";
import { getPlainObject, isChildNode, isSamePath } from "./helper";
import { DirtyValueCacheManager } from "./dirtyValueCacheManager";

interface FormSchema {
  fields: FieldSchema[];
}

/**
 * 获取一个节点路径上的所有节点
 * @param mutableModel 可变表单对象模型
 * @param path 不包含根节点的路径
 * @param containsRoot 返回的节点数组是否包含根节点
 * @returns
 */
export function getNodesOnPath(
  mutableModel: MutableFieldNode,
  path: FieldPath,
  containsRoot?: boolean
): MutableFieldNode[] | undefined {
  const nodes: MutableFieldNode[] = [];
  if (!path) return undefined;

  let current: MutableFieldNode | undefined = mutableModel;
  if (containsRoot) {
    nodes.push(current);
  }
  for (let i = 0; i < path.length; i++) {
    if (!current) return undefined;
    if (current.type === "field") return undefined;

    const nextNode: MutableFieldNode | undefined = current.children.find(
      (child: MutableFieldNode) => child.key === path[i]
    );
    if (!nextNode) return undefined;
    nodes.push(nextNode);
    current = nextNode;
  }
  return nodes;
}

function compileOneNode(item: FieldSchema, path: FieldPath): MutableFieldNode {
  if ("isArray" in item && item.isArray) {
    return {
      key: item.key,
      path: path,
      type: "array",
      dynamicProp: {
        visible: item.initialVisible ?? true,
        includePolicy: item.includePolicy ?? "when-children-include",
      },
      staticProp: {
        schema: item.arraySchema!,
        LayoutComponent: item.LayoutComponent,
      },
      children: [],
      snapshot: {
        dirty: true,
      },
      effect: new Set(),
      cache: {
        plainObj: { type: "dirty" },
        validator: "dirty",
        dirty: "dirty",
      },
    };
  } else if ("isArray" in item && !item.isArray) {
    return {
      key: item.key,
      path: path,
      type: "object",
      dynamicProp: {
        visible: item.initialVisible ?? true,
        includePolicy: item.includePolicy ?? "when-children-include",
      },
      staticProp: {
        LayoutComponent: item.LayoutComponent,
      },
      snapshot: {
        dirty: true,
      },
      children: [],
      cache: {
        plainObj: { type: "dirty" },
        validator: "dirty",
        dirty: "dirty",
      },
    };
  } else {
    return {
      key: item.key,
      path: path,
      type: "field",
      source: "initial",
      dynamicProp: {
        value: item.defaultValue,
        visible: item.initialVisible ?? true,
        includePolicy: item.includePolicy ?? "when-visible",
        validation:
          item.validate instanceof ZodType
            ? {
                onChange: item.validate || z.unknown(),
              }
            : item.validate || { onChange: z.unknown() },
        required: true,
        controlProp: item.controlProps,
        errorMessage: {},
      },
      staticProp: {
        label: item.label || "未命名",
        toolTip: item.helpTip,
        control: item.control,
        defaultValue: item.defaultValue,
        FieldDisplayComponent: item.FieldDisplayComponent,
      },
      snapshot: {
        dirty: true,
      },
      effect: new Set(),
      cache: {
        plainObj: { type: "dirty" },
        validator: "dirty",
        dirty: "dirty",
      },
    };
  }
}

const compileNodes = (
  schema: FieldSchema &
    (
      | { isArray: false; childrenFields: FieldSchema[] }
      | { isArray: true; arraySchema: Omit<FieldSchema, "key"> }
    ),
  cur: MutableFieldNode & { type: "object" | "array" },
  seenPath: FieldPath,
  rootArrayField?: MutableFieldNode
) => {
  let root = rootArrayField;
  // 设置根数组节点的逻辑
  if (schema.isArray && !root) {
    root = cur;
  }
  if (root) {
    cur.rootArrayField = root;
  }

  if (schema.isArray === false) {
    for (let schemaItem of schema.childrenFields || []) {
      const newNode: MutableFieldNode = compileOneNode(schemaItem, [
        ...seenPath,
        schemaItem.key,
      ]);

      if (newNode.type !== "field" && "isArray" in schemaItem) {
        compileNodes(schemaItem, newNode, [...seenPath, schemaItem.key], root);
      } else {
        // 否则是叶子结点不需要继续递归
      }

      cur.children.push(newNode);
    }
  } else {
    // 数组型字段是动态的，和数据有关，在这里直接结束，不能继续递归
    const newNode: MutableFieldNode = compileOneNode(schema, [
      ...seenPath,
      schema.key,
    ]);
    return newNode;
  }
};

/**
 * 全量编译schema为可变节点，不保留任何旧信息，适用于初次设置
 * @param value
 * @param schema
 * @param path
 * @param rootArrayField
 * @returns
 */
const compileArrayNode = (
  value: Record<string, any> | undefined,
  schema: FieldSchema,
  path: FieldPath,
  rootArrayField: MutableFieldNode & { type: "array" },
  source: FieldSource
): MutableFieldNode => {
  if (!("isArray" in schema)) {
    // 返回一个field type的节点
    const field = compileOneNode(schema, path);
    if (field.type !== "field") {
      throw new Error("schema mismatch for field node");
    }
    field.rootArrayField = rootArrayField;
    field.dynamicProp.value = value;
    field.source = source;
    return field;
  }
  const children: MutableFieldNode[] = [];
  if (schema.isArray) {
    const node = compileOneNode(schema, path) as MutableFieldNode & {
      type: "array";
    };
    node.children = children;
    node.rootArrayField = rootArrayField;
    // value输入可以是数组，也可以是一个对象，如果是对象，那么对象的key就是字段的key
    Object.entries(value || {}).forEach(([key, v]) => {
      const childSchema: FieldSchema = {
        ...schema.arraySchema,
        key: key,
      } as FieldSchema;
      children.push(
        compileArrayNode(v, childSchema, [...path, key], rootArrayField, source)
      );
    });

    return node;
  } else {
    // 是object
    const node = compileOneNode(schema, path) as MutableFieldNode & {
      type: "object";
    };
    node.children = children;
    node.rootArrayField = rootArrayField;
    // value输入是一个对象，遍历schema来从value中取值
    schema.childrenFields!.forEach((childSchema) => {
      const k = childSchema.key;
      const v = value?.[k];
      children.push(
        compileArrayNode(v, childSchema, [...path, k], rootArrayField, source)
      );
    });
    return node;
  }
};

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  /** 可变数据源，包括了所有生成表单所需的信息 */
  private _mutableDataSource: MutableFieldNode & {
    type: "object";
    dynamicProp: { visible: true };
  };

  /** 最终对象缓存管理器 */
  private plainCacheManager!: PlainObjectCacheManager;

  /** 校验器缓存管理器 */
  private validatorCacheManager!: ValidatorCacheManager;

  /** 字段脏状态缓存管理器 */
  private dirtyValueCacheManager: DirtyValueCacheManager;

  /** 表单初始值，可在创建初、或通过reset设置表单初始值 */
  private _initialValue?: Record<string, any>;

  private listeners = new Set<() => void>();

  private rules: Set<ReactiveRule> = new Set();

  public onChange?: (path: FieldPath, value: FieldValue) => void;

  public formCommands: FormCommands = {
    getValue: (path: FieldPath) => this.get(path, "value"),
    setValue: (path: FieldPath, value: FieldValue, option?) =>
      this.setValue(path, value, option, true),
    setValues: (path: FieldPath, values: Record<string, any>, option?) =>
      this.setValues(path, values, option, true),
    setValuesIfUserNotModified: (
      path: FieldPath,
      values: any,
      dirty: boolean
    ) => this.setValuesIfUserNotModified(path, values, dirty),
    setVisible: (path: FieldPath, visible: boolean) =>
      this.setVisible(path, visible, true),
    setAlertTip: (path: FieldPath, alertTip: React.ReactNode) =>
      this.setAlertTip(path, alertTip, true),
    resetFields: (path?: FieldPath) => this.resetFields(path),
    setValidation: (path: FieldPath, validator: ZodType, ruleSet?: string) =>
      this.setValidation(path, validator, true, ruleSet ?? "onChange"),
    setArray: (path: FieldPath, children: Record<string, any>, option?) =>
      this.setArray(path, children, option, true),
    insertIntoArray: (
      path: FieldPath,
      value: Record<string, any>,
      key?: string,
      position?: "before" | "after"
    ) => this.insertIntoArray(path, value, position, key, true),
    setControlProp: (path: FieldPath, propName: string, propValue: any) =>
      this.setControlProp(path, propName, propValue, true),
    validateField: (
      path: FieldPath,
      enableEnhancer: boolean,
      ruleSet?: string
    ) => this.validateFieldForRuleset(path, enableEnhancer, ruleSet, true),
    setIncludePolicy: (path: FieldPath, policy: IncludePolicyLeafField) =>
      this.setIncludePolicy(path, policy),
  };

  get mutableData() {
    return this._mutableDataSource;
  }

  get initialValue() {
    return this._initialValue;
  }

  constructor(schema: FormSchema) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    this._mutableDataSource = {
      key: "dummy",
      path: ["dummy"],
      type: "object",
      children: [],
      dynamicProp: { visible: true, includePolicy: "always" },
      staticProp: {},
      snapshot: { dirty: true },
      cache: {
        plainObj: { type: "dirty" },
        validator: "dirty",
        dirty: "dirty",
      },
    };

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    compileNodes(
      {
        childrenFields: schema.fields,
        key: "",
        isArray: false,
      },
      this._mutableDataSource,
      ["dummy"]
    );

    // 初始化最终对象缓存管理器
    this.plainCacheManager = new PlainObjectCacheManager(
      this._mutableDataSource
    );
    this.plainCacheManager.rebuild();

    // 生成初始值
    this._initialValue = this.plainCacheManager.finalData.validatData;

    // 初始化校验器缓存管理器
    this.validatorCacheManager = new ValidatorCacheManager(
      this._mutableDataSource
    );

    // 初始化字段脏状态缓存管理器
    this.dirtyValueCacheManager = new DirtyValueCacheManager(this);

    this.validatorCacheManager.rebuild();
  }

  /**
   * 输入路径，寻找可变节点
   * @param path 不包含dummy的路径
   * @returns 可变节点引用
   */
  public findNodeByPath(path: FieldPath): MutableFieldNode | undefined {
    if (path.length === 0) {
      return this._mutableDataSource;
    }

    let curObj: MutableFieldNode | undefined = this._mutableDataSource;
    if (!curObj) return undefined;

    for (let i = 0; i < path.length; i++) {
      if (!curObj || curObj.type === "field") return undefined;
      curObj = curObj?.children.find((x) => {
        return x.key === path[i];
      });
    }
    return curObj;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
    // this.currentVersion++;
  }

  get(path: FieldPath, prop: "value" | "errorMessage" | "visible"): any {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found: " + path);

    if (!node.dynamicProp) {
      throw new Error("node has no state: " + path.join("."));
    }
    // 对于非叶子节点，如果要获取value，返回undefined或者抛出错误
    if (node.type === "array") {
      this.plainCacheManager.rebuild();
      if (node.cache.plainObj.type === "dirty") {
        return {};
      } else {
        return node.cache.plainObj.objectOnlyIncludesHidden;
      }
    } else if (node.type === "field") {
      return node.dynamicProp[prop];
    } else {
      if (prop === "visible") {
        const nodes = getNodesOnPath(this._mutableDataSource, path, true);
        return nodes!.every((n) => n.dynamicProp.visible) ?? false;
      }
      throw new Error(
        `cannot get ${prop} from non-leaf node: ` + path.join(".")
      );
    }
  }

  loadData(data: any, path: FieldPath = [], isDirty: boolean = false) {
    this.setValuesInternal(path, data, "source", { invokeEffect: true }, false);
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("this node is not found: " + path);
    }
    this.dirtyValueCacheManager.updateNodeWithSubtree(node);
    this.plainCacheManager.rebuild();
    if (node.cache.plainObj.type !== "hasValue") {
      throw new Error("dirty value");
    }
    // data不可信，可能有多余字段，需要从节点出发
    const newInitialData = node.cache.plainObj.objectOnly;

    this._initialValue = newInitialData;

    this.dirtyValueCacheManager.rebuild();
    this.notify();
  }

  setVisible(path: FieldPath, visible: boolean, shouldNotify = false) {
    setMutableNode(this._mutableDataSource, path, (node) => {
      let submitDataModified = true;
      if (Object.is(node.dynamicProp.visible, visible)) {
        return false;
      }
      if (node.type === "field") {
        if (["always", "never"].includes(node.dynamicProp.includePolicy)) {
          submitDataModified = false;
        }
      }

      node.dynamicProp.visible = visible;
      if (submitDataModified) {
        this.validatorCacheManager.updateNode(node);
        this.plainCacheManager.updateNode(node);
        this.dirtyValueCacheManager.updateNode(node);
        this.dirtyValueCacheManager.rebuild();
      }
    });
    if (shouldNotify) {
      this.notify();
    }
  }

  setIncludePolicy(path: FieldPath, policy: IncludePolicyNestedField) {
    let submitDataModified = true;
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.dynamicProp.includePolicy === policy) {
      return;
    }

    const oldPolicy = node.dynamicProp.includePolicy;
    const visible = node.dynamicProp.visible;
    if (
      visible &&
      ((policy === "always" && oldPolicy === "when-visible") ||
        (policy === "when-visible" && oldPolicy === "always"))
    ) {
      submitDataModified = false;
    }

    if (
      !visible &&
      ((policy === "never" && oldPolicy === "when-visible") ||
        (policy === "when-visible" && oldPolicy === "never"))
    ) {
      submitDataModified = false;
    }

    node.dynamicProp.includePolicy = policy;

    if (submitDataModified) {
      this.validatorCacheManager.updateNode(node);
      this.plainCacheManager.updateNode(node);
      this.dirtyValueCacheManager.updateNode(node);
      this.dirtyValueCacheManager.rebuild();
    }
  }

  setValue(
    path: FieldPath,
    value: FieldValue,
    option?: {
      invokeOnChange?: boolean;
      invokeEffect?: boolean;
    },
    shouldNotify: boolean = false
  ) {
    this.setValueInternal(path, value, "user", option);

    if (shouldNotify) {
      this.notify();
    }
  }

  setValuesIfUserNotModified(
    path: FieldPath,
    value: any,
    shouldDirty: boolean = false,
    shouldNotify: boolean = false
  ) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the node is not found: " + path);
    }
    this.setValuesInternal(
      path,
      value,
      "initial",
      {
        invokeEffect: true,
        invokeOnChange: true,
      },
      true,
      (node) => {
        return node.source !== "user";
      }
    );
    this.plainCacheManager.rebuild();
    if (!shouldDirty) {
      this._initialValue = this.plainCacheManager.finalData.validatData;
    }
    this.dirtyValueCacheManager.rebuild();
    if (!shouldDirty) {
      this.notify();
    }
  }

  private setValueInternal(
    path: FieldPath,
    value: FieldValue,
    source: FieldSource,
    option?: {
      invokeOnChange?: boolean;
      invokeEffect?: boolean;
    }
  ) {
    setMutableNode(this._mutableDataSource, path, (node, nodes) => {
      const invokeOnChange = option?.invokeOnChange;
      const invokeEffect = option?.invokeEffect ?? true;

      if (node.type !== "field") {
        throw new Error("the field is not leaf-node:" + path);
      }
      if (!node.dynamicProp) {
        return;
      }

      if (Object.is(node.dynamicProp.value, value)) {
        return false;
      }

      // 判断是否是在数组嵌套字段内部
      if (nodes.some((x) => x.type === "array")) {
        node.dynamicProp.value = value;
        node.source = source;
        // 值变更后，标记缓存
        this.plainCacheManager.updateNode(node);
        this.dirtyValueCacheManager.updateNode(node);

        // 值变化后，触发依赖该字段的规则
        const root = node.rootArrayField;
        if (root && invokeEffect) {
          this.runEffects(
            root.effect || new Set<ReactiveEffect>(),
            "value-changed",
            { changedPath: path }
          );
        }
      } else {
        if (node.type !== "field") {
          throw new Error("the field is not leaf-node:" + path);
        }
        (node as MutableFieldNode & { type: "field" }).dynamicProp.value =
          value;
        node.source = source;
        // 值变更后，标记缓存
        this.plainCacheManager.updateNode(node);
        this.dirtyValueCacheManager.updateNode(node);
        // 值变化后，触发依赖该字段的规则
        if (invokeEffect) {
          this.triggerEffectsFor(path, "value-changed");
        }
      }
      // todo 考虑删除
      this.dirtyValueCacheManager.rebuild();
      if (invokeOnChange) {
        this.onChange?.(path, value);
      }
    });
  }

  setValues(
    path: FieldPath,
    values: Record<string, any>,
    option?: {
      invokeOnChange?: boolean;
      invokeEffect?: boolean;
    },
    shouldNotify: boolean = false
  ) {
    this.setValuesInternal(path, values, "user", option);

    if (shouldNotify) {
      this.notify();
    }
  }

  private setValuesInternal(
    path: FieldPath,
    values: Record<string, any>,
    source: FieldSource,
    option?: {
      invokeOnChange?: boolean;
      invokeEffect?: boolean;
    },
    keepPrevious: boolean = true,
    filter?: (node: MutableFieldNode & { type: "field" }) => boolean
  ) {
    const triggerRules = option?.invokeEffect ?? true;

    setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
      const dfs = (
        node: MutableFieldNode,
        value:
          | string
          | boolean
          | number
          | Record<string, any>
          | undefined
          | null
      ): boolean => {
        if (node.type === "field") {
          // 如果值相同，不更新
          if (Object.is(node.dynamicProp.value, value)) {
            return false;
          }
          if (filter && filter(node) === false) {
            return false;
          }

          node.dynamicProp.value = value;
          // 设置字段来源
          if (source) {
            node.source = source;
          }

          update(node);
          this.plainCacheManager.updateNode(node);
          this.dirtyValueCacheManager.updateNode(node);
          if (triggerRules) {
            this.triggerEffectsFor(node.path.slice(1), "value-changed");
          }

          return true;
        }
        let updated = false;
        if (node.type === "object") {
          node.children.forEach((n) => {
            if (typeof value === "object" && value !== null && n.key in value) {
              if (dfs(n, value[n.key])) {
                updated = true;
              }
            } else {
              // 如果不保留上次数据，继续传undefined值，清空所有对象
              if (!keepPrevious && dfs(n, undefined)) {
                updated = true;
              }
            }
          });
        } else if (node.type === "array") {
          // 数组和对象均可
          if (typeof value !== "object" || value === null) {
            // 相当于删除数组
            value = [];
          }
          // 原地设置子节点，在现有node上更新
          // 对于新key，单独编译，对于已有key，递归更新
          const existingKeys = new Set(node.children.map((child) => child.key));

          const newKeys: string[] = [];
          Object.entries(value).forEach(([key, v]) => {
            if (existingKeys.has(key)) {
              const childNode = node.children.find(
                (child) => child.key === key
              )!;
              if (dfs(childNode, v)) {
                updated = true;
              }
            } else {
              newKeys.push(key);
            }
          });
          if (newKeys.length > 0) {
            updated = true;
          }
          const newNodes = compileArrayNode(
            Object.fromEntries(
              Object.entries(value).filter(([k, v]) => {
                return newKeys.includes(k);
              })
            ),
            {
              key: node.key,
              isArray: true,
              arraySchema: node.staticProp.schema,
            },
            node.path,
            node,
            source
          ) as MutableFieldNode & { type: "array" };

          let resultArray = [...node.children, ...newNodes.children].filter(
            (x) => {
              return (
                keepPrevious ||
                (value !== null && typeof value === "object" && x.key in value)
              );
            }
          );
          // 如果没有增加，但有删除的部分
          if (node.children.length > resultArray.length) {
            updated = true;
          }
          node.children = resultArray;
        }
        if (updated) {
          this.plainCacheManager.updateNode(node);
          this.dirtyValueCacheManager.updateNode(node);
          this.validatorCacheManager.updateNode(node);
          update(node);
        }
        return updated;
      };
      // todo 是否合适
      this.dirtyValueCacheManager.rebuild();
      return dfs(node, values);
    });

    if ((option?.invokeOnChange ?? true) && this.onChange) {
      this.plainCacheManager.rebuild();
      const node = this.findNodeByPath(path);
      let value: Record<string, any> | undefined = undefined;
      if (!node) {
        throw new Error("the field is not found:" + path);
      }
      if (node.cache.plainObj.type !== "dirty") {
        value = node.cache.plainObj.objectOnlyIncludesHidden;
      }

      this.onChange(path, value);
    }
  }

  setValidation(
    path: FieldPath,
    validator: z.ZodType,
    shouldNotify: boolean = false,
    ruleSet: string = "onChange"
  ) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type !== "field") {
      throw new Error("the field is not leaf-node:" + path);
    }

    if (ruleSet !== "onChange") {
      node.dynamicProp.validation["onChange"] = validator;
      this.validatorCacheManager.updateNode(node, ruleSet);
      return;
    }

    // TODO
    setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
      if (node.type === "field") {
        node.dynamicProp.validation[ruleSet] = validator;
        this.validatorCacheManager.updateNode(node, ruleSet);
        update(node);
      } else {
        return false;
      }

      // 检查新旧 validator 的 isOptional 状态是否不同
      const oldRequired = node.dynamicProp.required;
      const newRequired = Object.entries(node.dynamicProp.validation).some(
        ([k, v]) => !v.isOptional()
      );
      // 如果 isOptional 状态改变，标记脏
      node.dynamicProp.required = newRequired;
      return oldRequired !== newRequired;
    });
    if (shouldNotify) {
      this.notify();
    }
  }

  setRefiner(
    path: FieldPath,
    refiner: (z: ZodType) => ZodType,
    ruleSet: string = "onChange"
  ) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type === "field") {
      throw new Error("the field is a leaf-node:" + path);
    }

    if (node.dynamicProp.validationRefine === undefined) {
      node.dynamicProp.validationRefine = {};
    }

    node.dynamicProp.validationRefine[ruleSet] = refiner;
    this.validatorCacheManager.updateNode(node, ruleSet);
  }

  getNodesOnPath(path: FieldPath, containsRoot?: boolean) {
    return getNodesOnPath(this._mutableDataSource, path, containsRoot);
  }

  setAlertTip(
    path: FieldPath,
    content: React.ReactNode,
    shouldNotify: boolean = false
  ) {
    setMutableNode(this._mutableDataSource, path, (node) => {
      if (node.type !== "field") {
        throw new Error("the field is not leaf-node:" + path);
      }
      node.dynamicProp.alertTip = content;
    });
    if (shouldNotify) {
      this.notify();
    }
  }

  setControlProp(
    path: FieldPath,
    propName: string,
    propValue: any,
    shouldNotify: boolean = false
  ) {
    setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
      const dfs = (n: MutableFieldNode) => {
        if (n.type === "field") {
          if (n.dynamicProp) {
            if (n.dynamicProp.controlProp === undefined) {
              n.dynamicProp.controlProp = {};
            }
            n.dynamicProp.controlProp[propName] = propValue;
          }
          return;
        }
        if (n.children && n.children.length > 0) {
          n.children.forEach((c) => {
            dfs(c);
            update(c);
          });
        }
      };

      dfs(node);
    });
    if (shouldNotify) {
      this.notify();
    }
  }

  /**
   * 用于全量更新数组字段，如需保留数据，请使用 setValues，或 insertIntoArray，setItemOfArray
   * @param path
   * @param value
   * @param option 是否触发数组字段绑定的规则
   * @param shouldNotify
   */
  setArray(
    path: FieldPath,
    value: Record<string, any>,
    option?: { invokeEffect?: boolean },
    shouldNotify: boolean = false
  ) {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");
    if (node.type !== "array") {
      throw new Error("this field is not an array:" + path);
    }
    const schema = node.staticProp.schema;
    const newNode = compileArrayNode(
      value,
      {
        key: path[path.length - 1],
        isArray: true,
        arraySchema: schema,
      },
      ["dummy", ...path],
      node,
      "user"
    ) as MutableFieldNode & {
      type: "array";
    };

    setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
      if (node.type !== "array") {
        throw new Error("this field is not an array:" + path);
      }
      node.children = newNode.children;
    });
    this.plainCacheManager.updateNode(node);
    this.validatorCacheManager.updateNode(node);

    if (option?.invokeEffect) {
      this.triggerEffectsFor(path, "children-updated");
    }

    if (shouldNotify) {
      this.notify();
    }
  }

  /**
   * 在数组字段中指定位置插入新元素
   * @param path
   * @param value 支持批量插入，必须传入对象以指定key
   * @param position 插入位置，'before' 表示在目标之前插入，'after' 表示在目标之后插入
   * @param key 目标位置的 key，如果未指定则在开头或结尾插入
   */
  insertIntoArray(
    path: FieldPath,
    value: Record<string, any>,
    position: "before" | "after" = "before",
    key?: FieldKey,
    shouldNotify: boolean = false
  ) {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");
    if (node.type !== "array") {
      throw new Error("this field is not an array:" + path);
    }
    const schema = node.staticProp.schema;

    // newNode本身无意义，要的是它的children
    const newNode = compileArrayNode(
      value,
      {
        key: node.key,
        isArray: true,
        arraySchema: schema,
      },
      ["dummy", ...path],
      node,
      "user"
    ) as MutableFieldNode & {
      type: "array";
    };

    const targetIndex = node.children.findIndex((child) => child.key === key);

    // 根据 position 参数决定插入位置
    let insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    if (targetIndex === -1) {
      insertIndex = position === "before" ? 0 : node.children.length;
    }

    setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
      if (node.type !== "array") {
        throw new Error("this field is not an array:" + path);
      }
      node.children.splice(insertIndex, 0, ...newNode.children);
    });
    this.plainCacheManager.updateNode(node);
    this.validatorCacheManager.updateNode(node);
    if (shouldNotify) {
      this.notify();
    }
  }

  /**
   * 设置或删除数组字段中的某一项元素
   * @param path 数组节点的路径
   * @param key 要设置或删除的元素的 key
   * @param value 元素的值；如果为 undefined，则删除该元素
   */
  setItemOfArray(
    path: FieldPath,
    key: FieldKey,
    value: any,
    shouldTriggerRule: boolean = true,
    shouldNotify: boolean = false
  ) {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");
    if (node.type !== "array") {
      throw new Error("this field is not an array:" + path);
    }

    if (value === undefined) {
      // 删除元素
      const targetIndex = node.children.findIndex((child) => child.key === key);
      if (targetIndex === -1) {
        throw new Error("the target key is not found in array: " + key);
      }

      setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
        if (node.type !== "array") {
          throw new Error("this field is not an array:" + path);
        }
        node.children.splice(targetIndex, 1);
      });
    } else {
      // 设置或更新元素
      const hasKey = node.children.some((child) => child.key === key);

      if (!hasKey) {
        // key 不存在，抛出异常
        throw new Error("the node is not found: " + path + ", key: " + key);
      } else {
        // key 存在，使用 setValues 更新该元素
        this.setValues(
          path,
          { [key]: value },
          { invokeEffect: shouldTriggerRule },
          false
        );
      }
    }

    this.plainCacheManager.updateNode(node);
    this.validatorCacheManager.updateNode(node);

    if (shouldNotify) {
      this.notify();
    }
  }

  getSnapshot(): ImmutableFormState {
    return mutableNodeToImmutableNode(this._mutableDataSource);
  }

  /** 注册规则 */
  registerRule(effect: ReactiveEffect) {
    // 自动分析该副作用的依赖
    const deps: FieldPath[] = [];
    effect(
      {
        track: (path: FieldPath) => {
          void deps.push(path);
        },
        getValue: () => void 0,
        setVisible: () => void 0,
        setValue: () => void 0,
        setValues: () => void 0,
        setValuesIfUserNotModified: () => void 0,
        setValidation: () => void 0,
        setArray: () => void 0,
        setAlertTip: () => void 0,
        setControlProp: () => void 0,
        resetFields: () => void 0,
        insertIntoArray: () => void 0,
        validateField: () => Promise.resolve(),
        setIncludePolicy: () => void 0,
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
  initial() {
    this.plainCacheManager.rebuild();
    this.validatorCacheManager.rebuild();

    this.runEffects(
      new Set(
        [...this.rules].map((r) => {
          return r.fn;
        })
      ),
      "initial-run"
    );
    this.notify();
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
          ...this.formCommands,
          // 唯一多出来的函数，用于跟踪依赖
          track: (path) => this.get(path, "value"),
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
    if (!node) throw new Error("the field is not found: " + depFieldPath);
    const set = node.effect;
    if (!set) return;
    this.runEffects(set, cause, { changedPath: depFieldPath });

    // 如果节点有 rootArrayField，也触发它上面的 Effect
    if (node.rootArrayField && node.rootArrayField.effect) {
      this.runEffects(node.rootArrayField.effect, cause, {
        changedPath: depFieldPath,
      });
    }
  }

  /**
   * 获取指定节点（可选，默认根）的所有叶子节点路径
   * @param node 可选的起始节点；若不传则从表单根开始
   */
  getAllLeafPaths(node?: MutableFieldNode): FieldPath[] {
    const result: FieldPath[] = [];

    const collectLeafPaths = (n: MutableFieldNode) => {
      // 如果是叶子节点（没有子节点或子节点为空）
      if (n.type === "field") {
        result.push([...n.path.slice(1)]); // 添加当前节点的路径到结果中
      }
      // 如果有子节点，递归处理
      else if (n.children && n.children.length > 0) {
        n.children.forEach((child) => {
          collectLeafPaths(child);
        });
      }
    };

    // 从传入节点或根节点开始
    collectLeafPaths(node ?? this._mutableDataSource);
    return result;
  }

  /**
   * 获取嵌套stateStructure中所有叶子节点的数据，并保持嵌套结构
   * 全量JSON
   * @returns 保持嵌套结构的数据对象
   */
  getJSONData(path?: FieldPath): Record<string, any> {
    // 使用最终对象缓存管理器收集并返回；若无值则返回空对象
    if (path) {
      this.plainCacheManager.rebuild();
      const cache = this.findNodeByPath(path)?.cache.plainObj;
      if (cache?.type === "hasValue") {
        return cache.submitData || {};
      } else if (cache?.type === "hidden") {
        return {};
      } else {
        throw new Error("dirty value");
      }
    }
    return this.plainCacheManager.getFinalPlainObject() ?? {};
  }

  getJSONDataByPath(path: FieldPath[]): any {
    this.plainCacheManager.rebuild();
    const set = new Set<string>(
      path.map((p) => JSON.stringify(["dummy", ...p]))
    );

    const dfs = (node: MutableFieldNode): any => {
      const toString = JSON.stringify(node.path);
      if (set.has(toString)) {
        return node.cache.plainObj.type === "hasValue"
          ? node.cache.plainObj.submitData
          : undefined;
      }

      if (node.dynamicProp.visible === false) {
        return undefined;
      }

      if (node.type === "object") {
        const res: Record<string, any> = {};
        for (let child of node.children) {
          const childRes = dfs(child);
          if (childRes) {
            res[child.key] = childRes;
          }
        }
        return Object.keys(res).length > 0 ? res : undefined;
      } else if (node.type === "array") {
        const res: any[] = [];
        for (let child of node.children) {
          const childRes = dfs(child);
          if (childRes) {
            res.push(childRes);
          }
        }
        return res.length > 0 ? res : undefined;
      }
    };

    return dfs(this._mutableDataSource);
  }

  /** 校验指定路径，校验时自动带上父字段上定义的enhancer，所以可跨字段校验 */
  async validateFields(
    pathargs: FieldPath[],
    shouldNotify: boolean = false
  ): Promise<any> {
    try {
      const promises = pathargs.map((path) => {
        return this.validateField(path, true);
      });
      await Promise.all(promises);
    } finally {
      if (shouldNotify) {
        this.notify();
      }
    }
  }

  async validateField(
    path: FieldPath,
    enableEnhancer?: boolean,
    shouldNotify: boolean = false
  ): Promise<void> {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the node is not found." + path);
    }
    this.validatorCacheManager.rebuild();
    const validator = node.cache.validator;
    if (validator === "dirty") {
      throw new Error("dirty values");
    }

    const allRuleSets = Object.keys(validator);
    try {
      await Promise.all(
        allRuleSets.map((r) =>
          this.validateFieldForRuleset(path, enableEnhancer, r)
        )
      );
    } finally {
      if (shouldNotify) {
        this.notify();
      }
    }
  }

  /** 校验某一个字段，如果是一个嵌套字段，校验内部嵌套的所有可见字段；仅设置该字段的错误信息，
   * 如需触发联动的字段校验请用`registerRule`手动触发校验
   * @param enableEnhancer 是否启用祖先字段上的跨字段校验函数
   */
  validateFieldForRuleset(
    path: FieldPath,
    enableEnhancer?: boolean,
    ruleSet: string = "onChange",
    shouldNotify: boolean = false
  ): Promise<any> {
    if (this.get(path, "visible") === false) {
      return Promise.resolve();
    }
    // 在校验前先收集最终对象
    this.plainCacheManager.rebuild();
    this.validatorCacheManager.rebuild();
    let finalError: ZodError | undefined = undefined;
    if (!enableEnhancer) {
      setMutableNode(this._mutableDataSource, path, (node, _nodes, update) => {
        const validator = node.cache.validator;
        if (validator === "dirty") {
          throw new Error("dirty value");
        }
        if (validator === "hidden") {
          return false;
        }

        if (node.type === "field") {
          if (node.dynamicProp.validation[ruleSet] === undefined) {
            // 没有校验器，直接返回
            node.dynamicProp.errorMessage[ruleSet] = undefined;
            return;
          }
          // 单字段校验
          const res = node.dynamicProp.validation[ruleSet]?.safeParse(
            node.dynamicProp.value
          );
          if (res?.success) {
            node.dynamicProp.errorMessage[ruleSet] = undefined;
          } else {
            // 只保留第一个错误信息
            node.dynamicProp.errorMessage[ruleSet] = res?.error.issues.map(
              (i) => i.message
            );
            finalError = res?.error;
          }
        } else {
          if (node.cache.validator === "dirty") {
            throw new Error("dirty value");
          }
          const validation = validator[ruleSet];
          if (!validation) {
            return false;
          }
          const plainObj = node.cache.plainObj;
          if (validation.type === "hasValue" && plainObj.type === "hasValue") {
            // 校验全对象
            const value = plainObj.objectOnly;
            const validator = validation.validator;
            const res = validator.safeParse(value);

            const errorIssues = res.error?.issues;
            const errorInfo = errorIssues;

            const dfs = (node: MutableFieldNode) => {
              if (node.type === "field") {
                const info = errorInfo?.filter((e) => {
                  return isSamePath(
                    path.concat(e.path as string[]),
                    node.path.slice(1)
                  );
                });

                if (!info) {
                  node.dynamicProp.errorMessage[ruleSet] = undefined;
                } else {
                  node.dynamicProp.errorMessage[ruleSet] = info.map(
                    (i) => i.message
                  );
                }
                update(node);
                return;
              }

              for (let i of node.children) {
                dfs(i);
                update(i);
              }
            };
            dfs(node);
            if (!res.success && errorInfo) {
              finalError = new ZodError(errorInfo);
            }
          } else if (validation.type === "dirty" || plainObj.type === "dirty") {
            throw new Error("dirty value");
          }
        }
      });
    } else {
      // 从根部校验
      const value = this._mutableDataSource.cache.plainObj;
      const validator = this._mutableDataSource.cache.validator;
      if (validator === "dirty" || value.type === "dirty") {
        throw new Error("dirty value");
      }
      if (validator === "hidden") {
        return Promise.resolve();
      }
      const validation = validator[ruleSet];
      if (!validation) {
        return Promise.resolve();
      }
      if (value.type === "hasValue" && validation.type === "hasValue") {
        const res = validation.validator.safeParse(value.objectOnly);
        const info = res.success
          ? undefined
          : res.error.issues.filter((e) =>
              isChildNode(e.path as string[], path)
            );

        setMutableNode(
          this._mutableDataSource,
          path,
          (node, _nodes, mutate) => {
            const dfs = (node: MutableFieldNode): boolean => {
              if (node.type === "field") {
                if (isChildNode(node.path.slice(1), path)) {
                  const msg = info?.filter((x) => {
                    return isSamePath(x.path as string[], node.path.slice(1));
                  });
                  node.dynamicProp.errorMessage[ruleSet] = msg?.map(
                    (i) => i.message
                  );
                  mutate(node);
                  return true;
                }
                return false;
              }

              let hasMutate = false;
              for (let i of node.children) {
                if (dfs(i)) {
                  mutate(i);
                  hasMutate = true;
                }
              }
              return hasMutate;
            };
            dfs(node);
          }
        );
        if (!res.success && info && info.length > 0) {
          finalError = new ZodError(info);
        }
      } else {
        throw new Error("dirty value");
      }
    }
    if (shouldNotify) {
      this.notify();
    }

    if (!finalError) return Promise.resolve();
    else return Promise.reject(finalError);
  }

  async validateAllFields(): Promise<any> {
    // 在校验前先收集最终对象
    try {
      await this.validateField([], false);
    } finally {
      this.notify();
    }
  }

  /**
   * 重置指定路径下的所有字段为默认值
   * @param path 要重置的路径，省略则从根节点开始重置全部字段
   * @param shouldNotify 是否触发通知，默认为 true
   */
  resetFields(path?: FieldPath, shouldNotify: boolean = true) {
    const targetPath = path || [];
    const node = this.findNodeByPath(targetPath);
    const nodes = this.getNodesOnPath(targetPath, true);

    if (!node || !nodes) {
      throw new Error("the field is not found: " + targetPath.join("."));
    }
    const res = getPlainObject(this._initialValue, nodes);

    // 改成undefined并不意味着就不是dirty了，如果初始值对象中该字段是不存在的，那么还是dirty，
    // 仅在这里reset无效，如果该字段可见性是依靠其他字段的值确定的，那么这个字段自然会被删除，
    // 这时候无论该值设置什么都无所谓了，需要用户定义的规则完备
    const initialValue = res.hasValue ? res.value : undefined;

    this.setValuesInternal(
      targetPath,
      initialValue,
      "source",
      {
        invokeOnChange: true,
      },
      true
    );

    // 重建缓存
    this.plainCacheManager.rebuild();
    this.validatorCacheManager.rebuild();

    if (shouldNotify) {
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
  LeafDynamicProp as FieldState,
  ControlType,
  MutableFieldNode,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
};
