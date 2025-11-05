import { MutableFieldNode, FieldPath, getNodesOnPath } from "./structures";
import { ImmutableFormState } from "./type";

export function mutableNodeToImmutableNode(
  sourceNode: MutableFieldNode,
  currentVersion: number
): ImmutableFormState {
  const snapshotInfo = sourceNode.snapshot;
  console.log(11);

  if (sourceNode.type === "field") {
    // 准备好返回的叶子结点
    const leafNode: ImmutableFormState = {
      key: sourceNode.key,
      type: "field",
      prop: {
        label: sourceNode.staticProp.label!,
        visible: sourceNode.dynamicProp.visible || true,
        value: sourceNode.dynamicProp.value || null,
        disabled: sourceNode.dynamicProp.disabled || false,
        errorMessage: sourceNode.dynamicProp.errorMessage,
        options: sourceNode.dynamicProp.options,
        alertTip: sourceNode.dynamicProp.alertTip,
        toolTip: sourceNode.staticProp.toolTip,
        control: sourceNode.staticProp.control,
        controlProps: sourceNode.dynamicProp.controlProp,
        required: sourceNode.dynamicProp.validation?.isOptional() || false,
      },
    };

    // 如果没有变化，使用以前的节点
    if (snapshotInfo.version < currentVersion && snapshotInfo.lastValue) {
      return snapshotInfo.lastValue;
    }
    // 如果发生了变化，或者是第一次来，都需要生成并赋值
    snapshotInfo.lastValue = leafNode;
    return leafNode;
  }

  // 是嵌套节点，需要递归
  const nestedField: ImmutableFormState = {
    key: sourceNode.key,
    type: "nested",
    prop: {
      // label: sourceNode.?.label,
    },
    children: [],
  };

  // 如果也是没有发生改变
  if (snapshotInfo.version < currentVersion && snapshotInfo.lastValue) {
    return snapshotInfo.lastValue;
  }
  // 如果是第一次遍历到这个嵌套节点，或确实需要发生更新
  for (let i in sourceNode.children) {
    nestedField.children.push(
      mutableNodeToImmutableNode(sourceNode.children[i], currentVersion)
    );
  }

  snapshotInfo.lastValue = nestedField;

  return nestedField;
}

export function setMutableNode(
  mutableModel: MutableFieldNode,
  path: FieldPath,
  setter: (
    node: MutableFieldNode,
    nodesOnPath: MutableFieldNode[],
    /**用于标记此处发生改变的函数，会对这里生成全新的不可变对象 */
    update: (node: MutableFieldNode) => void
  ) => void,
  currentVersion: number
) {
  const nodes = getNodesOnPath(mutableModel, path, true);
  if (!nodes) {
    throw new Error("this path is not found.");
  }
  nodes?.forEach((n) => {
    n.snapshot.version = currentVersion;
  });

  setter(nodes[nodes.length - 1], nodes, (node) => {
    node.snapshot.version = currentVersion;
  });
}
