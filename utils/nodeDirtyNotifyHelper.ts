import { SubscribeManager } from "./subscribeManager";
import { FieldPath, FormModel, MutableFieldNode } from "./structures";
import { DirtyManager } from "./dirtyManager";
import { AnyMutableFieldNode } from "./type";

export function setNodeDirtyOnChain(
  path: FieldPath,
  subscribeManager: SubscribeManager,
  fieldRoot: AnyMutableFieldNode,
  dirtyManager: DirtyManager,
) {
  let field: AnyMutableFieldNode | undefined = fieldRoot;
  let sub = subscribeManager.findNode([]);
  let initial = dirtyManager.findInitialValue([]);

  let currentEffectiveInclude: boolean = true;
  let initialEffectiveInclude: boolean = true;

  if (sub) {
    subscribeManager.setNewValue(sub, "dirty", !!field?.cache.selfDirty);
  }
  for (let key of path) {
    if (field) {
      if (field.type === "field") {
        throw new Error("type error");
      }
      field = field.children.find((x) => x.key === key);
    }

    if (initial) {
      if (initial.type === "field") {
        throw new Error("type error");
      }
      initial = initial.children.find((x) => x.key === key);
    }

    sub = sub?.children?.get(key);

    currentEffectiveInclude =
      currentEffectiveInclude && (field?.dynamicProp.include ?? false);
    initialEffectiveInclude =
      initialEffectiveInclude && (initial?.include ?? false);

    if (sub) {
      subscribeManager.setNewValue(
        sub,
        "dirty",
        (currentEffectiveInclude && (field?.cache.selfDirty ?? false)) ||
          currentEffectiveInclude !== initialEffectiveInclude,
      );
    }
  }
}
