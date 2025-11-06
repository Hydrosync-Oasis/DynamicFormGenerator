import { z, ZodType } from "zod";
import { MutableFieldNode, NodeCache } from "./type";
import { getNodesOnPath } from "./structures";

class ValidatorCacheManager {
  mutableDataSource: MutableFieldNode;

  finalValidator: ZodType | undefined = undefined;

  constructor(mutableDataSource: MutableFieldNode) {
    this.mutableDataSource = mutableDataSource;
    this.rebuild();
  }

  /**
   * 获取最终的表单校验器
   * @returns zod 校验器
   */
  getFinalValidator(): ZodType | undefined {
    this.rebuild();
    return this.finalValidator;
  }

  /**
   * 何时调用：字段 visible 发生变化，或者 validation 规则发生变化时
   */
  updateNode(node: MutableFieldNode) {
    const nodes = getNodesOnPath(
      this.mutableDataSource,
      node.path.slice(1),
      true
    );

    nodes?.forEach((n) => {
      n.cache.validator.type = "dirty";
    });
  }

  /**
   * 在调用此函数前确保已经使用 updateNode 进行过更新
   */
  rebuild() {
    const dfs = (
      node: MutableFieldNode
    ): NodeCache["validator"] &
      ({ type: "hidden" } | { type: "hasValue"; validator: ZodType }) => {
      const cache = node.cache;

      if (node.type === "field") {
        const visible = node.dynamicProp.visible;
        if (visible && node.dynamicProp.validation) {
          cache.validator = {
            validator: node.dynamicProp.validation,
            type: "hasValue",
          };
        } else {
          cache.validator = { type: "hidden" };
        }

        return cache.validator;
      } else {
        // object 或 array 类型
        if (cache.validator.type !== "dirty") {
          return cache.validator;
        }

        const validatorMap: Record<string, ZodType> = {};

        for (let child of node.children) {
          const res = dfs(child);
          // 只收集可见且有校验规则的字段
          if (res && res.type === "hasValue") {
            validatorMap[child.key] = res.validator;
          }
        }

        if (Object.keys(validatorMap).length > 0) {
          let validator: ZodType;

          // 不管是不是数组都当对象校验，因为不确定数组的每个元素结构都一致（比如有的数组项visible为false）
          validator = z.object(validatorMap);

          // 应用自定义的 refine（如果存在）
          if (node.dynamicProp.validationRefine) {
            validator = node.dynamicProp.validationRefine(validator);
          }

          cache.validator = {
            validator,
            type: "hasValue",
          };
        } else {
          cache.validator = { type: "hidden" };
        }

        return cache.validator;
      }
    };

    const res = dfs(this.mutableDataSource);
    this.mutableDataSource.cache.validator = res;

    if (res.type === "hasValue") {
      this.finalValidator = res.validator;
    } else {
      this.finalValidator = undefined;
    }
  }
}

export { ValidatorCacheManager };
