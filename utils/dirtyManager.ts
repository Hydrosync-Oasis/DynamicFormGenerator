import { compileOneMutableNode } from "./helper";
import { markMutableNodeDirty, setMutableNode } from "./immutableHelper";
import { setNodeDirtyOnChain as updateDirtyOnChain } from "./nodeDirtyNotifyHelper";
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
      return false;
    }
    for (let i in current.children) {
      if (current.children[i].key !== initial.children[i].key) {
        // 顺序不同
        return false;
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
  currentValue: AnyMutableFieldNode;
  initialValue: InitialValueObject;

  subscribeManager: SubscribeManager;

  constructor(
    currentValue: AnyMutableFieldNode,
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
    const dfs = (current: AnyMutableFieldNode): InitialValueObject => {
      const key = current.key;
      const include = current.dynamicProp.include;
      if (current.type === "field") {
        return {
          type: "field",
          key,
          value: current.dynamicProp.value,
          include,
        };
      }
      if (current.type === "object") {
        return {
          type: "object",
          key,
          include,
          children: current.children.map((x) => dfs(x)),
        };
      }
      if (current.type === "array") {
        return {
          type: "array",
          key,
          schema: current.staticProp.schema,
          include,
          children: current.children.map((x) => dfs(x)),
        };
      }

      throw new Error("type is invalid");
    };
    return dfs(this.currentValue);
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
          subNode?.children.get(item.key),
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
        const afterInitialEffInclude =
          initialEffInclude && (initial.include = fieldValue.hasValue);
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
              currentEffectiveInclude !== afterInitialEffInclude ||
                newSelfDirty,
            );

          current.cache.selfDirty = newSelfDirty;
        } else {
          subNode && notifyNodeDirtyChanged(subNode, afterInitialEffInclude);
        }
      } else if (initial.type === "object") {
        const afterInitialEffInclude =
          initialEffInclude && (initial.include = fieldValue.hasValue);

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
              initialEffInclude || false,
              subNode?.children.get(key),
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
              currentEffectiveInclude !== afterInitialEffInclude || newDirty,
            );

          current.cache.selfDirty = newDirty;
        } else {
          subNode && notifyNodeDirtyChanged(subNode, afterInitialEffInclude);
        }
      } else {
        // 数组
        const beforeInitialEffInclude = initialEffInclude && initial.include;
        const afterInitialEffInclude =
          initialEffInclude && (initial.include = fieldValue.hasValue);

        if (current && current.type !== "array") {
          throw new Error("shape is incompitable");
        }

        const beforeInitialMap = new Map<string, InitialValueObject>(
          initial.children.map((x) => [x.key, x]),
        );

        let childDirty = false;
        if (fieldValue.hasValue) {
          // 目前先全量编译
          const newChildren = this.compileArrayValueToInitial(
            fieldValue.value,
            {
              key: "dummy",
              isArray: true,
              arraySchema: initial.schema,
            },
          );
          initial.children = newChildren.children;
          // 替换为新initialValue
          for (let item of initial.children) {
            const currentChild = current?.children.find(
              (x) => x.key === item.key,
            );
            dfs(
              fieldValue.value,
              item,
              currentChild,
              currentEffectiveInclude &&
                (currentChild?.dynamicProp?.include ?? false),
              initialEffInclude && initial.include,
              subNode?.children.get(item.key),
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
              subNode?.children.get(key),
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
              newDirty || currentEffectiveInclude !== initialEffInclude,
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
        subNode = subNode?.children.get(nextKey);
      }
    }
  }

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
            sub?.children.get(child.key),
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
              subNode?.children.get(item.key),
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
                subNode?.children.get(cur.key),
                item,
                currentEffectiveInclude && field.dynamicProp.include,
              );
              afterResetChildren.push(cur);
            } else {
              // 新加
              const newNode = this.compileArrayInitialToMutable(
                field.path.concat(item.key),
                item,
                initialValue.schema,
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
            notifySubtree(node, subNode?.children.get(node.key), false, true),
          );
          // 通知新增的节点
          newNodes.forEach((node) =>
            notifySubtree(
              node,
              subNode?.children.get(node.key),
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

    const notifyIncludeChangedSubtree = (
      field: AnyMutableFieldNode,
      subNode: SubscribeNode | undefined,
      initialNode: InitialValueObject | null,
      currentEffInclude: boolean,
      initialEffInclude: boolean,
    ) => {
      if (field.type !== "field") {
        if (initialNode && initialNode.type === "field") {
          throw new Error("shape is incompitable");
        }

        for (const child of field.children) {
          if (!child.dynamicProp.include) {
            continue;
          }

          const childInitial =
            initialNode?.children.find((x) => x.key === child.key) ?? null;

          notifyIncludeChangedSubtree(
            child,
            subNode?.children.get(child.key),
            childInitial,
            currentEffInclude && child.dynamicProp.include,
            initialEffInclude && (childInitial?.include ?? false),
          );
        }
      }

      field.cache.selfDirty = compareNodeDirty(field, initialNode);
      notifyNode(
        field,
        subNode,
        (currentEffInclude && field.cache.selfDirty) ||
          currentEffInclude !== initialEffInclude,
        currentEffInclude,
      );
    };

    try {
      const initialValues = this.getInitialValueChainByPath(path);
      const initialValue = initialValues.at(-1)!;
      const parentInitial = initialValues.at(-2);
      const subNode = this.subscribeManager.findNode(node.path.slice(1));

      // 获取初始值里这个节点的effective include
      const effectiveInclude = this.getEffIncludeValue(path);

      if (effectiveInclude) {
        // 如果effective include是true，把整条链的节点都改成include: true
        let currentField: AnyMutableFieldNode | undefined = node;
        let currentSub: SubscribeNode | undefined = subNode;
        while (currentField) {
          if (!currentField.dynamicProp.include) {
            currentField.dynamicProp.include = true;

            const currentPath = currentField.path.slice(1);
            const initialNode = this.findInitialValue(currentPath) ?? null;
            notifyIncludeChangedSubtree(
              currentField,
              currentSub,
              initialNode,
              FormModel.getEffIncludeValue(currentField),
              this.getEffIncludeValue(currentPath),
            );
          }

          currentField = currentField.parent;
          currentSub = currentSub?.parent;
        }
      } else {
        // 否则只改变当前node的include为false
        if (node.dynamicProp.include) {
          node.dynamicProp.include = false;

          notifyIncludeChangedSubtree(
            node,
            subNode,
            this.findInitialValue(path) ?? null,
            FormModel.getEffIncludeValue(node),
            this.getEffIncludeValue(path),
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
              { ...initialValue.schema, key },
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
    schema: FieldSchema & { isArray: true },
  ): InitialValueObject & { type: "array" } {
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
    ): InitialValueObject => {
      if (!("isArray" in schema)) {
        return {
          type: "field",
          key: schema.key,
          include: fieldValueStatus.hasValue,
          value: fieldValueStatus.hasValue && fieldValueStatus.value,
        };
      }

      if (schema.isArray === false) {
        // 对象
        const children: InitialValueObject[] = [];
        for (let item of schema.childrenFields) {
          const hasValue =
            fieldValueStatus.hasValue && item.key in fieldValueStatus.value;
          children.push(
            dfs(item, {
              hasValue,
              value: value[item.key],
            }),
          );
        }
        return {
          type: "object",
          key: schema.key,
          include: fieldValueStatus.hasValue,
          children,
        };
      } else {
        // 数组
        const children: InitialValueObject[] = [];
        if (!fieldValueStatus.hasValue) {
          return {
            type: "array",
            key: schema.key,
            schema,
            include: false,
            children: [],
          };
        }
        for (let item in fieldValueStatus.value) {
          const child = dfs(
            { ...schema.arraySchema, key: item },
            {
              hasValue: true,
              value: fieldValueStatus.value[item],
            },
          );
          children.push(child);
        }
        return {
          type: "array",
          key: schema.key,
          schema,
          children: children,
          include: true,
        };
      }
    };

    return dfs(schema, { hasValue: true, value }) as InitialValueObject & {
      type: "array";
    };
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
}
