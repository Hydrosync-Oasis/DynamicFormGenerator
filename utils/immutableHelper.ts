import { MutableFieldNode, FieldPath, getNodesOnPath } from "./structures";
import { ImmutableFormState } from "./type";

export function mutableNodeToImmutableNode(
  sourceNode: MutableFieldNode
): ImmutableFormState {
  const snapshotInfo = sourceNode.snapshot;

  if (sourceNode.type === "field") {
    // 如果没有变化，使用以前的节点
    if (snapshotInfo.dirty === false && snapshotInfo.lastValue) {
      return snapshotInfo.lastValue;
    }

    // 如果发生了变化，或者是第一次来，都需要生成并赋值
    // 准备好返回的叶子结点
    const leafNode: ImmutableFormState = {
      key: sourceNode.key,
      path: sourceNode.path,
      type: "field",
      prop: {
        label: sourceNode.staticProp.label,
        visible: sourceNode.dynamicProp.visible,
        value: sourceNode.dynamicProp.value,
        errorMessage: sourceNode.dynamicProp.errorMessage,
        alertTip: sourceNode.dynamicProp.alertTip,
        toolTip: sourceNode.staticProp.toolTip,
        control: sourceNode.staticProp.control,
        controlProps: sourceNode.dynamicProp.controlProp,
        required: sourceNode.dynamicProp.required,
      },
      FieldDisplayComponent: sourceNode.staticProp.FieldDisplayComponent,
    };

    sourceNode.snapshot = {
      dirty: false,
      lastValue: leafNode,
    };
    return leafNode;
  }

  // 如果也是没有发生改变
  if (snapshotInfo.dirty === false && snapshotInfo.lastValue) {
    return snapshotInfo.lastValue;
  }

  // 是嵌套节点，需要递归
  const nestedField: ImmutableFormState = {
    key: sourceNode.key,
    path: sourceNode.path,
    type: "nested",
    prop: {
      visible: sourceNode.dynamicProp.visible,
    },
    children: [],
    LayoutComponent: sourceNode.staticProp.LayoutComponent,
  };
  // 如果是第一次遍历到这个嵌套节点，或确实需要发生更新
  for (let i in sourceNode.children) {
    nestedField.children.push(
      mutableNodeToImmutableNode(sourceNode.children[i])
    );
  }
  sourceNode.snapshot = {
    dirty: false,
    lastValue: nestedField,
  };

  return nestedField;
}

export function setMutableNode(
  mutableModel: MutableFieldNode,
  path: FieldPath,
  setter: (
    node: MutableFieldNode,
    nodesOnPath: MutableFieldNode[],
    /**用于标记此处发生改变的函数，会对这里生成全新的不可变对象 */
    mutate: (node: MutableFieldNode) => void
  ) => void | boolean
) {
  const nodes = getNodesOnPath(mutableModel, path, true);

  if (!nodes) {
    throw new Error("this path is not found.");
  }

  const shouldUpdate = setter(nodes[nodes.length - 1], nodes, (node) => {
    node.snapshot.dirty = true;
  });

  if (shouldUpdate !== false) {
    nodes?.forEach((n) => {
      n.snapshot.dirty = true;
    });
  }
}
