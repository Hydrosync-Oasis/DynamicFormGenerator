import { z, ZodType } from "zod";
import { MutableFieldNode } from "./type";
import { getNodesOnPath } from "./structures";

class ValidatorCacheManager {
  mutableDataSource: MutableFieldNode;

  finalValidator:
    | "hidden"
    | Record<
        string,
        {
          type: "hasValue";
          validator: ZodType;
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
      if (validatorCache === "hidden") {
        n.cache.validator = "dirty";
        return;
      }

      if (ruleSet) {
        validatorCache[ruleSet] = { type: "dirty" };
        return;
      }

      n.cache.validator = "dirty";
    });
  }

  /**
   * 在调用此函数前确保已经使用 updateNode 进行过更新
   */
  rebuild() {
    const dfs = (
      node: MutableFieldNode
    ):
      | {
          [ruleSet: string]: { type: "hasValue"; validator: ZodType };
        }
      | "hidden" => {
      const cache = node.cache;

      if (node.type === "field") {
        const visible = node.dynamicProp.visible;
        const shouldInclude =
          (visible && node.dynamicProp.includePolicy !== "never") ||
          node.dynamicProp.includePolicy === "always";
        let res:
          | {
              [ruleSet: string]: { type: "hasValue"; validator: ZodType };
            }
          | "hidden" = Object.fromEntries(
          Object.entries(node.dynamicProp.validation).map(([k, v]) => {
            return [k, { type: "hasValue", validator: v }];
          })
        );
        if (!shouldInclude) {
          res = "hidden";
        }
        cache.validator = res;

        return res;
      } else {
        // object 或 array 类型
        if (
          // 如果所有的ruleSet都有值
          cache.validator !== "dirty" &&
          Object.entries(cache.validator).filter(([_, v]) => v.type === "dirty")
            .length === 0
        ) {
          return cache.validator as
            | {
                [ruleSet: string]: { type: "hasValue"; validator: ZodType };
              }
            | "hidden";
        }

        const shouldInclude =
          (node.dynamicProp.visible &&
            node.dynamicProp.includePolicy !== "never") ||
          node.dynamicProp.includePolicy === "always";

        if (!shouldInclude) {
          return "hidden";
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
            }
            validatorMap[ruleSet][child.key] = v.validator;
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
          // 需要求字节点中出现的RuleSet和当前节点的refiner里出现的RuleSet的并集
          const set = new Set<string>();
          Object.entries(validator).forEach(([ruleSet, v]) => {
            const refineFn = node.dynamicProp.validationRefine?.[ruleSet];
            set.add(ruleSet);
            if (refineFn) {
              v.validator = refineFn(v.validator);
            }
          });
          const refiners = node.dynamicProp.validationRefine;
          for (let ruleSet in refiners) {
            if (!set.has(ruleSet)) {
              // 说明该ruleSet下没有子字段约束，只有refine约束
              validator[ruleSet] = {
                type: "hasValue",
                validator: refiners[ruleSet](z.any()),
              };
            }
          }

          cache.validator = validator;
        } else {
          // 嵌套节点本身可见，但没有子节点，仍然应该有校验规则
          cache.validator = {
            default: { type: "hasValue", validator: z.object() },
          };
        }

        return cache.validator as
          | {
              [ruleSet: string]: { type: "hasValue"; validator: ZodType };
            }
          | "hidden";
      }
    };

    const res = dfs(this.mutableDataSource);
    this.mutableDataSource.cache.validator = res;

    this.finalValidator = res;
  }
}

export { ValidatorCacheManager };
