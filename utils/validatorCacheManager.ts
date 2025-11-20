import { z, ZodType } from "zod";
import { MutableFieldNode, NodeCache } from "./type";
import { getNodesOnPath } from "./structures";
import { ru } from "zod/locales";
import { rule } from "postcss";

class ValidatorCacheManager {
  mutableDataSource: MutableFieldNode;

  finalValidator:
    | Record<
        string,
        | {
            type: "hasValue";
            validator: ZodType;
          }
        | {
            type: "hidden";
          }
      >
    | undefined = undefined;

  constructor(mutableDataSource: MutableFieldNode) {
    this.mutableDataSource = mutableDataSource;
    this.rebuild();
  }

  /**
   * 获取最终的表单校验器
   * @returns zod 校验器
   */
  getFinalValidator() {
    this.rebuild();
    return this.finalValidator;
  }

  /**
   * 何时调用：字段 visible 发生变化，或者 validation 规则发生变化时
   */
  updateNode(node: MutableFieldNode, ruleSet?: string) {
    const nodes = getNodesOnPath(
      this.mutableDataSource,
      node.path.slice(1),
      true
    );

    nodes?.forEach((n) => {
      const validatorCache = n.cache.validator;

      if (validatorCache === "dirty") {
        return;
      }

      if (ruleSet) {
        validatorCache[ruleSet] = { type: "dirty" };
        return;
      }

      Object.keys(validatorCache).forEach((k) => {
        validatorCache[k] = { type: "dirty" };
      });
    });
  }

  /**
   * 在调用此函数前确保已经使用 updateNode 进行过更新
   */
  rebuild() {
    const dfs = (
      node: MutableFieldNode
    ): {
      [ruleSet: string]:
        | { type: "hidden" }
        | { type: "hasValue"; validator: ZodType };
    } => {
      const cache = node.cache;

      if (node.type === "field") {
        const visible = node.dynamicProp.visible;
        const res: {
          [ruleSet: string]:
            | { type: "hidden" }
            | { type: "hasValue"; validator: ZodType };
        } = Object.fromEntries(
          Object.entries(node.dynamicProp.validation).map(([k, v]) => {
            return [
              k,
              visible ? { type: "hasValue", validator: v } : { type: "hidden" },
            ];
          })
        );
        cache.validator = res;

        return res;
      } else {
        // object 或 array 类型
        if (
          cache.validator !== "dirty" &&
          Object.entries(cache.validator).filter(([_, v]) => v.type === "dirty")
            .length === 0
        ) {
          return cache.validator as {
            [ruleSet: string]:
              | { type: "hidden" }
              | { type: "hasValue"; validator: ZodType };
          };
        }

        const validatorMap: Record<string, Record<string, ZodType>> = {};

        for (let child of node.children) {
          const res = dfs(child);
          // 只收集可见且有校验规则的字段
          Object.entries(res).forEach(([ruleSet, v]) => {
            if (v.type !== "hasValue") {
              return;
            }
            if (!validatorMap[ruleSet]) {
              validatorMap[ruleSet] = {};
            } else {
              validatorMap[ruleSet][child.key] = v.validator;
            }
          });
        }

        if (Object.keys(validatorMap).length > 0) {
          let validator: {
            [ruleSet: string]: {
              type: "hasValue";
              validator: ZodType;
            };
          };

          // 不管是不是数组都当对象校验，因为不确定数组的每个元素结构都一致（比如有的数组项visible为false）
          validator = Object.fromEntries(
            Object.entries(validatorMap).map(([ruleSet, v]) => {
              return [ruleSet, { type: "hasValue", validator: z.object(v) }];
            })
          );

          // 应用自定义的 refine（如果存在）
          Object.entries(validator).forEach(([ruleSet, v]) => {
            const refineFn = node.dynamicProp.validationRefine?.[ruleSet];
            if (refineFn) {
              v.validator = refineFn(v.validator);
            }
          });

          cache.validator = validator;
        } else {
          cache.validator = {};
        }

        return cache.validator as {
          [ruleSet: string]:
            | { type: "hidden" }
            | { type: "hasValue"; validator: ZodType };
        };
      }
    };

    const res = dfs(this.mutableDataSource);
    this.mutableDataSource.cache.validator = res;

    this.finalValidator = res;
  }
}

export { ValidatorCacheManager };
