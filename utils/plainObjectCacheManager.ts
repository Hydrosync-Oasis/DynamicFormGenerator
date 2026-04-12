import {
  AnyMutableFieldNode,
  ComparablePlainObject,
  FieldKey,
  FieldType,
  MutableFieldNode,
  NodeCache,
} from "./type";

class PlainObjectCacheManager {
  mutableDataSource: AnyMutableFieldNode;

  finalData: {
    validateData: Record<string, any> | undefined;
    submitData: Record<string, any> | undefined;
  } = { validateData: undefined, submitData: undefined };

  constructor(mutableDataSource: AnyMutableFieldNode) {
    this.mutableDataSource = mutableDataSource;
    this.rebuild(mutableDataSource);
  }

  /**
   * 生成最终的表单数据
   * @param isSubmit 是否要获取表单提交时数据，如果为真，数组字段将以数组形式展示，否则均以对象导出，便于校验
   * @returns
   */
  getFinalPlainObject(isSubmit: boolean = true) {
    this.rebuild(this.mutableDataSource);
    return isSubmit ? this.finalData.submitData : this.finalData.validateData;
  }

  /**
   * 何时调用：字段Value发生变化，visible发生变化时
   */
  updateNode(node: AnyMutableFieldNode) {
    let cur: AnyMutableFieldNode | undefined = node;
    while (cur && cur.cache.plainObj.type !== "dirty") {
      cur.cache.plainObj = {
        ...cur.cache.plainObj,
        type: "dirty",
      };
      cur = cur.parent;
    }
  }

  /**
   * 在调用此函数前确保已经使用updateNode进行过更新
   */
  rebuild<T extends FieldType>(node: MutableFieldNode<T>) {
    function dfs<T extends FieldType>(
      node: MutableFieldNode<T>,
    ): {
      result: NodeCache<FieldType>["plainObj"] & { type: "ready" | "void" };
      hasChange: boolean;
    } {
      const include = node.dynamicProp.include;

      if (node.type === "field") {
        const plainObj = node.cache.plainObj;
        if (plainObj.type !== "dirty") {
          return { hasChange: false, result: plainObj };
        }

        const curVal: ComparablePlainObject<"field"> = {
          include,
          value: node.dynamicProp.value,
        };
        const lastValue = plainObj.lastValue;

        let changed =
          !curVal ||
          curVal.include !== lastValue.include ||
          (curVal.include &&
            lastValue.include &&
            !Object.is(curVal.value, lastValue.value));

        if (!changed) {
          if (!curVal.include) {
            node.cache.plainObj = {
              ...plainObj,
              type: "void",
            };
          } else {
            node.cache.plainObj = {
              ...plainObj,
              type: "ready",
              submitData:
                "submitData" in node.cache.plainObj
                  ? node.cache.plainObj.submitData
                  : curVal.value,
              validateData:
                "validateData" in node.cache.plainObj
                  ? node.cache.plainObj.validateData
                  : curVal.value,
            };
          }

          return {
            hasChange: false,
            result: node.cache.plainObj,
          };
        }

        if (!curVal.include) {
          node.cache.plainObj = {
            ...node.cache.plainObj,
            type: "void",
          };
        } else {
          // 交替更新
          node.cache.plainObj.lastValue = curVal;
          // 更新缓存

          node.cache.plainObj = {
            ...node.cache.plainObj,
            type: "ready",
            validateData: curVal.include && curVal.value,
            submitData: curVal.include && curVal.value,
          };
        }

        return {
          hasChange: changed,
          result: node.cache.plainObj,
        };
      } else if (node.type === "object") {
        if (node.cache.plainObj.type !== "dirty") {
          return {
            hasChange: false,
            result: node.cache.plainObj,
          };
        }
        const curVal: ComparablePlainObject<"object"> = {
          include,
        };
        const lastValue = node.cache.plainObj.lastValue;

        const validateObj: Record<string, any> = {};
        const submitObj: Record<string, any> = {};

        let changed = lastValue.include !== curVal.include;
        for (let i of node.children) {
          const res = dfs(i);
          changed = changed || res.hasChange;

          const result = res.result;
          if (result.type === "void") {
            continue;
          }

          validateObj[i.key] = result.validateData;
          submitObj[i.key] = result.submitData;
        }

        if (!changed) {
          if (include) {
            node.cache.plainObj = {
              validateData: validateObj,
              submitData: submitObj,
              ...node.cache.plainObj,
              type: "ready",
            };
          } else {
            node.cache.plainObj = {
              ...node.cache.plainObj,
              type: "void",
            };
          }

          return { hasChange: false, result: node.cache.plainObj };
        }

        if (include) {
          node.cache.plainObj = {
            lastValue: curVal,
            submitData: submitObj,
            validateData: validateObj,
            type: "ready",
          };
        } else {
          node.cache.plainObj = {
            lastValue: curVal,
            type: "void",
          };
        }

        return { result: node.cache.plainObj, hasChange: changed };
      } else {
        if (node.cache.plainObj.type !== "dirty") {
          return {
            hasChange: false,
            result: node.cache.plainObj,
          };
        }

        const curVal: ComparablePlainObject<"array"> = include
          ? {
              include,
              order: node.children.map((x) => x.key),
            }
          : {
              include,
            };
        const lastValue = node.cache.plainObj.lastValue;
        let changed =
          curVal.include !== lastValue.include ||
          (curVal.include &&
            lastValue.include &&
            lastValue.order.every((key, i, arr) => {
              return (
                key !== curVal.order[i] || arr.length !== curVal.order.length
              );
            }));

        const validateObj: Record<FieldKey, any> = {};
        const submitObj: Record<FieldKey, any> = {};

        // 子节点脏情况
        for (let i of node.children) {
          const res = dfs(i);
          changed = changed || res.hasChange;

          const result = res.result;
          if (result.type === "void") {
            throw new Error("数组第一层节点不能是空");
          }

          validateObj[i.key] = result.validateData;
          submitObj[i.key] = result.submitData;
        }

        if (!changed) {
          node.cache.plainObj = {
            submitData: submitObj,
            validateData: validateObj,
            ...node.cache.plainObj,
            type: "ready",
          };
          return {
            hasChange: changed,
            result: node.cache.plainObj,
          };
        }

        const submitData = node.children
          .filter((child) => Object.hasOwn(submitObj, child.key))
          .map((child) => submitObj[child.key]);

        node.cache.plainObj = {
          lastValue: curVal,
          submitData,
          validateData: validateObj,
          type: "ready",
        };

        return { result: node.cache.plainObj, hasChange: changed };
      }
    }

    const res = dfs(node);
    this.mutableDataSource.cache.plainObj = res.result;

    this.finalData = {
      validateData:
        res.result.type === "void" ? undefined : res.result.validateData,
      submitData:
        res.result.type === "void" ? undefined : res.result.submitData,
    };
  }
}

export { PlainObjectCacheManager };
