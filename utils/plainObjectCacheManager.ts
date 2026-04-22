import {
  AnyMutableFieldNode,
  FieldKey,
  FieldType,
  MutableFieldNode,
  NodeCache,
} from "./type";

class PlainObjectCacheManager {
  mutableDataSource: AnyMutableFieldNode;

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
    if (this.mutableDataSource.cache.plainObj.type !== "ready") {
      return undefined;
    }
    return isSubmit
      ? this.mutableDataSource.cache.plainObj.submitData
      : this.mutableDataSource.cache.plainObj.validateData;
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
    ): NodeCache["plainObj"] & { type: "ready" | "void" } {
      const include = node.dynamicProp.include;

      if (node.type === "field") {
        const plainObj = node.cache.plainObj;
        if (plainObj.type !== "dirty") {
          return plainObj;
        }

        // 更新缓存
        if (!include) {
          node.cache.plainObj = {
            rawData: node.dynamicProp.value,
            type: "void",
          };
        } else {
          node.cache.plainObj = {
            rawData: node.dynamicProp.value,
            type: "ready",
            validateData: include && node.dynamicProp.value,
            submitData: include && node.dynamicProp.value,
          };
        }

        return node.cache.plainObj;
      } else if (node.type === "object") {
        if (node.cache.plainObj.type !== "dirty") {
          return node.cache.plainObj;
        }

        const rawObj: Record<string, any> = {};
        const validateObj: Record<string, any> = {};
        const submitObj: Record<string, any> = {};

        for (let i of node.children) {
          const result = dfs(i);

          rawObj[i.key] = result.rawData;

          if (result.type === "void") {
            continue;
          }

          validateObj[i.key] = result.validateData;
          submitObj[i.key] = result.submitData;
        }

        if (include) {
          node.cache.plainObj = {
            rawData: rawObj,
            submitData: submitObj,
            validateData: validateObj,
            type: "ready",
          };
        } else {
          node.cache.plainObj = {
            rawData: rawObj,
            type: "void",
          };
        }

        return node.cache.plainObj;
      } else {
        if (node.cache.plainObj.type !== "dirty") {
          return node.cache.plainObj;
        }

        const rawObj: Record<FieldKey, any> = {};
        const validateObj: Record<FieldKey, any> = {};
        const submitObj: Record<FieldKey, any> = {};

        // 子节点脏情况
        for (let i of node.children) {
          const result = dfs(i);

          rawObj[i.key] = result.rawData;

          if (result.type === "void") {
            if (!node.dynamicProp.include) {
              continue;
            }
            throw new Error("数组第一层节点不能是空");
          }

          validateObj[i.key] = result.validateData;
          submitObj[i.key] = result.submitData;
        }

        if (!node.dynamicProp.include) {
          return (node.cache.plainObj = {
            rawData: rawObj,
            type: "void",
          });
        }

        const submitData = node.children
          .filter((child) => Object.hasOwn(submitObj, child.key))
          .map((child) => submitObj[child.key]);

        node.cache.plainObj = {
          rawData: rawObj,
          submitData,
          validateData: validateObj,
          type: "ready",
        };

        return node.cache.plainObj;
      }
    }

    const res = dfs(node);
    node.cache.plainObj = res;
  }
}

export { PlainObjectCacheManager };
