import { MutableFieldNode, NodeCache } from "./type";
import { getNodesOnPath } from "./structures";

class PlainObjectCacheManager {
  mutableDataSource: MutableFieldNode;

  finalData: {
    validatData: Record<string, any> | undefined;
    submitData: Record<string, any> | undefined;
  } = { validatData: undefined, submitData: undefined };

  constructor(mutableDataSource: MutableFieldNode) {
    this.mutableDataSource = mutableDataSource;
    this.rebuild();
  }

  /**
   * 生成最终的表单数据
   * @param isSubmit 是否要获取表单提交时数据，如果为真，数组字段将以数组形式展示，否则均以对象导出，便于校验
   * @returns
   */
  getFinalPlainObject(isSubmit: boolean = true) {
    this.rebuild();
    return isSubmit ? this.finalData.submitData : this.finalData.validatData;
  }

  /**
   * 何时调用：字段Value发生变化，visible发生变化时
   */
  updateNode(node: MutableFieldNode) {
    const nodes = getNodesOnPath(
      this.mutableDataSource,
      node.path.slice(1),
      true
    );

    nodes?.forEach((n) => {
      n.cache.plainObj.type = "dirty";
    });
  }

  /**
   * 在调用此函数前确保已经使用updateNode进行过更新
   */
  rebuild() {
    const dfs = (
      node: MutableFieldNode
    ): NodeCache["plainObj"] & ({ type: "hidden" } | { type: "hasValue" }) => {
      const cache = node.cache;
      const policy = node.dynamicProp.includePolicy;
      if (node.type === "field") {
        const visible = node.dynamicProp.visible;
        const shouldInclude =
          node.dynamicProp.includePolicy === "always" ||
          (visible && node.dynamicProp.includePolicy !== "never");

        if (shouldInclude) {
          cache.plainObj = {
            submitData: node.dynamicProp.value,
            objectOnly: node.dynamicProp.value,
            objectOnlyIncludesHidden: node.dynamicProp.value,
            type: "hasValue",
          };
        } else {
          cache.plainObj = {
            type: "hidden",
            objectOnlyIncludesHidden: node.dynamicProp.value,
          };
        }

        return cache.plainObj;
      } else {
        if (cache.plainObj.type !== "dirty") {
          return cache.plainObj;
        }
        const objectOnly: Record<string, any> = {};
        const objOnlyIncludesHdn: Record<string, any> = {};
        const submitObj: Record<string, any> = {};
        const maybeInclude =
          policy === "always" ||
          (node.dynamicProp.visible && policy !== "never") ||
          policy === "when-children-include";

        for (let i of node.children) {
          const res = dfs(i);
          // 一定不是undefined了
          if (res && res.type === "hasValue") {
            objectOnly[i.key] = res.objectOnly;
            submitObj[i.key] = res.submitData;
          }
          objOnlyIncludesHdn[i.key] = res.objectOnlyIncludesHidden;
        }

        // 如果可能会被包含在提交数据中
        if (maybeInclude) {
          // 当当前节点是数组类型时，submitData 需要是一个“仅包含值的数组”（丢弃 key）
          // 为了保证顺序，按 children 顺序收集已有的值
          const submitData =
            node.type === "array"
              ? node.children
                  .filter((child) =>
                    Object.prototype.hasOwnProperty.call(submitObj, child.key)
                  )
                  .map((child) => submitObj[child.key])
              : submitObj;

          if (policy === "when-children-include") {
            if (Object.keys(submitData).length > 0) {
              cache.plainObj = {
                submitData,
                objectOnly: objectOnly,
                objectOnlyIncludesHidden: objOnlyIncludesHdn,
                type: "hasValue",
              };
            } else {
              cache.plainObj = {
                type: "hidden",
                objectOnlyIncludesHidden: objOnlyIncludesHdn,
              };
            }
          } else {
            cache.plainObj = {
              submitData,
              objectOnly: objectOnly,
              objectOnlyIncludesHidden: objOnlyIncludesHdn,
              type: "hasValue",
            };
          }
        } else {
          cache.plainObj = {
            type: "hidden",
            objectOnlyIncludesHidden: objOnlyIncludesHdn,
          };
        }

        return cache.plainObj;
      }
    };

    const res = dfs(this.mutableDataSource);
    this.mutableDataSource.cache.plainObj = res;
    if (res.type === "hasValue") {
      this.finalData = {
        validatData: res.objectOnly,
        submitData: res.submitData,
      };
    } else {
      this.finalData = { validatData: undefined, submitData: undefined };
    }
  }
}

export { PlainObjectCacheManager };
