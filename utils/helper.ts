import { FieldPath, ImmutableFormState, MutableFieldNode } from "./type";

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

export function isNodeIncluded(node: MutableFieldNode & { type: "field" }) {
  const includePolicy = node.dynamicProp.includePolicy;
  return (
    includePolicy === "always" ||
    (node.dynamicProp.visible && includePolicy !== "never")
  );
}

/**
 *
 * @param plainObject
 * @param nodes 包含dummy节点的路径所有节点
 * @returns
 */
export function getPlainObject(
  plainObject: any,
  nodes: MutableFieldNode[]
):
  | {
      hasValue: true;
      value: any;
    }
  | {
      hasValue: false;
    } {
  if (nodes.length === 1) {
    return plainObject;
  }

  let resObj = plainObject;
  for (let i = 1; i < nodes.length; i++) {
    let prevNode = nodes[i - 1];
    let curNode = nodes[i];

    // if (prevNode.type === "array") {
    //   const index = prevNode.children.findIndex((x) => x.key === curNode.key);
    //   if (!(index in resObj)) {
    //     return { hasValue: false };
    //   }
    //   resObj = resObj[index];
    // } else {
    if (!(curNode.key in resObj)) {
      return { hasValue: false };
    }
    resObj = resObj[curNode.key];
    // }
  }
  return {
    hasValue: true,
    value: resObj,
  };
}

export function setPlainObject(
  plainObject: { ref: any },
  nodes: MutableFieldNode[],
  newObject: any
) {
  if (nodes.length === 1) {
    plainObject.ref = newObject;
    return;
  }

  let resObj = plainObject.ref;
  for (let i = 1; i < nodes.length - 1; i++) {
    let curNode = nodes[i];

    // if (prevNode.type === "array") {
    //   const index = prevNode.children.findIndex((x) => x.key === curNode.key);
    //   if (!(index in resObj)) {
    //     // 根据当前节点类型创建对象或数组
    //     resObj[index] = {};
    //   }
    //   resObj = resObj[index];
    // } else {
    if (!(curNode.key in resObj)) {
      // 根据当前节点类型创建对象或数组
      resObj[curNode.key] = {};
    }
    resObj = resObj[curNode.key];
    // }
  }

  // 设置最后一个节点的值
  const lastNode = nodes[nodes.length - 1];
  const secondLastNode = nodes[nodes.length - 2];

  if (secondLastNode.type === "array") {
    const index = secondLastNode.children.findIndex(
      (x) => x.key === lastNode.key
    );
    resObj[index] = newObject;
  } else {
    resObj[lastNode.key] = newObject;
  }
}
