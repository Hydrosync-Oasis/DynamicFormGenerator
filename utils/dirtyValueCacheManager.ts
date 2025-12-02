import { isNodeIncluded } from "./helper";
import { FormModel, getNodesOnPath } from "./structures";
import { FieldPath, MutableFieldNode, NodeCache } from "./type";

// 提交的数据和初始数据是否深比较相等
export class DirtyValueCacheManager {
  formModel: FormModel;

  constructor(mutableDataSource: FormModel) {
    this.formModel = mutableDataSource;
    this.rebuild();
  }

  rebuild() {
    const dfs = (
      node: MutableFieldNode,
      initialData: // 初始值，要拿表单数据和它比对
      | {
            hasValue: false;
          }
        | {
            hasValue: true;
            value: any;
          }
    ): Exclude<NodeCache["dirty"], "dirty"> => {
      if (node.type === "field") {
        // 比较include，以及值
        const include = isNodeIncluded(node);
        node.cache.dirty = {
          isInclude: include,
          isDirty: !(
            initialData.hasValue === include &&
            (!initialData.hasValue ||
              Object.is(node.dynamicProp.value, initialData.value))
          ),
        };
        return node.cache.dirty;
      }

      if (node.cache.dirty !== "dirty") {
        return node.cache.dirty;
      }

      if (node.type === "object") {
        let mayInclude =
          (node.dynamicProp.visible &&
            node.dynamicProp.includePolicy !== "never") ||
          node.dynamicProp.includePolicy === "always" ||
          node.dynamicProp.includePolicy === "when-children-include";

        let childDirty = false;
        let childInclude = false;
        for (let i = 0; i < node.children.length; i++) {
          const curNode = node.children[i];
          const hasInitialValue =
            initialData.hasValue && curNode.key in initialData.value;
          const res = dfs(curNode, {
            hasValue: hasInitialValue,
            value: initialData.hasValue
              ? initialData.value[curNode.key]
              : undefined,
          });
          childDirty = childDirty || res.isDirty;
          childInclude = childInclude || res.isInclude;
        }
        if (
          node.dynamicProp.includePolicy === "when-children-include" &&
          !childInclude
        ) {
          mayInclude = false;
        }

        node.cache.dirty = {
          isDirty: !(mayInclude === initialData.hasValue) || childDirty,
          isInclude: mayInclude,
        };

        return node.cache.dirty;
      }

      if (node.type === "array") {
        let mayInclude =
          (node.dynamicProp.visible &&
            node.dynamicProp.includePolicy !== "never") ||
          node.dynamicProp.includePolicy === "always";

        // 如果是true，一定是include，如果是false，也不一定就不包含
        let childDirty = false;
        let childInclude = false;
        for (let i = 0; i < node.children.length; i++) {
          const curNode = node.children[i];
          const hasInitialValue =
            initialData.hasValue && i in initialData.value;
          const res = dfs(curNode, {
            hasValue: hasInitialValue,
            value: initialData.hasValue ? initialData.value[i] : undefined,
          });
          childDirty = childDirty || res.isDirty;
          childInclude = childInclude || res.isInclude;
        }
        if (
          !childInclude &&
          node.dynamicProp.includePolicy === "when-children-include"
        ) {
          mayInclude = false;
        }

        node.cache.dirty = {
          isDirty: !(
            mayInclude === initialData.hasValue &&
            (!initialData.hasValue ||
              (Array.isArray(initialData.value) &&
                node.children.length === initialData.value.length))
          ),
          isInclude: mayInclude,
        };
        // debugger;

        return node.cache.dirty;
      }

      throw new Error("没有此类型的节点");
    };

    if (!this.formModel.initialValue) {
      throw new Error("initial value has no value");
    }
    dfs(this.formModel.mutableData, {
      hasValue: true,
      value: this.formModel.initialValue,
    });
  }

  updateNode(node: MutableFieldNode) {
    const nodes = getNodesOnPath(
      this.formModel.mutableData,
      node.path.slice(1),
      true
    );
    nodes?.forEach((n) => {
      n.cache.dirty = "dirty";
    });
  }

  updateNodeWithSubtree(node: MutableFieldNode) {
    // 更新路径上的所有父节点
    const nodes = getNodesOnPath(
      this.formModel.mutableData,
      node.path.slice(1),
      true
    );
    nodes?.forEach((n) => {
      n.cache.dirty = "dirty";
    });

    // 更新当前节点及其所有子树
    const markSubtreeDirty = (n: MutableFieldNode) => {
      n.cache.dirty = "dirty";
      if (n.type === "object" || n.type === "array") {
        n.children.forEach(markSubtreeDirty);
      }
    };
    markSubtreeDirty(node);
  }

  getIsDirty(path: FieldPath): boolean {
    // 所有缓存里的isDirty都是不考虑父节点的include的情况的，所以
    // 单独做一个函数，这个函数在获取脏状态时再额外考虑整条链的include情况
    const nodes = getNodesOnPath(this.formModel.mutableData, path);
    if (!nodes) {
      throw new Error("the node is not found: " + path);
    }
    const node = nodes.at(-1)!;
    let include = true;
    this.rebuild();
    for (let i = 0; i < nodes.length; i++) {
      const dirtyCache = nodes[i].cache.dirty;
      if (dirtyCache === "dirty") {
        throw new Error("dirty value");
      }
      include = include && dirtyCache.isInclude;
      if (!include) {
        break;
      }
    }
    if (node?.cache.dirty === "dirty") {
      throw new Error("dirty value");
    }
    // 从 initialValue 按照路径查找值
    let currentValue: any = this.formModel.initialValue;
    let hasInitialValue = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      let key: string | number = node.key;
      if (i > 0) {
        const last = nodes[i - 1];
        if (last.type === "array") {
          key = last.children.findIndex((x) => x.key === node.key);
        }
      }
      if (!(key in currentValue)) {
        hasInitialValue = false;
        break;
      }
      currentValue = currentValue[key];
    }
    // debugger;
    return !(hasInitialValue === include && !node.cache.dirty.isDirty);
  }
}
