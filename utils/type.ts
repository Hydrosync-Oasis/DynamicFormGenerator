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
  updateChildren: (
    path: FieldPath,
    value: FieldSchema[],
    option?: { keepPreviousData?: boolean; shouldTriggerRule?: boolean }
  ) => void;
  setAlertTip: (path: FieldPath, content: React.ReactNode) => void;
  /** 设置字段禁用状态；若 path 指向非叶子，则批量设置其所有后代叶子 */
  setDisable: (path: FieldPath, isDisable: boolean) => void;
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

export interface FieldSchema {
  key: FieldKey;
  label?: string;
  isArray?: boolean;
  validate?: ZodType;
  control?: ControlType;
  // 对于枚举型的字段组件：提供 options
  options?: Array<{ label: string; value: string | number | boolean }>;
  // 初始可见性
  initialVisible?: boolean;
  // 单独给字段组件设置的prop
  controlProps?: Record<string, unknown>;
  // 默认值
  defaultValue?: FieldValue;
  // 帮助说明
  helpTip?: string | JSX.Element;
  // 嵌套子字段
  childrenFields?: FieldSchema[];
  // 字段是否禁用
  disabled?: boolean;
}

// 存放字段运行时的响应式字段
export interface LeafDynamicProp {
  value?: FieldValue;
  visible: boolean; // 是否显示，响应式触发
  options: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: React.ReactNode;
  errorMessage?: string;
  validation?: ZodType; // 响应式校验规则
  disabled: boolean; // 字段组件是否被禁用
  controlProp: Record<string, any> | undefined;
}

export interface LeafFieldStaticProp {
  label: string;
  toolTip: React.ReactNode;
  control: ControlType;
}

export interface NestedFieldDynamicProp {
  validationRefine?: (z: ZodType) => ZodType;
}

type MutableFieldNodeBaseType = {
  key: FieldKey;
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
        validateData: Record<string, any> | undefined;
        submitData: Record<string, any> | undefined;
        type: "hasValue";
      }
    | {
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
        children: MutableFieldNode[];
      }
    | {
        type: "array";
        dynamicProp: NestedFieldDynamicProp;
        children: MutableFieldNode[];
      }
  );

export type ImmutableFormFieldProp = {
  label: string;
  value: any;
  disabled: boolean;
  errorMessage?: string;
  visible: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: React.ReactNode;
  toolTip?: React.ReactNode;
  control: ControlType;
  controlProps?: Record<string, any>;
  required: boolean;
};

// 导出的不可变快照类型
export type ImmutableFormState =
  | {
      key: string | number;
      type: "field";
      prop: ImmutableFormFieldProp;
    }
  | {
      key: string | number;
      type: "nested";
      prop: Partial<Omit<ImmutableFormFieldProp, "value" | "options">>;
      children: ImmutableFormState[];
    };
