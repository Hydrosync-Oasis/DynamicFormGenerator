import { validateHeaderName } from "http";
import { compileOneMutableNode } from "./helper";
import { markMutableNodeDirty, setMutableNode } from "./immutableHelper";
import { FormModel, getNodesOnPath } from "./structures";
import { SubscribeManager } from "./subscribeManager";
import { SubscribeNode } from "./subscribeType";
import {
  AnyMutableFieldNode,
  ArraySchema,
  FieldPath,
  FieldSchema,
  InitialValueObject,
  MutableFieldNode,
  MutableNestedFieldNode,
} from "./type";
import { fi } from "zod/locales";

/**
 * 比较两个节点在shape上是否一致，获取的dirty值是忽略祖先节点的include属性影响的
 * 嵌套节点需要先对children进行计算，再在父节点上调用本函数
 * @param current 当前值
 * @param initial 初始值
 * @returns true说明脏，false说明pristine
 */
export function compareNodeDirty(
  current: AnyMutableFieldNode,
  initial: InitialValueObject | null,
): boolean {
  if (!initial) {
    return current.dynamicProp.include;
  }

  if (current.dynamicProp.include !== initial.include) {
    return true;
  }
  if (current.type === "field") {
    if (current.type !== initial.type) {
      throw new Error("shape is incompitable");
    }

    if (current.dynamicProp.value !== initial.value) {
      return true;
    }
    return false;
  } else if (current.type === "object") {
    if (current.type !== initial.type) {
      throw new Error("shape is incompitable");
    }
    // 对象的children一定是静态的，直接聚合children的dirty
    return !current.children.every((x) => {
      return !x.cache.selfDirty;
    });
  } else {
    if (current.type !== initial.type) {
      throw new Error("shape is incompitable");
    }
    if (current.children.length !== initial.children.length) {
      return true;
    }
    for (let i in current.children) {
      if (current.children[i].key !== initial.children[i].key) {
        // 顺序不同
        return true;
      }
      if (current.children[i].cache.selfDirty) {
        return true;
      }
    }
    return false;
  }
}

// 提交的数据和初始数据是否深比较相等
export class DirtyManager {
  currentValue: MutableNestedFieldNode;
  initialValue: InitialValueObject;

  subscribeManager: SubscribeManager;

  constructor(
    currentValue: MutableNestedFieldNode,
    subscribeManager: SubscribeManager,
  ) {
    this.currentValue = currentValue;
    this.initialValue = this.getInitInitialValue();
    this.subscribeManager = subscribeManager;
  }

  /**
   * 获取没有输入数据时，获取的最初始数据结构。会自动将现有数据设置为初始值
   * @returns
   */
  private getInitInitialValue() {
    const dfs = (
      current: AnyMutableFieldNode,
      parent: InitialValueObject | undefined,
    ): InitialValueObject => {
      const key = current.key;
      const include = current.dynamicProp.include;
      if (current.type === "field") {
        return {
          type: "field",
          key,
          value: current.dynamicProp.value,
          include,
          parent: parent,
        };
      }
      if (current.type === "object") {
        const pa: InitialValueObject = {
          type: "object",
          key,
          include,
          children: [],
          parent: parent,
        };
        pa.children = current.children.map((x) => dfs(x, pa));
        return pa;
      }
      if (current.type === "array") {
        const pa: InitialValueObject = {
          type: "array",
          key,
          arraySchema: current.staticProp.arraySchema,
          include,
          children: [],
          parent: parent,
        };
        pa.children = current.children.map((x) => dfs(x, pa));
        return pa;
      }

      throw new Error("type is invalid");
    };

    return dfs(this.currentValue, undefined);
  }

  /**
   * 设置指定路径的初始值
   * @param path 要设置字段节点初始值的路径
   */
  setInitialValue(
    path: FieldPath,
    plainObject:
      | {
          include: false;
        }
      | {
          include: true;
          value: any;
        },
    notifyNodeDirtyChanged: (subNode: SubscribeNode, dirty: boolean) => void,
    // 原先的current的最终dirty，和设置完初始值的最终dirty进行比较，不相等就notify
  ) {
    // 遍历一个current节点树，要求这个current节点没有对应的initial结构
    // 用途：计算没有对应initial结构的节点的dirty值
    const dfs2 = (
      current: AnyMutableFieldNode,
      currentEffectiveInclude: boolean,
      subNode: SubscribeNode | undefined,
    ) => {
      const afterDirty = currentEffectiveInclude;
      subNode && notifyNodeDirtyChanged(subNode, afterDirty);

      current.cache.selfDirty = current.dynamicProp.include;

      if (current.type === "field") {
        return;
      }

      for (let item of current.children) {
        dfs2(
          item,
          currentEffectiveInclude && item.dynamicProp.include,
          subNode?.children?.get(item.key),
        );
      }
    };

    // 1：被fieldValue影响到的initial
    // 2：current
    // 这两个的并集都得遍历到
    const dfs = (
      fieldValue:
        | {
            hasValue: true;
            value: any;
          }
        | {
            hasValue: false;
          },
      initial: InitialValueObject,
      current: AnyMutableFieldNode | undefined,
      currentEffectiveInclude: boolean,
      initialEffInclude: boolean,
      subNode: SubscribeNode | undefined,
    ) => {
      if (initial.type === "field") {
        if (current && current.type !== "field") {
          throw new Error("shape is incompitable");
        }
        initial.include = fieldValue.hasValue;
        if (fieldValue.hasValue) {
          initial.value = fieldValue.value;
        }
        // 更新dirty信息
        if (current) {
          const newSelfDirty =
            current.dynamicProp.include !== initial.include ||
            (initial.include &&
              !Object.is(initial.value, current.dynamicProp.value));

          subNode &&
            notifyNodeDirtyChanged(
              subNode,
              currentEffectiveInclude !== initialEffInclude ||
                (currentEffectiveInclude && newSelfDirty),
            );

          current.cache.selfDirty = newSelfDirty;
        } else {
          subNode && notifyNodeDirtyChanged(subNode, initialEffInclude);
        }
      } else if (initial.type === "object") {
        initial.include = fieldValue.hasValue;
        if (current?.type && current.type !== "object") {
          throw new Error("shape is incompitable");
        }
        let childDirty = false;

        if (fieldValue.hasValue) {
          for (let item of initial.children) {
            const key = item.key;
            const childCurrent = current?.children.find((x) => x.key === key);
            dfs(
              {
                hasValue: key in fieldValue.value,
                value: fieldValue.value[key],
              },
              item,
              childCurrent,
              currentEffectiveInclude &&
                (childCurrent?.dynamicProp?.include ?? false),
              initialEffInclude || item.include,
              subNode?.children?.get(key),
            );
            if (childCurrent) {
              // 子节点的脏
              childDirty = childDirty || childCurrent.cache.selfDirty;
            } else if (current) {
              // 对象字段的子字段shape有误
              throw new Error("shape is incompitable");
            }
          }
        }
        // 更新dirty并通知
        if (current) {
          const newDirty =
            current.dynamicProp.include !== initial.include ||
            (initial.include && childDirty);

          subNode &&
            notifyNodeDirtyChanged(
              subNode,
              currentEffectiveInclude !== initialEffInclude ||
                (currentEffectiveInclude && newDirty),
            );

          current.cache.selfDirty = newDirty;
        } else {
          subNode && notifyNodeDirtyChanged(subNode, initialEffInclude);
        }
      } else {
        // 数组
        initial.include = fieldValue.hasValue;

        if (current && current.type !== "array") {
          throw new Error("shape is incompitable");
        }

        const beforeInitialMap = new Map<string, InitialValueObject>(
          initial.children.map((x) => [x.key, x]),
        );

        let childDirty = false;
        if (fieldValue.hasValue) {
          // 目前先全量编译
          const children: InitialValueObject[] = [];
          Object.entries(fieldValue.value).forEach(([key, value]) => {
            children.push(
              this.compileArrayValueToInitial(
                value,
                {
                  key: key,
                  ...initial.arraySchema,
                },
                initial,
              ),
            );
          });
          initial.children = children;

          // 替换为新initialValue
          for (let item of initial.children) {
            const currentChild = current?.children.find(
              (x) => x.key === item.key,
            );
            dfs(
              {
                hasValue: item.key in fieldValue.value,
                value: fieldValue.value[item.key],
              },
              item,
              currentChild,
              currentEffectiveInclude &&
                (currentChild?.dynamicProp?.include ?? false),
              initialEffInclude && item.include,
              subNode?.children?.get(item.key),
            );

            if (currentChild) {
              childDirty = childDirty || currentChild.cache.selfDirty;
            } else {
              childDirty = true;
            }

            // 删除新intial出现的值，剩下的全是被删除的initial
            beforeInitialMap.delete(item.key);
          }
        }

        for (let [key, oldInitialItem] of beforeInitialMap) {
          const currentChild = current?.children.find((x) => x.key === key);
          if (currentChild) {
            dfs2(
              currentChild,
              currentEffectiveInclude && currentChild.dynamicProp.include,
              subNode?.children?.get(key),
            );
          }
        }

        if (current) {
          const newDirty =
            current.dynamicProp.include !== initial.include ||
            (initial.include &&
              (childDirty ||
                current.children.length !== initial.children.length));

          subNode &&
            notifyNodeDirtyChanged(
              subNode,
              (currentEffectiveInclude && newDirty) ||
                currentEffectiveInclude !== initialEffInclude,
            );

          current.cache.selfDirty = newDirty;
        } else {
          subNode && notifyNodeDirtyChanged(subNode, initialEffInclude);
        }
      }
    };
    const current = FormModel.findNodeByPath(this.currentValue, path);
    dfs(
      {
        hasValue: plainObject.include,
        value: plainObject.include && plainObject.value,
      },
      this.findInitialValueByPath(path),
      current,
      current ? FormModel.getEffIncludeValue(current) : false,
      this.getEffIncludeValue(path),
      this.subscribeManager.findNode(path),
    );

    this.updateDirtyOnChain(path, (subNode, _field, dirty) => {
      notifyNodeDirtyChanged(subNode, dirty);
    });
  }

  updateDirtyOnChain(
    path: FieldPath,
    notifyNode: (
      subNode: SubscribeNode,
      field: AnyMutableFieldNode,
      dirty: boolean,
      effectiveInclude: boolean,
    ) => void,
  ) {
    const nodes = getNodesOnPath(this.currentValue, path, true);
    if (!nodes) {
      throw new Error("this path is not found.");
    }

    const initialChain: (InitialValueObject | null)[] = [];
    let currentInitial: InitialValueObject | null = this.initialValue;
    initialChain.push(currentInitial);

    for (const key of path) {
      if (currentInitial && currentInitial.type !== "field") {
        currentInitial =
          currentInitial.children.find((x) => x.key === key) ?? null;
      } else {
        currentInitial = null;
      }
      initialChain.push(currentInitial);
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      nodes[i].cache.selfDirty = compareNodeDirty(nodes[i], initialChain[i]);
    }

    let subNode = this.subscribeManager.findNode([]);
    let currentEffInclude = true;
    let initialEffInclude = true;

    for (let i = 0; i < nodes.length; i++) {
      const field = nodes[i];
      const initial = initialChain[i];

      currentEffInclude = currentEffInclude && field.dynamicProp.include;
      initialEffInclude = initialEffInclude && (initial?.include ?? false);

      const dirty =
        (currentEffInclude && field.cache.selfDirty) ||
        currentEffInclude !== initialEffInclude;

      if (subNode) {
        notifyNode(subNode, field, dirty, currentEffInclude);
      }

      const nextKey = path[i];
      if (nextKey !== undefined) {
        subNode = subNode?.children?.get(nextKey);
      }
    }
  }

  /**
   * 在 include 状态变化后，触发子树的节点dirty和value通知。需要保证selfDirty已计算
   *
   * 计算规则：
   * 1. 仅递归当前 include=true 且不等于 skipNode 的子节点。
   *    include=false 的分支不会继续下钻。
   * 2. 对外通知的 dirty 为：
   *    (currentEffInclude && selfDirty) || (currentEffInclude !== initialEffInclude)
   *
   * @param field 当前要处理的可变节点
   * @param subNode 当前节点对应的订阅节点（可能不存在）
   * @param initialNode 当前节点在初始值树中的对应节点；不存在时传 null
   * @param currentEffInclude 当前值树中，从根到该节点聚合后的 effective include
   * @param initialEffInclude 初始值树中，从根到该节点聚合后的 effective include
   * @param notifyNode 每个节点计算完成后触发的通知回调
   */
  static notifyIncludeChangedSubtree = (
    field: AnyMutableFieldNode,
    subNode: SubscribeNode | undefined,
    initialNode: InitialValueObject | null,
    currentEffInclude: boolean,
    initialEffInclude: boolean,
    cannotSkipNode: Set<AnyMutableFieldNode> | undefined,
    notifyNode: (
      field: AnyMutableFieldNode,
      sub: SubscribeNode | undefined,
      dirty: boolean,
      effectiveInclude: boolean,
    ) => void,
  ) => {
    if (field.type !== "field") {
      if (initialNode && initialNode.type === "field") {
        throw new Error("shape is incompitable");
      }

      for (const child of field.children) {
        if (!child.dynamicProp.include && !cannotSkipNode?.has(child)) {
          continue;
        }

        const childInitial =
          initialNode?.children.find((x) => x.key === child.key) ?? null;

        DirtyManager.notifyIncludeChangedSubtree(
          child,
          subNode?.children?.get(child.key),
          childInitial,
          currentEffInclude && child.dynamicProp.include,
          initialEffInclude && (childInitial?.include ?? false),
          cannotSkipNode,
          notifyNode,
        );
      }
    }

    notifyNode(
      field,
      subNode,
      (currentEffInclude && field.cache.selfDirty) ||
        currentEffInclude !== initialEffInclude,
      currentEffInclude,
    );
  };
  /**
   * 将表单指定字段恢复到初始值
   * @param node 要恢复的字段节点
   * @param notifyNode 用于处理表单系统内部细节，标记节点为脏的回调函数：
   * 要求该函数能同时标记该节点且祖先链所有节点
   * @param notifyNode 用于连接订阅系统，在更改字段时
   */
  resetField(
    node: AnyMutableFieldNode,
    notifyNode: (
      field: AnyMutableFieldNode | undefined,
      sub: SubscribeNode | undefined,
      dirty: boolean,
      effectiveInclude: boolean,
    ) => void,
  ) {
    const path = node.path.slice(1);

    const notifySubtree = (
      field: AnyMutableFieldNode,
      sub: SubscribeNode | undefined,
      effectiveInclude: boolean,
      del: boolean,
    ) => {
      if (field.type !== "field") {
        for (let child of field.children) {
          notifySubtree(
            child,
            sub?.children?.get(child.key),
            effectiveInclude && child.dynamicProp.include,
            del,
          );
        }
      }

      notifyNode(del ? undefined : field, sub, false, effectiveInclude);
    };

    const dfs = (
      field: AnyMutableFieldNode,
      subNode: SubscribeNode | undefined,
      initialValue: InitialValueObject,
      // 该参数用于比较reset前后的父链聚合后的include是否变化
      // 存储reset之前时，node的聚合include值
      currentEffectiveInclude: boolean,
    ): void => {
      setMutableNode(this.currentValue, field.path.slice(1), () => {
        if (field.type === "field") {
          if (initialValue.type !== field.type) {
            throw new Error("shape is incompitable");
          }

          field.dynamicProp.value = initialValue.value;
          field.dynamicProp.include = initialValue.include;

          notifyNode(
            field,
            subNode,
            false,
            currentEffectiveInclude && field.dynamicProp.include,
          );

          field.cache.selfDirty = false;
        } else if (field.type === "object") {
          if (initialValue.type !== field.type) {
            throw new Error("shape is incompitable");
          }

          for (let item of field.children) {
            const childKey = item.key;
            const childInitialObj = initialValue.children.find(
              (x) => x.key === childKey,
            );
            if (!childInitialObj) {
              throw new Error("shape is incompitable");
            }
            dfs(
              item,
              subNode?.children?.get(item.key),
              childInitialObj,
              currentEffectiveInclude && field.dynamicProp.include,
            );
          }

          field.dynamicProp.include = initialValue.include;
          field.cache.selfDirty = false;

          notifyNode(
            field,
            subNode,
            false,
            currentEffectiveInclude && field.dynamicProp.include,
          );
        } else {
          if (initialValue.type !== field.type) {
            throw new Error("shape is incompitable");
          }
          const map = new Map(field.children.map((x) => [x.key, x]));
          const afterResetChildren: AnyMutableFieldNode[] = [];
          const newNodes: AnyMutableFieldNode[] = [];
          const oldNodes: AnyMutableFieldNode[] = [];
          for (let item of initialValue.children) {
            const cur = map.get(item.key);
            if (cur) {
              dfs(
                cur,
                subNode?.children?.get(cur.key),
                item,
                currentEffectiveInclude && field.dynamicProp.include,
              );
              afterResetChildren.push(cur);
            } else {
              // 新加
              const newNode = this.compileArrayInitialToMutable(
                field.path.concat(item.key),
                item,
                initialValue.arraySchema,
                field,
              );
              afterResetChildren.push(newNode);
              newNodes.push(newNode);
            }
          }

          for (let item of field.children) {
            if (!map.has(item.key)) {
              oldNodes.push(item);
            }
          }

          // 通知被删除的节点
          oldNodes.forEach((node) =>
            notifySubtree(node, subNode?.children?.get(node.key), false, true),
          );
          // 通知新增的节点
          newNodes.forEach((node) =>
            notifySubtree(
              node,
              subNode?.children?.get(node.key),
              currentEffectiveInclude && field.dynamicProp.include,
              false,
            ),
          );

          field.children = afterResetChildren;
          field.cache.selfDirty = false;
          field.dynamicProp.include = initialValue.include;

          notifyNode(
            field,
            subNode,
            false,
            currentEffectiveInclude && field.dynamicProp.include,
          );
        }
      });
    };

    try {
      const initialValues = this.getInitialValueChainByPath(path);
      const initialValue = initialValues.at(-1)!;
      const subNode = this.subscribeManager.findNode(node.path.slice(1));

      // 获取初始值里这个节点的effective include
      const effectiveInclude = this.getEffIncludeValue(path);

      if (effectiveInclude) {
        // 如果effective include是true，把整条链的节点都改成include: true
        let currentField: AnyMutableFieldNode | undefined = node;
        let currentInitial: InitialValueObject | undefined = initialValue;
        let currentSub: SubscribeNode | undefined = subNode;

        let lastModifedField: AnyMutableFieldNode = node;
        let lastModifedSub = subNode;
        let lastModifedInitial = initialValue;
        while (currentField) {
          if (!currentField.dynamicProp.include) {
            currentField.dynamicProp.include = true;

            currentField.cache.selfDirty = compareNodeDirty(
              currentField,
              currentInitial ?? null,
            );

            lastModifedField = currentField;
            lastModifedSub = currentSub;
            lastModifedInitial = currentInitial!;
          }

          currentField = currentField.parent;
          currentSub = currentSub?.parent;
          currentInitial = currentInitial?.parent;
        }

        // 从最靠近根部的节点开始遍历整棵树
        // 该函数在遇到false会跳过，而当前只会把false一律设置为true
        // 所以不需要考虑设置为false导致的漏通知问题
        DirtyManager.notifyIncludeChangedSubtree(
          lastModifedField,
          lastModifedSub,
          lastModifedInitial,
          FormModel.getEffIncludeValue(lastModifedField),
          this.getEffIncludeValue(lastModifedField.path.slice(1)),
          undefined,
          notifyNode,
        );
      } else {
        // 否则只改变当前node的include为false
        if (node.dynamicProp.include) {
          node.dynamicProp.include = false;
          node.cache.selfDirty = compareNodeDirty(node, initialValue);

          DirtyManager.notifyIncludeChangedSubtree(
            node,
            subNode,
            this.findInitialValue(path) ?? null,
            FormModel.getEffIncludeValue(node),
            this.getEffIncludeValue(path),
            undefined,
            notifyNode,
          );
        }
      }

      dfs(
        node,
        subNode,
        initialValue,
        node.parent?.dynamicProp.include ?? true,
      );

      this.updateDirtyOnChain(
        path,
        (
          subNode: SubscribeNode,
          field: AnyMutableFieldNode,
          dirty: boolean,
          effectiveInclude: boolean,
        ) => {
          notifyNode(field, subNode, dirty, effectiveInclude);
        },
      );
    } catch {}
  }

  /**
   * 更新该节点以及父链上的selfDirty值
   * @param node 要更新的字段
   */
  updateNode(node: AnyMutableFieldNode) {
    const nodes = getNodesOnPath(this.currentValue, node.path.slice(1), true)!;
    const initialValues: (InitialValueObject | null)[] = [];
    {
      let cur: InitialValueObject | null = this.initialValue;
      initialValues.push(cur);
      for (let key of node.path.slice(1)) {
        if (cur && cur.type !== "field") {
          cur = cur.children.find((x) => x.key === key) || null;
        }
        initialValues.push(cur);
      }
    }
    console.assert(
      nodes.length === initialValues.length,
      "初始值和当前值节点数组长度不一致",
    );
    for (let i = nodes.length - 1; i >= 0; i--) {
      const initial = initialValues[i];
      const current = nodes[i];

      current.cache.selfDirty = compareNodeDirty(current, initial);
    }
  }

  /**
   * 获取初始值指定字段是否存在
   * @param path 不包含dummy的节点
   */
  getEffIncludeValue(path: FieldPath): boolean {
    let current = this.initialValue;

    // 检查根节点的include属性
    if (!current.include) {
      return false;
    }

    // 遍历路径上的每个key
    for (const key of path) {
      if (current.type === "field") {
        throw new Error("Cannot traverse into field type");
      }

      const child = current.children.find((x) => x.key === key);
      if (!child) {
        return false; // 路径不存在
      }

      if (!child.include) {
        return false;
      }

      current = child;
    }

    return true;
  }

  private compileArrayInitialToMutable(
    path: FieldPath,
    initialValue: InitialValueObject,
    schema: ArraySchema,
    parentNode: MutableNestedFieldNode,
    notifyNodeChange?: (node: AnyMutableFieldNode) => void,
  ): AnyMutableFieldNode {
    const dfs = (
      initialValue: InitialValueObject,
      schema: FieldSchema,
      path: FieldPath,
      parentNode: MutableNestedFieldNode,
    ): AnyMutableFieldNode => {
      if (initialValue.type === "field") {
        if ("isArray" in schema) {
          throw new Error("schema shape is incompitable");
        }
        const fieldNode = compileOneMutableNode(
          schema,
          path,
          parentNode,
        ) as MutableFieldNode<"field">;
        fieldNode.dynamicProp.include = initialValue.include;
        fieldNode.dynamicProp.value = initialValue.value;
        notifyNodeChange?.(fieldNode);
        return fieldNode;
      } else if (initialValue.type === "object") {
        if (!("isArray" in schema && !schema.isArray)) {
          throw new Error("schema shape is incompitable");
        }
        const objNode = compileOneMutableNode(
          schema,
          path,
          parentNode,
        ) as MutableFieldNode<"object">;
        for (let item of initialValue.children) {
          const childSchema = schema.childrenFields.find(
            (x) => x.key === item.key,
          )!;
          objNode.children.push(
            dfs(item, childSchema, path.concat(item.key), objNode),
          );
        }
        objNode.dynamicProp.include = initialValue.include;
        notifyNodeChange?.(objNode);
        return objNode;
      } else {
        if (!("isArray" in schema && schema.isArray)) {
          throw new Error("schema shape is incompitable");
        }
        const arrayNode = compileOneMutableNode(
          schema,
          path,
          parentNode,
        ) as MutableFieldNode<"array">;
        for (let item of initialValue.children) {
          const key = item.key;
          arrayNode.children.push(
            dfs(
              item,
              { ...initialValue.arraySchema, key },
              path.concat(key),
              arrayNode,
            ),
          );
        }
        arrayNode.dynamicProp.include = initialValue.include;
        notifyNodeChange?.(arrayNode);
        return arrayNode;
      }
    };

    return dfs(
      initialValue,
      { ...schema, key: path.at(-1)! },
      path,
      parentNode,
    );
  }

  /**
   * 生成一个数组类型的字段初始值节点
   * @param value plain对象
   * @param schema 数组字段schema提供的数组项schema
   */
  private compileArrayValueToInitial(
    value: any,
    schema: FieldSchema,
    parent: InitialValueObject,
  ): InitialValueObject {
    const dfs = (
      schema: FieldSchema,
      fieldValueStatus:
        | {
            hasValue: false;
          }
        | {
            hasValue: true;
            value: any;
          },
      parent: InitialValueObject | undefined,
    ): InitialValueObject => {
      if (!("isArray" in schema)) {
        return {
          type: "field",
          key: schema.key,
          include: fieldValueStatus.hasValue,
          value: fieldValueStatus.hasValue && fieldValueStatus.value,
          parent: parent,
        };
      }

      if (schema.isArray === false) {
        // 对象
        const children: InitialValueObject[] = [];
        const res: InitialValueObject = {
          type: "object",
          key: schema.key,
          include: fieldValueStatus.hasValue,
          children,
          parent: parent,
        };
        for (let item of schema.childrenFields) {
          children.push(
            dfs(
              item,
              {
                hasValue:
                  fieldValueStatus.hasValue &&
                  item.key in fieldValueStatus.value,
                value:
                  fieldValueStatus.hasValue && fieldValueStatus.value[item.key],
              },
              res,
            ),
          );
        }
        return res;
      } else {
        // 数组
        const children: InitialValueObject[] = [];
        const res: InitialValueObject = {
          type: "array",
          key: schema.key,
          arraySchema: schema.arraySchema,
          include: false,
          children: children,
          parent: parent,
        };
        if (!fieldValueStatus.hasValue) {
          return res;
        }
        for (let item in fieldValueStatus.value) {
          const child = dfs(
            { ...schema.arraySchema, key: item },
            {
              hasValue: true,
              value: fieldValueStatus.value[item],
            },
            res,
          );
          children.push(child);
        }
        return res;
      }
    };

    return dfs(schema, { hasValue: true, value }, parent);
  }

  /**
   * 根据路径查找 InitialValueObject
   * @param path 字段路径，空数组表示根节点
   * @returns 找到的 InitialValueObject 节点
   * @throws 如果路径不存在则抛出错误
   */
  private findInitialValueByPath(path: FieldPath): InitialValueObject {
    if (path.length === 0) {
      return this.initialValue;
    }

    let current = this.initialValue;

    for (let i = 0; i < path.length; i++) {
      const key = path[i];

      if (current.type === "field") {
        throw new Error(
          `Cannot traverse into field type at path: ${path
            .slice(0, i)
            .join(".")}`,
        );
      }

      const child = current.children.find((x) => x.key === key);

      if (!child) {
        throw new Error(
          `Path not found: ${path
            .slice(0, i + 1)
            .join(".")} (key "${key}" not found)`,
        );
      }

      current = child;
    }

    return current;
  }

  /**
   * 获取初始值对象
   * @param path 不包含虚拟根节点的路径
   * @returns 未找到返回undefined
   */
  findInitialValue(path: FieldPath) {
    let res: InitialValueObject | undefined = undefined;
    try {
      res = this.findInitialValueByPath(path);
    } catch {}
    return res;
  }

  /**
   * 根据路径获取整条链的 InitialValueObject 数组
   * @param path 字段路径，空数组表示仅返回根节点
   * @returns 从根节点到目标节点的 InitialValueObject 数组
   * @throws 如果路径不存在则抛出错误
   */
  public getInitialValueChainByPath(path: FieldPath): InitialValueObject[] {
    const chain: InitialValueObject[] = [];

    let current = this.initialValue;
    chain.push(current); // 添加根节点

    for (let i = 0; i < path.length; i++) {
      const key = path[i];

      if (current.type === "field") {
        throw new Error(
          `Cannot traverse into field type at path: ${path
            .slice(0, i)
            .join(".")}`,
        );
      }

      const child = current.children.find((x) => x.key === key);

      if (!child) {
        throw new Error(
          `Path not found: ${path
            .slice(0, i + 1)
            .join(".")} (key "${key}" not found)`,
        );
      }

      current = child;
      chain.push(current); // 添加路径上的每个节点
    }

    return chain;
  }

  /**
   * 根据路径获取链路节点（安全版，不抛错）
   * @param path 字段路径
   * @returns 返回长度与 path 一致；每一项对应 path 同索引 key 的节点，找不到返回 null
   */
  public getInitialValueChainByPathSafe(
    path: FieldPath,
  ): (InitialValueObject | null)[] {
    const chain: (InitialValueObject | null)[] = [];
    let current: InitialValueObject | null = this.initialValue;

    for (const key of path) {
      if (!current || current.type === "field") {
        chain.push(null);
        current = null;
        continue;
      }

      const child: InitialValueObject | null =
        current.children.find((x) => x.key === key) ?? null;
      chain.push(child);
      current = child;
    }

    return chain;
  }
}
