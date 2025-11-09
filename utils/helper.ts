import { FieldPath, ImmutableFormState } from "./type";

export function isChildNode(path1: FieldPath, path2: FieldPath): boolean {
  if (path1.length < path2.length) {
    return false;
  }

  for (let i in path2) {
    if (path1[i] !== path2[i]) {
      return false;
    }
  }
  return true;
}

export function isSamePath(path1: FieldPath, path2: FieldPath): boolean {
  if (path1.length !== path2.length) {
    return false;
  }
  for (let i in path1) {
    if (path1[i] !== path2[i]) {
      return false;
    }
  }
  return true;
}

// 根据路径从 state 中查找节点
export const findNodeByPath = (
  node: ImmutableFormState,
  path: FieldPath
): ImmutableFormState | null => {
  if (path.length === 0) {
    return node;
  }

  if (node.type === "field") {
    return null;
  }

  const [first, ...rest] = path;
  const child = node.children.find((c) => c.key === first);

  if (!child) {
    return null;
  }

  if (rest.length === 0) {
    return child;
  }

  return findNodeByPath(child, rest);
};
