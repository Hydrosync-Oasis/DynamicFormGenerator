import { ZodType } from "zod";
import { ComponentType } from "react";
import { BootstrapScriptDescriptor } from "react-dom/server";

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
  | "value-changed"
  | "dependencies-collecting"
  | "initial-run";

export type FormCommands = {
  getValue: (path: FieldPath) => FieldValue;
  setVisible: (path: FieldPath, visible: boolean) => void;
  setValue: (
    path: FieldPath,
    values: any,
    option: {
      invokeEffect?: boolean;
    },
    keepStrategy: ValueMergeStrategy,
  ) => void;
  resetField: (path?: FieldPath) => void;
  setValidation: (
    path: FieldPath,
    validator: ZodType,
    ruleSet?: string,
  ) => void;

  setAlertTip: (path: FieldPath, content: React.ReactNode) => void;
  setControlProp: (path: FieldPath, propName: string, propValue: any) => void;
  insertIntoArray: (
    path: FieldPath,
    value: Record<string, any>,
    key: string | undefined,
    position: "before" | "after",
  ) => void;
  validateField: (
    path: FieldPath,
    enableEnhancer: boolean,
    ruleSet?: string,
  ) => Promise<void>;
};

export interface ReactiveRule {
  deps: FieldPath[];
  fn: ReactiveEffect;
}

export type ValueProxy = {
  [key in string]: ValueProxy;
} & ((option?: GetValueOption) => any);

export type GetValueOption = {
  raw?: boolean;
};

export type ReactiveEffect = (
  value: ValueProxy,
  command: FormCommands,
  cause: EffectInvokeReason,
) => void;

export type FieldSource = "initial" | "user" | "source";

export type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

export type ArraySchema = DistributiveOmit<FieldSchema, "key" | "include">;

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
      validate?:
        | ZodType
        | {
            onChange?: ZodType;
            onBlur?: ZodType;
            onSubmit?: ZodType;
          };
      initialVisible?: boolean;
      include?: boolean;
      controlProps?: Record<string, unknown>;
      defaultValue?: FieldValue;
      helpTip?: string | JSX.Element;
      FieldDisplayComponent?: React.ElementType<{
        state: ImmutableFormState;
        onChange: (value: FieldValue, path: FieldPath) => void;
        formCommands: FormCommands;
      }>;
    }
  // 数组型嵌套字段
  | {
      key: FieldKey;
      isArray: true;
      initialVisible?: boolean;
      include?: boolean;
      removeWhenNoChildren?: boolean;
      arraySchema: ArraySchema;
      LayoutComponent?: React.ElementType<{
        render: (state: ImmutableFormState) => React.ReactNode;
        state: ImmutableFormState;
        formCommands: FormCommands;
      }>;
    }
  // 对象型嵌套字段
  | {
      key: FieldKey;
      isArray: false;
      initialVisible?: boolean;
      include?: boolean;
      removeWhenNoChildren?: boolean;
      childrenFields: FieldSchema[];
      LayoutComponent?: React.ElementType<{
        render: (state: ImmutableFormState) => React.ReactNode;
        state: ImmutableFormState;
        formCommands: FormCommands;
      }>;
    };

// 存放字段运行时的响应式字段
export interface LeafFieldDynamicProp {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  include: boolean;
  alertTip?: React.ReactNode;
  errorMessage: {
    [ruleSet: string]: string[] | undefined;
  };
  validation: {
    [ruleSet: string]: ZodType;
  }; // 响应式校验规则
  controlProp: Record<string, any> | undefined;
  required: boolean;
}

export interface LeafFieldStaticProp {
  label: string;
  toolTip: React.ReactNode;
  control?: ControlType;
  FieldDisplayComponent?: React.ElementType<{
    state: ImmutableFormState;
    onChange: (value: FieldValue, path: FieldPath) => void;
    formCommands: FormCommands;
  }>;
}

export interface NestedFieldStaticProp {
  LayoutComponent?: React.ElementType<{
    render: (state: ImmutableFormState) => React.ReactNode;
    state: ImmutableFormState;
    formCommands: FormCommands;
  }>;
}

export interface NestedFieldDynamicProp {
  validationRefine?: { [ruleSet: string]: (z: ZodType) => ZodType };
  visible: boolean;
  include: boolean;
  removeWhenNoChildren: boolean;
}

export type MutableNestedFieldNode = MutableFieldNode<"array" | "object">;

export type AnyMutableFieldNode = MutableFieldNode<FieldType>;

type MutableFieldNodeBaseType<type extends FieldType> = {
  key: FieldKey;
  /**
   * 一个包含dummy节点的路径
   */
  path: FieldPath;
  /**
   * 如果是数组型嵌套字段下的字段，需要有一个指向最靠近根字段的属性
   */
  rootArrayField?: MutableFieldNode<"array">;
  /**
   * 指向父节点的引用
   */
  parent: MutableNestedFieldNode | undefined;
  effect?: Set<ReactiveEffect>;

  /** 为了生成不可变快照的辅助属性，与其他字段不同 */
  snapshot:
    | {
        /** 节点是最新的，可以直接拿缓存用来渲染 */
        dirty: false;
        /** 存储节点的引用，没有发生变化的节点直接浅拷贝 */
        lastValue: ImmutableFormState;
      }
    | {
        /** 节点发生了变化，渲染前需要重新生成不可变快照 */
        dirty: true;
      }
    | {
        /** 刚初始化的节点，不需要渲染 */
        dirty: "uninitialized";
      };
  cache: NodeCache;
};

export type NodeCache = {
  /** 存储表单提交后导出的普通对象的缓存 */
  plainObj:
    | {
        rawData: Record<string, any> | undefined;
        validateData: Record<string, any> | undefined;
        submitData: Record<string, any> | undefined;
        type: "ready";
      }
    | {
        // 脏
        type: "dirty";
      }
    | {
        // 包括include=false的节点
        rawData: Record<string, any> | undefined;
        type: "void";
      };
  // dirty代表不知道有哪些规则集，必须遍历所有子节点收集规则集
  validator:
    | "dirty"
    | "hidden"
    | {
        [ruleSet: string]:
          | {
              // 此处的dirty代表此规则集的校验对象缓存是脏的，需要重新生成
              type: "dirty";
            }
          | {
              type: "hasValue";
              validator: ZodType;
            };
      };
  // 该值与初始值的diff结果，深比较不相等dirty===true
  // 为了效率不考虑当前节点以及所有祖先节点的include，
  selfDirty: boolean;
};

export type MutableFieldNode<T extends FieldType> = T extends "field"
  ? MutableFieldNodeBaseType<"field"> & {
      type: "field";
      dynamicProp: LeafFieldDynamicProp;
      staticProp: LeafFieldStaticProp;
      source: FieldSource;
      /** 字段运行时的响应式字段，如果字段是isArray: true的子节点，则无效 */
      effect: Set<ReactiveEffect>;
    }
  : T extends "object"
    ? MutableFieldNodeBaseType<"object"> & {
        type: "object";
        dynamicProp: NestedFieldDynamicProp;
        staticProp: NestedFieldStaticProp;
        children: MutableFieldNode<FieldType>[];
      }
    : MutableFieldNodeBaseType<"array"> & {
        type: "array";
        dynamicProp: NestedFieldDynamicProp;
        staticProp: {
          /** 定义了数组单个元素的结构体 */
          arraySchema: ArraySchema;
          LayoutComponent?: React.ElementType<{
            render: (state: ImmutableFormState) => React.ReactNode;
            state: ImmutableFormState;
            formCommands: FormCommands;
          }>;
        };
        children: MutableFieldNode<FieldType>[];
      };

export type ImmutableFormFieldProp = {
  label: string;
  value: any;
  errorMessage?: Record<string, string[]> | undefined;
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
        formCommands: FormCommands;
      }>;
    }
  | {
      path: FieldPath;
      key: string | number;
      type: "nested";
      prop: Partial<Omit<ImmutableFormFieldProp, "value" | "options">>;
      children: ImmutableFormState[];
      LayoutComponent?: React.ElementType<{
        render: (state: ImmutableFormState) => React.ReactNode;
        state: ImmutableFormState;
        formCommands: FormCommands;
      }>;
    };

export type ValueMergeStrategy = "merge" | "replace";

export type InitialValueObject =
  | {
      type: "field";
      key: string;
      value: any;
      include: boolean;
    }
  | {
      type: "object";
      key: string;
      children: InitialValueObject[];
      include: boolean;
    }
  | {
      type: "array";
      key: string;
      arraySchema: ArraySchema;
      children: InitialValueObject[];
      include: boolean;
    };
