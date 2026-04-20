import z, { ZodType } from "zod";
import {
  AnyMutableFieldNode,
  DistributiveOmit,
  FieldPath,
  FieldSchema,
  FieldSource,
  ImmutableFormState,
  MutableFieldNode,
  MutableNestedFieldNode,
} from "./type";

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
  path: FieldPath,
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

export function compileOneMutableNode(
  item: FieldSchema,
  path: FieldPath,
  parent: MutableNestedFieldNode,
  dirty?: boolean,
): AnyMutableFieldNode {
  if ("isArray" in item && item.isArray) {
    return {
      key: item.key,
      path: path,
      type: "array",
      parent,
      dynamicProp: {
        visible: item.initialVisible ?? true,
        include: item.include ?? true,
        removeWhenNoChildren: item.removeWhenNoChildren ?? true,
      },
      staticProp: {
        arraySchema: item.arraySchema!,
        LayoutComponent: item.LayoutComponent,
      },
      children: [],
      snapshot: {
        dirty: "uninitialized",
      },
      effect: new Set(),
      cache: {
        plainObj: { type: "dirty", lastValue: { include: false } },
        validator: "dirty",
        selfDirty: dirty ?? false,
      },
    };
  } else if ("isArray" in item && !item.isArray) {
    return {
      key: item.key,
      path: path,
      type: "object",
      parent,
      dynamicProp: {
        visible: item.initialVisible ?? true,
        include: item.include ?? true,
        removeWhenNoChildren: item.removeWhenNoChildren ?? true,
      },
      staticProp: {
        LayoutComponent: item.LayoutComponent,
      },
      snapshot: {
        dirty: "uninitialized",
      },
      children: [],
      cache: {
        plainObj: { type: "dirty", lastValue: { include: false } },
        validator: "dirty",
        selfDirty: dirty ?? false,
      },
    };
  } else {
    return {
      key: item.key,
      path: path,
      type: "field",
      source: "initial",
      parent,
      dynamicProp: {
        value: item.defaultValue,
        visible: item.initialVisible ?? true,
        include: item.include ?? true,
        validation:
          item.validate instanceof ZodType
            ? {
                onChange: item.validate || z.unknown(),
              }
            : item.validate || { onChange: z.unknown() },
        required: true,
        controlProp: item.controlProps,
        errorMessage: {},
      },
      staticProp: {
        label: item.label,
        toolTip: item.helpTip,
        control: item.control,
        FieldDisplayComponent: item.FieldDisplayComponent,
      },
      snapshot: {
        dirty: "uninitialized",
      },
      effect: new Set(),
      cache: {
        plainObj: { type: "dirty", lastValue: { include: false } },
        validator: "dirty",
        selfDirty: dirty ?? false,
      },
    };
  }
}

/**
 * 全量编译schema为可变节点，不保留任何旧信息，适用于初次设置
 * @param value
 * @param schema
 * @param path
 * @param rootArrayField
 * @returns 最终生成的可变节点
 */
export const compileArrayMutableNode = (
  value: Record<string, any> | undefined,
  schema: FieldSchema,
  path: FieldPath,
  rootArrayField: MutableFieldNode<"array">,
  source: FieldSource,
  parentNode: MutableNestedFieldNode,
): AnyMutableFieldNode => {
  if (!("isArray" in schema)) {
    // 返回一个field type的节点
    const field = compileOneMutableNode(schema, path, parentNode);
    if (field.type !== "field") {
      throw new Error("schema mismatch for field node");
    }
    field.rootArrayField = rootArrayField;
    field.dynamicProp.value = value;
    field.source = source;

    return field;
  }

  const children: AnyMutableFieldNode[] = [];
  if (schema.isArray) {
    const node = compileOneMutableNode(
      schema,
      path,
      parentNode,
    ) as MutableFieldNode<"array">;
    node.children = children;
    node.rootArrayField = rootArrayField;
    // value输入可以是数组，也可以是一个对象，如果是对象，那么对象的key就是字段的key
    Object.entries(value || {}).forEach(([key, v]) => {
      const childSchema: FieldSchema = {
        ...schema.arraySchema,
        key: key,
      } as FieldSchema;
      children.push(
        compileArrayMutableNode(
          v,
          childSchema,
          [...path, key],
          rootArrayField,
          source,
          node,
        ),
      );
    });

    return node;
  } else {
    // 是object
    const node = compileOneMutableNode(
      schema,
      path,
      parentNode,
    ) as MutableFieldNode<"object">;
    node.children = children;
    node.rootArrayField = rootArrayField;
    // value输入是一个对象，遍历schema来从value中取值
    schema.childrenFields!.forEach((childSchema) => {
      const k = childSchema.key;
      const v = value?.[k];
      children.push(
        compileArrayMutableNode(
          v,
          childSchema,
          [...path, k],
          rootArrayField,
          source,
          node,
        ),
      );
    });
    return node;
  }
};
