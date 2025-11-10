import { ZodType } from "zod";
import { ComponentType } from "react";

export type FieldKey = string;

export type FieldPath = FieldKey[];
export type FieldValue = any; // 可扩展为数组等

export type ControlType =
  | "input"
  | "radio"
  | "select"
  | ComponentType<{
      value?: FieldValue;
      onChange?: (value: FieldValue) => void;
      [key: string]: any;
    }>; // 自定义渲染表单组件，用户也可以传入自己的组件渲染

export type FieldType = "array" | "object" | "field";

export type EffectInvokeReason =
  | "children-updated"
  | "value-changed"
  | "dependencies-collecting"
  | "initial-run";

export type ReactiveEffectContext = {
  /**
   * Read a field's value.
   * @param path The field path to read.
   * @param isDependency Whether this access should be tracked as a reactive dependency
   *                     when used inside rule registration's dependency collection phase.
   *                     Default true. Pass false to read without tracking.
   */
  get: (path: FieldPath, isDependency?: boolean) => FieldValue;
  setVisible: (path: FieldPath, visible: boolean) => void;
  setValue: (
    path: FieldPath,
    value: FieldValue,
    option?: { invokeOnChange?: boolean; invokeEffect?: boolean }
  ) => void;
  setValidation: (path: FieldPath, validator: ZodType) => void;
  setArray: (
    path: FieldPath,
    value: Record<string, any>,
    option?: { shouldTriggerRule?: boolean }
  ) => void;
  setAlertTip: (path: FieldPath, content: React.ReactNode) => void;
  setItemProp: (path: FieldPath, propName: string, propValue: any) => void;
  insertIntoArray: (
    path: FieldPath,
    value: Record<string, any>,
    position: "before" | "after"
  ) => void;
};

export interface ReactiveRule {
  deps: FieldPath[];
  fn: ReactiveEffect;
}

export type ReactiveEffect = (
  ctx: ReactiveEffectContext,
  cause: EffectInvokeReason,
  info?: { changedPath?: FieldPath }
) => void;

/**
 * Describes the schema of a dynamic form field, supporting:
 *
 * - Leaf/control fields (a single input rendered by a control)
 * - Nested object groups (a container with child fields)
 * - Arrays of nested fields (a repeatable list of items with a shared item schema)
 *
 * Discriminant:
 * - Leaf fields do not declare `isArray`.
 * - Nested variants declare `isArray`:
 *   - `isArray: false` => an object group with `childrenFields`.
 *   - `isArray: true`  => an array field with `arraySchema` describing each item.
 *
 * Leaf/control field (no `isArray`):
 * - key: Unique field identifier.
 * - label: User-facing label for the field.
 * - control: The UI control type used to render the field.
 * - validate?: ZodType-based validator for the field value.
 * - options?: Selectable options for choice-based controls (label/value pairs).
 * - initialVisible?: Whether the field is initially visible.
 * - controlProps?: Arbitrary props passed through to the control renderer.
 * - defaultValue?: Initial/default value for the field.
 * - helpTip?: A help text or JSX hint rendered alongside the field.
 * - disabled?: Whether the field is disabled.
 *
 * Nested object group (`isArray: false`):
 * - key: Unique identifier for the group.
 * - isArray: false
 * - childrenFields: An array of nested `FieldSchema2` definitions composing the object.
 *
 * Array of nested fields (`isArray: true`):
 * - key: Unique identifier for the array field.
 * - isArray: true
 * - arraySchema: The schema for a single array item. The item schema omits `key`
 *   (items are typically indexed rather than keyed).
 *
 * Remarks:
 * - Use the leaf/control variant for standalone inputs (text, select, checkbox, etc.).
 * - Use the object group to compose complex objects via multiple child fields.
 * - Use the array variant for repeatable groups (e.g., a list of addresses),
 *   where each item follows the same `arraySchema`.
 *
 * See also:
 * - FieldKey: unique key type for fields.
 * - ControlType: enumeration or union of supported UI controls.
 * - ZodType: validation type from Zod for runtime validation.
 * - FieldValue: type of values handled by the form.
 *
 * @example
 * // Leaf field
 *  { key: 'email', label: 'Email', control: 'text', validate: z.string().email() }
 *
 * @example
 * // Nested object group
 *  { key: 'profile', isArray: false, childrenFields: [ ...nested fields... ] }
 *
 * @example
 * // Array of nested fields
 *  { key: 'phones', isArray: true, arraySchema: { control: 'text', label: 'Phone' } }
 */
export type FieldSchema =
  // 字段 (叶子结点)
  | {
      key: FieldKey;
      label: string;
      control?: ControlType;
      validate?: ZodType;
      initialVisible?: boolean;
      controlProps?: Record<string, unknown>;
      defaultValue?: FieldValue;
      helpTip?: string | JSX.Element;
      FieldDisplayComponent?: React.ElementType<{
        state: ImmutableFormState;
        onChange: (value: FieldValue, path: FieldPath) => void;
      }>;
    }
  // 数组型嵌套字段
  | {
      key: FieldKey;
      isArray: true;
      arraySchema: Omit<FieldSchema, "key">;
      LayoutComponent?: React.ElementType<{
        children: React.ReactNode;
        state: ImmutableFormState;
      }>;
    }
  // 对象型嵌套字段
  | {
      key: FieldKey;
      isArray: false;
      childrenFields: FieldSchema[];
      LayoutComponent?: React.ElementType<{
        children: React.ReactNode;
        state: ImmutableFormState;
      }>;
    };

// 存放字段运行时的响应式字段
export interface LeafDynamicProp {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  alertTip?: React.ReactNode;
  errorMessage?: string;
  validation?: ZodType; // 响应式校验规则
  controlProp: Record<string, any> | undefined;
}

export interface LeafFieldStaticProp {
  label: string;
  toolTip: React.ReactNode;
  control?: ControlType;
  FieldDisplayComponent?: React.ElementType<{
    state: ImmutableFormState;
    onChange: (value: FieldValue, path: FieldPath) => void;
  }>;
  defaultValue: FieldValue;
}

export interface NestedFieldStaticProp {
  LayoutComponent?: React.ElementType<{
    children: React.ReactNode;
    state: ImmutableFormState;
  }>;
}

export interface NestedFieldDynamicProp {
  validationRefine?: (z: ZodType) => ZodType;
}

type MutableFieldNodeBaseType = {
  key: FieldKey;
  /**
   * 一个包含dummy节点的路径
   */
  path: FieldPath;
  /**
   * 如果是数组型嵌套字段下的字段，需要有一个指向最靠近根字段的属性
   */
  rootArrayField?: MutableFieldNode;
  effect?: Set<ReactiveEffect>;

  /** 为了生成不可变快照的辅助属性，与其他字段不同 */
  snapshot: {
    /** 用于识别哪些节点发生了变化，用于判断是否应该浅拷贝 */
    version: number;
    /** 存储节点的引用，没有发生变化的节点直接浅拷贝 */
    lastValue: ImmutableFormState | null;
  };
  cache: NodeCache;
};

export type NodeCache = {
  /** 存储表单提交后导出的普通对象的缓存 */
  plainObj:
    | {
        objectOnly: Record<string, any> | undefined;
        submitData: Record<string, any> | undefined;
        objectOnlyIncludesHidden: Record<string, any> | undefined;
        type: "hasValue";
      }
    | {
        objectOnlyIncludesHidden: Record<string, any> | undefined;
        type: "hidden";
      }
    | {
        type: "dirty";
      };
  validator:
    | {
        type: "dirty";
      }
    | {
        type: "hidden";
      }
    | {
        type: "hasValue";
        validator: ZodType;
      };
};

export type MutableFieldNode = MutableFieldNodeBaseType &
  (
    | {
        type: "field";
        dynamicProp: LeafDynamicProp;
        staticProp: LeafFieldStaticProp;
        /** 字段运行时的响应式字段，如果字段是isArray: true的子节点，则无效 */
        effect: Set<ReactiveEffect>;
      }
    | {
        type: "object";
        dynamicProp: NestedFieldDynamicProp;
        staticProp: NestedFieldStaticProp;
        children: MutableFieldNode[];
      }
    | {
        type: "array";
        dynamicProp: NestedFieldDynamicProp;
        staticProp: {
          /** 定义了数组单个元素的结构体 */
          schema: Omit<FieldSchema, "key">;
          LayoutComponent?: React.ElementType<{
            children: React.ReactNode;
            state: ImmutableFormState;
          }>;
        };
        children: MutableFieldNode[];
      }
  );

export type ImmutableFormFieldProp = {
  label: string;
  value: any;
  errorMessage?: string;
  visible: boolean;
  alertTip?: React.ReactNode;
  toolTip?: React.ReactNode;
  control?: ControlType;
  controlProps?: Record<string, any>;
  required: boolean;
};

// 导出的不可变快照类型
export type ImmutableFormState =
  | {
      path: FieldPath;
      key: string | number;
      type: "field";
      prop: ImmutableFormFieldProp;
      FieldDisplayComponent?: React.ElementType<{
        state: ImmutableFormState;
        onChange: (value: FieldValue, path: FieldPath) => void;
      }>;
    }
  | {
      path: FieldPath;
      key: string | number;
      type: "nested";
      prop: Partial<Omit<ImmutableFormFieldProp, "value" | "options">>;
      children: ImmutableFormState[];
      LayoutComponent?: React.ElementType<{
        children: React.ReactNode;
        state: ImmutableFormState;
      }>;
    };
