import { PlainObjectCacheManager } from "./plainObjectCacheManager";
import { SubscribeManager } from "./subscribeManager";
import { SubscribeNode } from "./subscribeType";
import { AnyMutableFieldNode, FieldPath } from "./type";

export function setNodeHasValue(
  field: AnyMutableFieldNode,
  subManager: SubscribeManager,
  subNode: SubscribeNode,
  plainCacheManager: PlainObjectCacheManager,
) {
  subManager.setNewValue(subNode, "value", {
    valueGetter: () => {
      plainCacheManager.rebuild(field);
      if (field.cache.plainObj.type === "dirty") {
        throw new Error("dirty value");
      }
      if (field.cache.plainObj.type === "void") {
        return { hasValue: false };
      }

      const newValue = field.cache.plainObj.submitData;
      return { hasValue: true, value: newValue };
    },
  });
}

export function setNodeValue(
  field: AnyMutableFieldNode,
  subManager: SubscribeManager,
  subNode: SubscribeNode,
  plainCacheManager: PlainObjectCacheManager,
  effectiveInclude: boolean,
) {
  if (!effectiveInclude) {
    setNodeHasNoValue(subManager, subNode);
    return;
  }

  setNodeHasValue(field, subManager, subNode, plainCacheManager);
}

export function setNodeHasNoValue(
  subManager: SubscribeManager,
  subNode: SubscribeNode,
) {
  subManager.setNewValue(subNode, "value", {
    valueGetter() {
      return { hasValue: false };
    },
  });
}

export function setNodeValueOnChain(
  path: FieldPath,
  subManager: SubscribeManager,
  plainCacheManager: PlainObjectCacheManager,
) {
  const fieldNodes: AnyMutableFieldNode[] = [
    plainCacheManager.mutableDataSource,
  ];
  let curField: AnyMutableFieldNode = plainCacheManager.mutableDataSource;

  for (const key of path) {
    if (curField.type === "field") {
      throw new Error("field path is invalid: " + path.join("."));
    }
    const nextField = curField.children.find((child) => child.key === key);
    if (!nextField) {
      throw new Error("field node is not found: " + path.join("."));
    }
    fieldNodes.push(nextField);
    curField = nextField;
  }

  const subscribeNodes: (SubscribeNode | undefined)[] = [
    subManager.subscribeTree,
  ];
  let curSub: SubscribeNode | undefined = subManager.subscribeTree;

  for (const key of path) {
    const nextSub: SubscribeNode | undefined = curSub?.children?.get(key);
    subscribeNodes.push(nextSub);
    curSub = nextSub;
  }

  if (fieldNodes.length !== subscribeNodes.length) {
    throw new Error("field chain and subscribe chain length mismatch");
  }

  let currentEffectiveInclude = true;
  for (let i = 0; i < fieldNodes.length; i++) {
    const currentFieldNode = fieldNodes[i];
    const currentSubscribeNode = subscribeNodes[i];
    currentEffectiveInclude =
      currentEffectiveInclude && currentFieldNode.dynamicProp.include;
    currentSubscribeNode &&
      setNodeValue(
        currentFieldNode,
        subManager,
        currentSubscribeNode,
        plainCacheManager,
        currentEffectiveInclude,
      );
  }
}
