// ----------------------------- 内部模型层 -----------------------------
import { z, ZodType, ZodError } from "zod";
import { ComponentType } from "react";
import { mutableNodeToImmutableNode, setMutableNode } from "./immutableHelper";
import { PlainObjectCacheManager } from "./plainObjectCacheManager";
import { ValidatorCacheManager } from "./validatorCacheManager";
import {
  FieldValue,
  FieldSchema,
  LeafDynamicProp,
  FieldPath,
  MutableFieldNode,
  FieldType,
  FieldKey,
  ControlType,
  ImmutableFormState,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
  ReactiveRule,
} from "./type";
import { isChildNode, isSamePath } from "./helper";
import { NextDataPathnameNormalizer } from "next/dist/server/future/normalizers/request/next-data";

type FieldProp = {
  children: FieldSchema[];
} & LeafDynamicProp;

interface FormSchema {
  fields: FieldSchema[];
}

export function getNodesOnPath(
  mutableModel: MutableFieldNode,
  path: FieldPath,
  containsRoot?: boolean
): MutableFieldNode[] | undefined {
  const nodes: MutableFieldNode[] = [];
  if (!path || path.length === 0) return undefined;

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

function compileOneNode(
  item: FieldSchema,
  path: FieldPath,
  currentVersion: number
): MutableFieldNode {
  if (item.isArray) {
    return {
      key: item.key,
      path: path,
      type: "array",
      dynamicProp: {},
      children: [],
      snapshot: {
        version: currentVersion,
        lastValue: null,
      },
      effect: new Set(),
      cache: { plainObj: { type: "dirty" }, validator: { type: "dirty" } },
    };
  } else if (item.childrenFields && item.childrenFields?.length > 0) {
    return {
      key: item.key,
      path: path,
      type: "object",
      dynamicProp: {},
      snapshot: {
        version: currentVersion,
        lastValue: null,
      },
      children: [],
      cache: { plainObj: { type: "dirty" }, validator: { type: "dirty" } },
    };
  } else {
    return {
      key: item.key,
      path: path,
      type: "field",
      dynamicProp: {
        value: item.defaultValue,
        visible: item.initialVisible ?? true,
        options: item.options ?? [],
        validation:
          item.validate || z.unknown().nonoptional({ message: "请填写！" }),
        disabled: item.disabled ?? false,
        controlProp: item.itemProps,
      },
      staticProp: {
        label: item.label || "未命名",
        helpTip: item.helpTip,
        control: item.control || "input",
      },
      snapshot: {
        version: currentVersion,
        lastValue: null,
      },
      effect: new Set(),
      cache: { plainObj: { type: "dirty" }, validator: { type: "dirty" } },
    };
  }
}

const compileNodes = (
  schema: FieldSchema,
  cur: MutableFieldNode & { type: "object" | "array" },
  seenPath: FieldPath,
  currentVersion: number,
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

  for (let item of schema.childrenFields || []) {
    const newNode: MutableFieldNode = compileOneNode(
      item,
      [...seenPath, item.key],
      currentVersion
    );

    if (newNode.type !== "field") {
      compileNodes(
        item,
        newNode,
        [...seenPath, item.key],
        currentVersion,
        root
      );
    }

    cur.children.push(newNode);
  }
};

/** 内部对象：管理值与可见性、规则注册与触发 */
class FormModel {
  /** 可变数据源，包括了所有生成表单所需的信息 */
  private mutableDataSource: MutableFieldNode & { type: "object" };

  /** 最终对象缓存管理器 */
  private plainCacheManager!: PlainObjectCacheManager;

  /** 校验器缓存管理器 */
  private validatorCacheManager!: ValidatorCacheManager;

  /** 最近一次收集到的最终对象 */
  private lastFinalPlainObj?: Record<string, any>;

  private currentVersion: number;

  private listeners = new Set<(stateSchema: MutableFieldNode[]) => void>();

  private rules: Set<ReactiveRule> = new Set();

  public onChange?: (path: FieldPath, value: FieldValue) => void;

  constructor(schema: FormSchema) {
    // schema是一个递归结构，接下来将schema转换为stateStructure
    // 此处使用虚拟根结点，用于简化代码，这样就不需要手动复制树的第一层了
    this.mutableDataSource = {
      key: "dummy",
      path: ["dummy"],
      type: "object",
      children: [],
      dynamicProp: {},
      snapshot: { version: 0, lastValue: null },
      cache: { plainObj: { type: "dirty" }, validator: { type: "dirty" } },
    };

    // 复制结点，从原始数据到内部带有State和Schema的结构化数据
    compileNodes(
      {
        childrenFields: schema.fields,
        key: "",
      },
      this.mutableDataSource,
      [],
      0
    );

    this.currentVersion = 0;

    // 初始化最终对象缓存管理器
    this.plainCacheManager = new PlainObjectCacheManager(
      this.mutableDataSource
    );

    // 初始化校验器缓存管理器
    this.validatorCacheManager = new ValidatorCacheManager(
      this.mutableDataSource
    );

    this.plainCacheManager.rebuild();
    this.validatorCacheManager.rebuild();
  }

  public findNodeByPath(path: FieldPath): MutableFieldNode | undefined {
    if (path.length === 0) {
      return this.mutableDataSource;
    }

    let curObj: MutableFieldNode | undefined = this.mutableDataSource;
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
    for (const fn of this.listeners) fn(this.mutableDataSource.children);
    this.currentVersion++;
  }

  get(path: FieldPath, prop: "value" | "errorMessage" | "visible"): any {
    const node = this.findNodeByPath(path);
    if (!node) throw new Error("the field is not found");

    if (!node.dynamicProp) {
      throw new Error("node has no state: " + path.join("."));
    }
    // 对于非叶子节点，如果要获取value，返回undefined或者抛出错误
    if (node.type === "array") {
      return node.children;
    } else if (node.type === "field") {
      return node.dynamicProp[prop];
    } else {
      throw new Error(
        `cannot get ${prop} from non-leaf node: ` + path.join(".")
      );
    }
  }

  setVisible(path: FieldPath, visible: boolean) {
    const dfs = (
      node: MutableFieldNode,
      update: (node: MutableFieldNode) => void
    ) => {
      if (node.type === "field") {
        node.dynamicProp!.visible = visible;
        // 可见性变更后，标记缓存
        this.plainCacheManager.updateNode(node);
        this.validatorCacheManager.updateNode(node);
        update(node);
        return;
      }

      for (let i of node.children) {
        dfs(i, update);
        update(i);
      }
    };

    setMutableNode(
      this.mutableDataSource,
      path,
      (node, _path, update) => {
        dfs(node, update);
      },
      this.currentVersion
    );

    this.validatorCacheManager.rebuild();
    this.plainCacheManager.rebuild();
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
    setMutableNode(
      this.mutableDataSource,
      path,
      (node, nodes) => {
        const invokeOnChange = option?.invokeOnChange;
        const invokeEffect = option?.invokeEffect ?? true;

        if (node.type === "object") {
          throw new Error("the field is not leaf-node:" + path);
        }
        if (!node.dynamicProp) {
          return;
        }

        // 判断是否是在数组嵌套字段内部
        if (nodes.some((x) => x.type === "array")) {
          if (node.type === "array") {
            throw new Error(
              "please use updateChildren to set array field value"
            );
          } else {
            node.dynamicProp.value = value;
            // 值变更后，标记缓存
            this.plainCacheManager.updateNode(node);

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
          (node as MutableFieldNode & { type: "field" }).dynamicProp.value =
            value;
          // 值变更后，标记缓存
          this.plainCacheManager.updateNode(node);
          // 值变化后，触发依赖该字段的规则
          if (invokeEffect) {
            this.triggerEffectsFor(path, "value-changed");
          }
        }
        if (invokeOnChange) {
          this.onChange?.(path, value);
        }
      },
      this.currentVersion
    );

    this.notify();
  }

  setValidation(path: FieldPath, validator: z.ZodType) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type !== "field") {
      throw new Error("the field is not leaf-node:" + path);
    }

    node.dynamicProp.validation = validator;
    this.validatorCacheManager.updateNode(node);
  }

  setRefiner(path: FieldPath, refiner: (z: ZodType) => ZodType) {
    const node = this.findNodeByPath(path);
    if (!node) {
      throw new Error("the field is not found:" + path);
    }
    if (node.type === "field") {
      throw new Error("the field is a leaf-node:" + path);
    }

    node.dynamicProp.validationRefine = refiner;
    this.validatorCacheManager.updateNode(node);
  }

  getNodesOnPath(path: FieldPath, containsRoot?: boolean) {
    return getNodesOnPath(this.mutableDataSource, path, containsRoot);
  }

  setAlertTip(path: FieldPath, content: React.ReactNode) {
    setMutableNode(
      this.mutableDataSource,
      path,
      (node) => {
        if (node.type !== "field") {
          throw new Error("the field is not leaf-node:" + path);
        }
        node.dynamicProp.alertTip = content;
        this.notify();
      },
      this.currentVersion
    );
  }

  testSet(path: FieldPath) {
    const nodes = this.getNodesOnPath(path, true) || [];
    nodes.forEach((value) => {
      value.snapshot.version = this.currentVersion;
    });
  }

  testGetSnapshot() {
    const res = mutableNodeToImmutableNode(
      this.mutableDataSource,
      this.currentVersion
    );
    this.currentVersion++;
    return res;
  }

  setDisable(path: FieldPath, isDisable: boolean) {
    setMutableNode(
      this.mutableDataSource,
      path,
      (node, _nodes, update) => {
        const dfs = (n: MutableFieldNode) => {
          if (n.type === "field") {
            if (n.dynamicProp) {
              n.dynamicProp.disabled = isDisable;
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
      },
      this.currentVersion
    );
  }

  getSnapshot(): ImmutableFormState {
    const res = mutableNodeToImmutableNode(
      this.mutableDataSource,
      this.currentVersion
    );
    this.currentVersion++;
    return res;
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
          updateChildren: (path, chilren, option) => {
            throw new Error("not implemented");
          },
          // this.updateChildren(path, chilren, option),
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
   * 获取指定节点（可选，默认根）的所有叶子节点路径
   * @param node 可选的起始节点；若不传则从表单根开始
   */
  getAllLeafPaths(node?: MutableFieldNode): FieldPath[] {
    const result: FieldPath[] = [];

    const collectLeafPaths = (n: MutableFieldNode) => {
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
    collectLeafPaths(node ?? this.mutableDataSource);
    return result;
  }

  /**
   * 获取嵌套stateStructure中所有叶子节点的数据，并保持嵌套结构
   * 全量JSON
   * @returns 保持嵌套结构的数据对象
   */
  getJSONData(): Record<string, any> {
    // 使用最终对象缓存管理器收集并返回；若无值则返回空对象
    return this.plainCacheManager.getFinalPlainObject() ?? {};
  }

  /** 校验指定路径，校验时自动带上父字段上定义的enhancer，可跨字段校验 */
  validateFieldsWithEnhancer(pathargs: FieldPath[]): Promise<any> {
    // 在校验前先收集最终对象
    this.lastFinalPlainObj = this.plainCacheManager.getFinalPlainObject(false);
    throw new Error("Method not implemented.");
  }

  /** 校验某一个字段，如果是一个嵌套字段，校验内部嵌套的所有可见字段
   * @param enableEnhancer 是否启用祖先字段上的跨字段校验函数
   */
  validateField(path: FieldPath, enableEnhancer?: boolean): Promise<any> {
    // 在校验前先收集最终对象
    this.plainCacheManager.rebuild();
    this.validatorCacheManager.rebuild();
    let finalError = undefined;
    if (!enableEnhancer) {
      setMutableNode(
        this.mutableDataSource,
        path,
        (node, _nodes, update) => {
          if (node.type === "field") {
            const res = node.dynamicProp.validation?.safeParse(
              node.dynamicProp.value
            );
            if (res?.success) {
              node.dynamicProp.errorMessage = undefined;
            } else {
              node.dynamicProp.errorMessage = res?.error.message;
              finalError = res?.error;
            }
          } else {
            const validation = node.cache.validator;
            const plainObj = node.cache.plainObj;
            if (
              validation.type === "hasValue" &&
              plainObj.type === "hasValue"
            ) {
              const value = plainObj.validateData;
              const validator = validation.validator;
              const res = validator.safeParse(value);

              const errorInfo = res.error?.issues;
              const dfs = (node: MutableFieldNode) => {
                if (node.type === "field") {
                  const info = errorInfo?.find((e) => {
                    return isSamePath(
                      path.concat(e.path as string[]),
                      node.path
                    );
                  });
                  if (!info) {
                    node.dynamicProp.errorMessage = undefined;
                  } else {
                    node.dynamicProp.errorMessage = info.message;
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
              if (!res.success) {
                finalError = res.error;
              }
            } else if (
              validation.type === "dirty" ||
              plainObj.type === "dirty"
            ) {
              throw new Error("dirty value");
            }
          }
        },
        this.currentVersion
      );
    } else {
      // 从根部校验
      const value = this.mutableDataSource.cache.plainObj;
      const validation = this.mutableDataSource.cache.validator;
      if (value.type === "hasValue" && validation.type === "hasValue") {
        const res = validation.validator.safeParse(value.validateData);
        console.log(res);

        const info = res.success
          ? undefined
          : res.error.issues.filter((e) =>
              isChildNode(e.path as string[], path)
            );

        setMutableNode(
          this.mutableDataSource,
          path,
          (node, _nodes, update) => {
            const dfs = (node: MutableFieldNode) => {
              if (node.type === "field") {
                if (isChildNode(node.path, path)) {
                  const msg = info?.find((x) =>
                    isSamePath(x.path as string[], node.path)
                  )?.message;
                  node.dynamicProp.errorMessage = msg;
                  update(node);
                }
                return;
              }

              for (let i of node.children) {
                dfs(i);
                update(i);
              }
            };
            dfs(node);
          },
          this.currentVersion
        );
        if (!res.success) {
          finalError = res.error;
        }
      } else if (value.type === "dirty" || validation.type === "dirty") {
        throw new Error("dirty value");
      }
    }

    if (!finalError) return Promise.resolve();
    else return Promise.reject(finalError);
  }

  validateAllFields(enhancer?: (schema: ZodType) => ZodType): Promise<any> {
    // 在校验前先收集最终对象
    this.lastFinalPlainObj = this.plainCacheManager.getFinalPlainObject();
    throw new Error("Method not implemented.");
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
