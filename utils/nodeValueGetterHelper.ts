import { PlainObjectCacheManager } from "./plainObjectCacheManager";
import { SubscribeManager } from "./subscribeManager";
import { SubscribeNode } from "./subscribeType";
import { AnyMutableFieldNode, MutableFieldNode } from "./type";

export function setNodeValue(
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
  field: AnyMutableFieldNode,
  subManager: SubscribeManager,
  subNode: SubscribeNode,
  plainCacheManager: PlainObjectCacheManager,
) {
  let curField: AnyMutableFieldNode | undefined = field;
  let curSub: SubscribeNode | undefined = subNode;
  while (curField && curSub) {
    setNodeValue(field, subManager, subNode, plainCacheManager);

    curField = curField.parent;
    curSub = curSub.parent;
  }
}
