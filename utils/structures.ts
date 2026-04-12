// ----------------------------- 内部模型层 -----------------------------
import { z, ZodType, ZodError } from "zod";
import {
  markMutableNodeDirty,
  mutableNodeToImmutableNode,
  setMutableNode,
} from "./immutableHelper";
import { PlainObjectCacheManager } from "./plainObjectCacheManager";
import { ValidatorCacheManager } from "./validatorCacheManager";
import {
  FieldValue,
  FieldSchema,
  LeafFieldDynamicProp,
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
  FieldSource,
  ValueMergeStrategy,
  InitialValueObject,
  FieldType,
  AnyMutableFieldNode,
} from "./type";
import {
  compileArrayMutableNode,
  compileOneMutableNode,
  isChildNode,
  isSamePath,
} from "./helper";
import { compareNodeDirty, DirtyManager } from "./dirtyManager";
import { SubscribeNode } from "./subscribeType";
import { SubscribeManager } from "./subscribeManager";
import {
  setNodeHasNoValue,
  setNodeValueOnChain,
  setNodeValue,
} from "./nodeValueGetterHelper";
import { root } from "postcss";

interface FormSchema {
  fields: FieldSchema[];
}

/**
 * 获取一个节点路径上的所有节点
 * @param root 可变表单对象模型
 * @param path 不包含根节点的路径
 * @param containsRoot 返回的节点数组是否包含根节点
 * @returns
 */
export function getNodesOnPath(
  root: AnyMutableFieldNode,
  path: FieldPath,
  containsRoot?: boolean,
): AnyMutableFieldNode[] | undefined {
  const nodes: AnyMutableFieldNode[] = [];
  if (!path) return undefined;

  let current: AnyMutableFieldNode | undefined = root;
  if (containsRoot) {
    nodes.push(current);
  }
  for (let i = 0; i < path.length; i++) {
    if (!current) return undefined;
    if (current.type === "field") return undefined;

    const nextNode: AnyMutableFieldNode | undefined = current.children.find(
      (child) => child.key === path[i],
    );
    if (!nextNode) return undefined;
    nodes.push(nextNode);
    current = nextNode;
  }
  return nodes;
}

const initialNodes = (
  schema: FieldSchema & { isArray: false; childrenFields: FieldSchema[] },
  cur: MutableFieldNode<"object" | "array">,
  seenPath: FieldPath,
  rootArrayField?: MutableFieldNode<"array">,
) => {
  let root = rootArrayField;
  // 设置根数组节点的逻辑
  if (root) {
    cur.rootArrayField = root;
  }
  if (schema.isArray && !root && cur.type === "array") {
    root = cur;
  }

  for (let schemaItem of schema.childrenFields || []) {
    const newNode = compileOneMutableNode(
      schemaItem,
      [...seenPath, schemaItem.key],
      cur,
    );

    if (
      newNode.type === "object" &&
      "isArray" in schemaItem &&
      schemaItem["isArray"] === false
    ) {
      initialNodes(schemaItem, newNode, [...seenPath, schemaItem.key], root);
    } else {
      // 否则是叶子结点不需要继续递归
    }

    cur.children.push(newNode);
  }
};

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  /** 可变数据源，包括了所有生成表单所需的信息 */
  private mutableDataSource: MutableFieldNode<"object">;

  /** 最终对象缓存管理器 */
  private plainCacheManager: PlainObjectCacheManager;

  /** 校验器缓存管理器 */
  private validatorCacheManager: ValidatorCacheManager;

  /** 字段脏状态缓存管理器 */
  private dirtyValueCacheManager: DirtyManager;

  /** 精细发布订阅管理器 */
  private subscribeManager: SubscribeManager;

  private listeners = new Set<() => void>();

  private rules: Set<ReactiveRule> = new Set();

  public formCommands: FormCommands = {
    getValue: (path: FieldPath) => this.get(path, "value"),
    setValue: (
      path: FieldPath,
      values: Record<string, any>,
      option?,
      keepStrategy?: ValueMergeStrategy,
    ) => this.setValue(path, values, option, keepStrategy, true),
    setVisible: (path: FieldPath, visible: boolean) =>
      this.setVisible(path, visible, true),
    setAlertTip: (path: FieldPath, alertTip: React.ReactNode) =>
      this.setAlertTip(path, alertTip, true),
    resetField: (path?: FieldPath) => this.resetField(path),
    setValidation: (path: FieldPath, validator: ZodType, ruleSet?: string) =>
      this.setValidation(path, validator, true, ruleSet ?? "onChange"),
    insertIntoArray: (
      path: FieldPath,
      value: Record<string, any>,
      key?: string,
      position?: "before" | "after",
    ) => this.insertIntoArray(path, value, position, key, true),
    setControlProp: (path: FieldPath, propName: string, propValue: any) =>
      this.setControlProp(path, propName, propValue, true),
    validateField: (
      path: FieldPath,
      enableEnhancer: boolean,
      ruleSet?: string,
    ) => this.validateFieldForRuleset(path, enableEnhancer, ruleSet, true),
  };

  constructor(schema: FormSchema) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    let d: MutableFieldNode<"object"> = {
      key: "dummy",
      path: ["dummy"],
      type: "object",
      children: [],
      dynamicProp: {
        visible: true,
        include: true,
        removeWhenNoChildren: false,
      },
      staticProp: {},
      snapshot: { dirty: true },
      cache: {
        plainObj: {
          lastValue: { include: false },
          type: "dirty",
          validateData: undefined,
          submitData: undefined,
        },
        validator: "dirty",
        selfDirty: false,
      },
      parent: undefined,
    };

    this.mutableDataSource = d;

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    initialNodes(
      {
        childrenFields: schema.fields,
        key: "",
        isArray: false,
      },
      this.mutableDataSource,
      ["dummy"],
    );

    // 初始化最终对象缓存管理器
    this.plainCacheManager = new PlainObjectCacheManager(
      this.mutableDataSource,
    );
    this.plainCacheManager.rebuild(this.mutableDataSource);

    // 初始化校验器缓存管理器
    this.validatorCacheManager = new ValidatorCacheManager(
      this.mutableDataSource,
    );

    // 初始化订阅管理器
    this.subscribeManager = new SubscribeManager();

    // 初始化字段脏状态缓存管理器
    // 初始化时将可变字段树中的数据置为默认值
    this.dirtyValueCacheManager = new DirtyManager(
      this.mutableDataSource,
      this.subscribeManager,
    );

    this.validatorCacheManager.rebuild();
  }

  /**
   * 输入路径，寻找可变节点
   * @param path 不包含dummy的路径
   * @returns 可变节点引用
   */
  public findNodeByPath(path: FieldPath): AnyMutableFieldNode | undefined {
    return FormModel.findNodeByPath(this.mutableDataSource, path);
  }

  /**
   * 输入路径，寻找可变节点（静态方法）
   * @param root 根节点
   * @param path 不包含dummy的路径
   * @returns 可变节点引用
   */
  public static findNodeByPath(
    root: AnyMutableFieldNode,
    path: FieldPath,
  ): AnyMutableFieldNode | undefined {
    if (path.length === 0) {
      return root;
    }

    let curObj: AnyMutableFieldNode | undefined = root;
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

  /**
   * 未来计划交给subscribeManager
   */
  private notify() {
    for (const fn of this.listeners) fn();
  }

  onValueChange(path: FieldPath, onChange: (value: any) => void) {
    this.subscribeManager.subscribe(path, "value", onChange);

    return () => this.subscribeManager.unsubscribe(path, "value", onChange);
  }

  onDirtyChange(path: FieldPath, onChange: (dirty: boolean) => void) {
    this.subscribeManager.subscribe(path, "dirty", onChange);

    return () => this.subscribeManager.unsubscribe(path, "dirty", onChange);
  }

  get(path: FieldPath, prop: "value" | "errorMessage" | "visible"): any {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found: " + path);

    if (!node.dynamicProp) {
      throw new Error("node has no state: " + path.join("."));
    }
    // 对于非叶子节点，如果要获取value，返回undefined或者抛出错误
    if (node.type === "array") {
      this.plainCacheManager.rebuild(this.mutableDataSource);
      if (node.cache.plainObj.type === "dirty") {
        return {};
      } else {
        return (
          node.cache.plainObj.type === "ready" &&
          node.cache.plainObj.validateData
        );
      }
    } else if (node.type === "field") {
      return node.dynamicProp[prop];
    } else {
      if (prop === "visible") {
        const nodes = getNodesOnPath(this.mutableDataSource, path, true);
        return nodes!.every((n) => n.dynamicProp.visible) ?? false;
      }
      throw new Error(
        `cannot get ${prop} from non-leaf node: ` + path.join("."),
      );
    }
  }

  /**
   * 将指定路径当前值设置为初始值（用于 dirty 比较基线）
   * @param path 字段路径，默认为根路径
   * @param shouldNotify 是否触发订阅通知
   */
  setCurrentAsInitialValue(
    path: FieldPath = [],
    shouldNotify: boolean = false,
  ) {
    const field = this.findNodeByPath(path);
    if (!field) {
      throw new Error("the field is not found: " + path);
    }

    this.plainCacheManager.rebuild(this.mutableDataSource);
    const plainObj = field.cache.plainObj;
    if (plainObj.type === "dirty") {
      throw new Error("dirty value");
    }
    if (plainObj.type === "void") {
      this.dirtyValueCacheManager.setInitialValue(
        path,
        {
          include: false,
        },
        (sub, dirty) => {
          this.subscribeManager.setNewValue(sub, "dirty", dirty);
        },
      );
    } else {
      this.dirtyValueCacheManager.setInitialValue(
        path,
        {
          include: true,
          value: plainObj.validateData,
        },
        (sub, dirty) => {
          this.subscribeManager.setNewValue(sub, "dirty", dirty);
        },
      );
    }

    if (shouldNotify) {
      this.notify();
    }
  }

  /**
   * 将用户指定值设置为指定路径的初始值（用于 dirty 比较基线）
   * @param path 字段路径，默认为根路径
   * @param initialValue 指定的初始值
   * @param shouldNotify 是否触发订阅通知
   */
  setInitialValueByValue(
    path: FieldPath = [],
    initialValue: any,
    shouldNotify: boolean = false,
  ) {
    this.dirtyValueCacheManager.setInitialValue(
      path,
      {
        include: true,
        value: initialValue,
      },
      (sub, dirty) => {
        this.subscribeManager.setNewValue(sub, "dirty", dirty);
      },
    );

    if (shouldNotify) {
      this.notify();
    }
  }

  setVisible(
    path: FieldPath,
    visible: boolean,
    setIsInclude: boolean = true,
    shouldNotify = false,
  ) {
    setMutableNode(this.mutableDataSource, path, (node) => {
      let newIncludeValue = node.dynamicProp.include;
      if (setIsInclude) {
        newIncludeValue = visible;
      }
      if (
        Object.is(node.dynamicProp.visible, visible) &&
        Object.is(node.dynamicProp.include, newIncludeValue)
      ) {
        return false;
      }

      node.dynamicProp.visible = visible;

      if (setIsInclude) {
        this.updateNodeIncludeState(node, newIncludeValue);
      }
    });
    if (shouldNotify) {
      this.notify();
    }
  }

  /**
   * 更新节点的 include 状态并级联更新父节点链
   * @param node 要更新的节点
   * @param include 新的 include 值
   */
  private updateNodeIncludeState(node: AnyMutableFieldNode, include: boolean) {
    // 如果是true，仍有可能设置整条链，不能省略
    if (node.dynamicProp.include === include && include === false) {
      return;
    }
    node.dynamicProp.include = include;
    if (include === false) {
      // 需要处理removeWhen字段
      let cur = node.parent;
      while (cur) {
        const condition =
          cur.dynamicProp.removeWhenNoChildren && cur.dynamicProp.include;
        if (condition) {
          const count = cur.children.filter(
            (x) => x.dynamicProp.include,
          ).length;
          if (count === 0) {
            cur.dynamicProp.include = false;
          }
        } else {
          break;
        }
        cur = cur.parent;
      }
    } else {
      // 需要设置整条链
      let cur = node.parent;
      while (cur) {
        cur.dynamicProp.include = true;

        cur = cur.parent;
      }
    }

    // 所有的update都是顺着祖先链，所以只需要更新当前节点
    this.validatorCacheManager.updateNode(node);
    this.plainCacheManager.updateNode(node);
    this.dirtyValueCacheManager.updateNode(node);
  }

  setInclude(path: FieldPath, include: boolean) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    {
      const pa = node.parent;
      if (pa?.type === "array") {
        throw new Error("can not set include for child node of array node.");
      }
    }

    this.updateNodeIncludeState(node, include);
    setMutableNode(this.mutableDataSource, path, () => {});
    this.notify();
  }

  setValue(
    path: FieldPath,
    values: Record<string, any>,
    option?: {
      invokeEffect?: boolean;
    },
    keepStrategy?: ValueMergeStrategy,
    shouldNotify: boolean = false,
  ) {
    this.setValuesInternal(path, values, "user", option, keepStrategy);

    if (shouldNotify) {
      this.notify();
    }

    this.subscribeManager.notify();
  }

  private setValuesInternal(
    path: FieldPath,
    values: Record<string, any>,
    source: FieldSource,
    option?: {
      invokeEffect?: boolean;
    },
    keepStrategy: ValueMergeStrategy = "merge",
  ) {
    const triggerRules = option?.invokeEffect ?? true;
    const initialValue = this.dirtyValueCacheManager.findInitialValue(path);
    const keepPrevious = keepStrategy === "merge";

    setMutableNode(this.mutableDataSource, path, (node, _nodes, update) => {
      const dfs = (
        node: AnyMutableFieldNode,
        value: any,
        initial: InitialValueObject | undefined,
        subscribeNode: SubscribeNode | undefined,
        currentEffInclude: boolean,
        initialEffInclude: boolean,
      ): boolean => {
        let valueUpdated = false;
        let structureUpdated = false;
        if (node.type === "field") {
          // 如果值相同，不更新
          if (Object.is(node.dynamicProp.value, value)) {
            return false;
          }

          node.dynamicProp.value = value;
          // 设置字段来源
          if (source) {
            node.source = source;
          }

          valueUpdated = true;
        }
        if (node.type === "object") {
          if (initial && initial?.type !== "object") {
            throw new Error("type error");
          }
          node.children.forEach((n) => {
            const childInitial = initial?.children.find((x) => x.key === n.key);
            if (typeof value === "object" && value !== null && n.key in value) {
              if (
                dfs(
                  n,
                  value[n.key],
                  childInitial,
                  subscribeNode?.children.get(n.key),
                  currentEffInclude && n.dynamicProp.include,
                  initialEffInclude && (childInitial?.include ?? false),
                )
              ) {
                valueUpdated = true;
              }
            } else {
              // 如果不保留上次数据，继续传undefined值，清空所有对象
              if (
                !keepPrevious &&
                dfs(
                  n,
                  undefined,
                  childInitial,
                  subscribeNode?.children.get(n.key),
                  currentEffInclude && n.dynamicProp.include,
                  initialEffInclude && (childInitial?.include ?? false),
                )
              ) {
                valueUpdated = true;
              }
            }
          });
        }
        if (node.type === "array") {
          if (initial && initial?.type !== "array") {
            throw new Error("type error");
          }

          // 数组和对象均可
          const objValue: Record<string, any> =
            typeof value !== "object" || !value ? [] : value;

          // 原地设置子节点，在现有node上更新
          // 对于新key，单独编译，对于已有key，递归更新
          const map = new Map(node.children.map((child) => [child.key, child]));

          // 原先不存在，新加进来的key
          const newKeys: string[] = [];
          // 原先存在，被删除的key
          const delNodes: AnyMutableFieldNode[] = [];
          Object.entries(objValue).forEach(([key, v]) => {
            const childNode = map.get(key);
            const childInitial = initial?.children.find((x) => x.key === key);
            if (childNode) {
              if (
                dfs(
                  childNode,
                  v,
                  childInitial,
                  subscribeNode?.children.get(key),
                  currentEffInclude && childNode.dynamicProp.include,
                  initialEffInclude && (childInitial?.include ?? false),
                )
              ) {
                valueUpdated = true;
              }
            } else {
              newKeys.push(key);
            }
          });

          for (let item of map) {
            if (!Object.hasOwn(value, item[0])) {
              delNodes.push(item[1]);
            }
          }

          if (newKeys.length > 0) {
            structureUpdated = true;
          }

          const newNodes: AnyMutableFieldNode[] = newKeys.map((key) => {
            const childValue = objValue[key];
            return compileArrayMutableNode(
              childValue,
              { ...node.staticProp.schema, key },
              node.path.concat(key),
              // 在node下新增数组
              node.rootArrayField || node,
              source,
              node,
            );
          });

          // 对新增/删除的节点，额外通知值变化
          const notifyNodeTree = (
            fieldNode: AnyMutableFieldNode,
            subscribeNode: SubscribeNode | undefined,
            initial: InitialValueObject | undefined,
            del: boolean,
            currentEffInclude: boolean,
            initialEffInclude: boolean,
          ) => {
            if (!subscribeNode) {
              return;
            }

            // 通知值
            if (!del) {
              setNodeValue(
                fieldNode,
                this.subscribeManager,
                subscribeNode,
                this.plainCacheManager,
              );
            } else {
              setNodeHasNoValue(this.subscribeManager, subscribeNode);
            }

            if (fieldNode.type !== "field") {
              if (initial?.type === "field") {
                throw new Error("type is error");
              }
              fieldNode.children.forEach((childNode) => {
                const childInitial = initial?.children.find(
                  (x) => x.key === childNode.key,
                );
                notifyNodeTree(
                  childNode,
                  subscribeNode.children.get(childNode.key),
                  childInitial,
                  del,
                  currentEffInclude && childNode.dynamicProp.include,
                  initialEffInclude && (childInitial?.include ?? false),
                );
              });
            }

            fieldNode.cache.selfDirty = compareNodeDirty(
              fieldNode,
              initial ?? null,
            );

            this.subscribeManager.setNewValue(
              subscribeNode,
              "dirty",
              currentEffInclude !== initialEffInclude ||
                (currentEffInclude && fieldNode.cache.selfDirty),
            );
          };

          // 处理新增节点
          newNodes.forEach((newNode) => {
            const childInitial = initial?.children.find(
              (x) => x.key === newNode.key,
            );
            notifyNodeTree(
              newNode,
              subscribeNode?.children.get(newNode.key),
              childInitial,
              false,
              currentEffInclude && newNode.dynamicProp.include,
              initialEffInclude && (childInitial?.include ?? false),
            );
          });
          // 处理删除节点
          if (!keepPrevious) {
            delNodes.forEach((delNode) => {
              const childInitial = initial?.children.find(
                (x) => x.key === delNode.key,
              );
              notifyNodeTree(
                delNode,
                subscribeNode?.children.get(delNode.key),
                childInitial,
                true,
                currentEffInclude && delNode.dynamicProp.include,
                initialEffInclude && (childInitial?.include ?? false),
              );
            });
          }

          let resultArray = [...node.children, ...newNodes].filter((x) => {
            const hasValue =
              keepPrevious ||
              (value !== null &&
                typeof value === "object" &&
                Object.hasOwn(value, x.key));
            if (!hasValue) {
              // 一旦为假，说明原有的会删除，需要通知
              const dfs = (field: AnyMutableFieldNode, sub: SubscribeNode) => {
                if (field.type !== "field") {
                  field.children.forEach((item) => {
                    const childSub = sub.children.get(item.key);
                    if (childSub) {
                      dfs(item, childSub);
                    }
                  });
                }
                setNodeHasNoValue(this.subscribeManager, sub);
              };

              subscribeNode && dfs(node, subscribeNode);
            }
            return hasValue;
          });
          // 如果没有增加，但有删除的部分
          if (node.children.length > resultArray.length) {
            structureUpdated = true;
          }
          node.children = resultArray;
        }

        if (valueUpdated || structureUpdated) {
          // 导出对象层
          this.plainCacheManager.updateNode(node);

          // 更新selfDirty（保证了自底向上）
          node.cache.selfDirty = compareNodeDirty(node, initial ?? null);

          if (triggerRules) {
            this.triggerEffectsFor(
              node.rootArrayField ?? node,
              "value-changed",
            );
          }
          // 订阅通知
          if (subscribeNode) {
            // 通知值
            setNodeValue(
              node,
              this.subscribeManager,
              subscribeNode,
              this.plainCacheManager,
            );

            // 通知effectiveDirty
            this.subscribeManager.setNewValue(
              subscribeNode,
              "dirty",
              (currentEffInclude && node.cache.selfDirty) ||
                initialEffInclude !== currentEffInclude,
            );
          }

          // 渲染层
          update(node);
        }
        if (structureUpdated) {
          // 校验对象层
          this.validatorCacheManager.updateNode(node);

          // 渲染层
          update(node);
        }
        return valueUpdated || structureUpdated;
      };
      const subNode = this.subscribeManager.findNode(path);
      const ret = dfs(
        node,
        values,
        initialValue,
        subNode,
        FormModel.getEffIncludeValue(node),
        this.dirtyValueCacheManager.getEffIncludeValue(path),
      );
      subNode &&
        setNodeValueOnChain(
          node,
          this.subscribeManager,
          subNode,
          this.plainCacheManager,
        );
      this.dirtyValueCacheManager.updateNode(node);
      return ret;
    });
  }

  static getEffIncludeValue(node: AnyMutableFieldNode) {
    let current: AnyMutableFieldNode | undefined = node;
    while (current) {
      if (!current.dynamicProp.include) {
        return false;
      }
      current = current.parent;
    }
    return true;
  }

  setValidation(
    path: FieldPath,
    validator: z.ZodType,
    shouldNotify: boolean = false,
    ruleSet: string = "onChange",
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
      this.validatorCacheManager.updateNode(node);
      return;
    }

    // TODO
    // required
    setMutableNode(this.mutableDataSource, path, (node, _nodes, update) => {
      if (node.type === "field") {
        node.dynamicProp.validation[ruleSet] = validator;
        this.validatorCacheManager.updateNode(node);
      } else {
        return false;
      }

      // 检查新旧 validator 的 isOptional 状态是否不同
      const oldRequired = node.dynamicProp.required;
      const newRequired = Object.entries(node.dynamicProp.validation).some(
        ([k, v]) => !v.isOptional(),
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
    ruleSet: string = "onChange",
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
    this.validatorCacheManager.updateNode(node);
  }

  getNodesOnPath(path: FieldPath, containsRoot?: boolean) {
    return getNodesOnPath(this.mutableDataSource, path, containsRoot);
  }

  setAlertTip(
    path: FieldPath,
    content: React.ReactNode,
    shouldNotify: boolean = false,
  ) {
    setMutableNode(this.mutableDataSource, path, (node) => {
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
    shouldNotify: boolean = false,
  ) {
    setMutableNode(this.mutableDataSource, path, (node, _nodes, update) => {
      const dfs = (n: AnyMutableFieldNode) => {
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
    shouldNotify: boolean = false,
  ) {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");
    if (node.type !== "array") {
      throw new Error("this field is not an array:" + path);
    }
    const schema = node.staticProp.schema;

    const newNodes: AnyMutableFieldNode[] = Object.entries(value).map(
      ([k, v]) => {
        return compileArrayMutableNode(
          v,
          { ...schema, key: k },
          node.path.concat(k),
          node.rootArrayField || node,
          "user",
          node,
        );
      },
    );

    const targetIndex = node.children.findIndex((child) => child.key === key);

    // 根据 position 参数决定插入位置
    let insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    if (targetIndex === -1) {
      insertIndex = position === "before" ? 0 : node.children.length;
    }

    setMutableNode(this.mutableDataSource, path, (node, _nodes, update) => {
      if (node.type !== "array") {
        throw new Error("this field is not an array:" + path);
      }
      node.children.splice(insertIndex, 0, ...newNodes);
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
    shouldNotify: boolean = false,
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

      setMutableNode(this.mutableDataSource, path, (node, _nodes, update) => {
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
        this.setValue(
          path,
          { [key]: value },
          { invokeEffect: shouldTriggerRule },
          undefined,
          false,
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
    return mutableNodeToImmutableNode(this.mutableDataSource);
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
        setValidation: () => void 0,
        setAlertTip: () => void 0,
        setControlProp: () => void 0,
        resetField: () => void 0,
        insertIntoArray: () => void 0,
        validateField: () => Promise.resolve(),
      },
      "dependencies-collecting",
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
  }

  /** 主动触发一次全量规则（初始化时可用） */
  initial() {
    this.runEffects(
      new Set(
        [...this.rules].map((r) => {
          return r.fn;
        }),
      ),
      "initial-run",
    );
    this.plainCacheManager.rebuild(this.mutableDataSource);
    this.validatorCacheManager.rebuild();
    this.dirtyValueCacheManager.setInitialValue(
      [],
      {
        include: true,
        value: this.plainCacheManager.finalData.validateData,
      },
      (sub, dirty) => {
        this.subscribeManager.setNewValue(sub, "dirty", dirty);
      },
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
    info?: { changedPath?: FieldPath },
  ) {
    for (const effect of effects) {
      effect(
        {
          ...this.formCommands,
          // 唯一多出来的函数，用于跟踪依赖
          track: (path) => this.get(path, "value"),
        },
        cause,
        info,
      );
    }
    this.notify();
  }

  triggerEffectsFor(node: AnyMutableFieldNode, cause: EffectInvokeReason) {
    // 如果节点有 rootArrayField，禁止触发
    if (node.rootArrayField) {
      throw new Error("should not trigger the nodes which have rootArrayField");
    }

    const set = node.effect;
    if (set) {
      this.runEffects(set, cause, { changedPath: node.path });
    }
  }

  /**
   * 获取表单当前值的plain object
   * @returns 保持嵌套结构的数据对象
   */
  getJSONData(path?: FieldPath) {
    // 使用最终对象缓存管理器收集并返回；若无值则返回空对象
    if (path) {
      this.plainCacheManager.rebuild(this.mutableDataSource);
      const cache = this.findNodeByPath(path)?.cache.plainObj;
      if (cache?.type === "ready") {
        return cache.submitData;
      } else {
        throw new Error("dirty value");
      }
    }
    return this.plainCacheManager.getFinalPlainObject() ?? {};
  }

  getJSONDataByPath(path: FieldPath[]): any {
    this.plainCacheManager.rebuild(this.mutableDataSource);
    const set = new Set<string>(
      path.map((p) => JSON.stringify(["dummy", ...p])),
    );

    const dfs = (node: AnyMutableFieldNode): any => {
      const toString = JSON.stringify(node.path);
      if (node.cache.plainObj.type === "dirty") {
        throw new Error("dirty value");
      }

      if (set.has(toString)) {
        return (
          node.cache.plainObj.type === "ready" && node.cache.plainObj.submitData
        );
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

    return dfs(this.mutableDataSource);
  }

  /** 校验指定路径，校验时自动带上父字段上定义的enhancer，所以可跨字段校验 */
  async validateFields(
    pathargs: FieldPath[],
    shouldNotify: boolean = false,
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
    shouldNotify: boolean = false,
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
          this.validateFieldForRuleset(path, enableEnhancer, r),
        ),
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
    shouldNotify: boolean = false,
  ): Promise<any> {
    if (this.get(path, "visible") === false) {
      return Promise.resolve();
    }
    // 在校验前先收集最终对象
    this.plainCacheManager.rebuild(this.mutableDataSource);
    this.validatorCacheManager.rebuild();
    let finalError: ZodError | undefined = undefined;
    if (!enableEnhancer) {
      setMutableNode(this.mutableDataSource, path, (node, _nodes, mutate) => {
        const validator = node.cache.validator;
        if (validator === "dirty") {
          throw new Error("dirty value");
        }
        if (validator === "hidden") {
          return false;
        }

        if (node.type === "field") {
          const oldMsg = node.dynamicProp.errorMessage[ruleSet];

          if (node.dynamicProp.validation[ruleSet] === undefined) {
            // 没有校验器，直接返回
            if (oldMsg === undefined) {
              return false;
            }
            node.dynamicProp.errorMessage[ruleSet] = undefined;
            return;
          }
          // 单字段校验
          const res = node.dynamicProp.validation[ruleSet]?.safeParse(
            node.dynamicProp.value,
          );
          if (res?.success) {
            if (oldMsg === undefined) {
              return false;
            }
            node.dynamicProp.errorMessage[ruleSet] = undefined;
          } else {
            // 只保留第一个错误信息
            node.dynamicProp.errorMessage[ruleSet] = res?.error.issues.map(
              (i) => i.message,
            );
            finalError = res?.error;
          }
        } else {
          const plainObj = node.cache.plainObj;
          if (plainObj.type === "dirty") {
            throw new Error("dirty value");
          }
          if (node.cache.validator === "dirty") {
            throw new Error("dirty value");
          }
          const validation = validator[ruleSet];
          if (!validation) {
            return false;
          }
          if (validation.type === "hasValue" && plainObj.type !== "void") {
            // 校验全对象
            const value = plainObj.validateData;
            const validator = validation.validator;
            const res = validator.safeParse(value);

            const errorIssues = res.error?.issues;
            const errorInfo = errorIssues;

            if (!res.success && errorInfo) {
              finalError = new ZodError(errorInfo);
            }

            const dfs = (node: AnyMutableFieldNode): boolean => {
              if (node.type === "field") {
                const info = errorInfo?.filter((e) => {
                  return isSamePath(
                    path.concat(e.path as string[]),
                    node.path.slice(1),
                  );
                });

                if (!info || info.length === 0) {
                  if (node.dynamicProp.errorMessage[ruleSet] === undefined) {
                    return false;
                  }
                  node.dynamicProp.errorMessage[ruleSet] = undefined;
                } else {
                  node.dynamicProp.errorMessage[ruleSet] = info.map(
                    (i) => i.message,
                  );
                }

                mutate(node);
                return true;
              }

              let hasMutated = false;
              for (let i of node.children) {
                if (dfs(i)) {
                  mutate(node);
                  hasMutated = true;
                }
              }
              return hasMutated;
            };
            const shouldDirty = dfs(node);
            return shouldDirty;
          } else if (validation.type === "dirty") {
            throw new Error("dirty value");
          }
        }
      });
    } else {
      // 从根部校验
      const value = this.mutableDataSource.cache.plainObj;
      const validator = this.mutableDataSource.cache.validator;
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
      if (value.type !== "void" && validation.type === "hasValue") {
        const res = validation.validator.safeParse(value.validateData);
        const info = res.success
          ? undefined
          : res.error.issues.filter((e) =>
              isChildNode(e.path as string[], path),
            );

        setMutableNode(this.mutableDataSource, path, (node, _nodes, mutate) => {
          const dfs = (node: AnyMutableFieldNode): boolean => {
            if (node.type === "field") {
              if (isChildNode(node.path.slice(1), path)) {
                const msg = info?.filter((x) => {
                  return isSamePath(x.path as string[], node.path.slice(1));
                });
                if (
                  node.dynamicProp.errorMessage[ruleSet] === undefined &&
                  (msg === undefined || msg.length === 0)
                ) {
                  return false;
                } else {
                  node.dynamicProp.errorMessage[ruleSet] = msg?.map(
                    (i) => i.message,
                  );
                  mutate(node);
                  return true;
                }
              }
              return false;
            }

            let hasMutated = false;
            for (let i of node.children) {
              if (dfs(i)) {
                mutate(i);
                hasMutated = true;
              }
            }
            return hasMutated;
          };
          dfs(node);
        });
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
      await this.validateField([], true);
    } finally {
      this.notify();
    }
  }

  /**
   * 重置指定路径下的所有字段为默认值
   * @param path 要重置的路径，省略则从根节点开始重置全部字段
   * @param shouldNotify 是否触发通知，默认为 true
   */
  resetField(path?: FieldPath, shouldNotify: boolean = true) {
    const targetPath = path || [];
    const node = this.findNodeByPath(targetPath);

    if (!node) {
      throw new Error("the field is not found: " + targetPath.join("."));
    }
    this.dirtyValueCacheManager.resetField(node, (field, subNode) => {
      field && this.plainCacheManager.updateNode(field);
      field && this.validatorCacheManager.updateNode(field);
      field && markMutableNodeDirty(field);

      if (subNode) {
        field &&
          setNodeValue(
            field,
            this.subscribeManager,
            subNode,
            this.plainCacheManager,
          );

        this.subscribeManager.setNewValue(subNode, "dirty", false);
      }
      field && this.triggerEffectsFor(field, "value-changed");
    });
    // 重建缓存
    this.plainCacheManager.rebuild(this.mutableDataSource);
    this.validatorCacheManager.rebuild();

    if (shouldNotify) {
      this.notify();
      this.subscribeManager.notify();
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
  LeafFieldDynamicProp as FieldState,
  ControlType,
  MutableFieldNode,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
};
