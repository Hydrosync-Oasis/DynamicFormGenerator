/**
 * Dynamic Form Generator - Core Types
 * 动态表单生成器核心类型定义
 * 
 * @version 1.0.0
 * @author Dynamic Form Generator Team
 */

import type { ZodType } from "zod";
import type { ComponentType, ReactElement } from "react";

// ======================== 基础类型 ========================

/**
 * 字段唯一标识符
 */
export type FieldKey = string;

/**
 * 字段路径，用于定位嵌套字段
 * @example ['user', 'profile', 'name']
 */
export type FieldPath = FieldKey[];

/**
 * 字段值类型，支持任意类型
 * TODO: 可考虑使用泛型约束提供更好的类型安全
 */
export type FieldValue = unknown;

/**
 * 选项项接口
 */
export interface OptionItem {
  /** 显示标签 */
  label: string;
  /** 选项值 */
  value: string | number | boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义数据 */
  data?: Record<string, unknown>;
}

// ======================== 组件相关类型 ========================

/**
 * 自定义控件组件接口
 */
export interface CustomControlProps {
  /** 当前值 */
  value?: FieldValue;
  /** 值变化回调 */
  onChange?: (value: FieldValue) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 其他属性 */
  [key: string]: unknown;
}

/**
 * 控件类型定义
 */
export type ControlType = 
  | "input"    // 输入框
  | "textarea" // 文本域
  | "radio"    // 单选框
  | "checkbox" // 复选框
  | "select"   // 下拉选择
  | "switch"   // 开关
  | "slider"   // 滑块
  | "date"     // 日期选择器
  | "time"     // 时间选择器
  | "file"     // 文件上传
  | ComponentType<CustomControlProps>; // 自定义组件

// ======================== 字段配置接口 ========================

/**
 * 字段基础配置接口
 */
export interface FieldSchema {
  /** 字段唯一标识 */
  key: FieldKey;
  
  /** 字段显示标签 */
  label?: string;
  
  /** 字段描述 */
  description?: string;
  
  /** 字段验证规则 */
  validate?: ZodType;
  
  /** 控件类型 */
  control?: ControlType;
  
  /** 选项列表 (适用于 radio, checkbox, select 等) */
  options?: OptionItem[];
  
  /** 初始可见性 */
  initialVisible?: boolean;
  
  /** 传递给控件的额外属性 */
  controlProps?: Record<string, unknown>;
  
  /** 字段容器的额外属性 */
  containerProps?: Record<string, unknown>;
  
  /** 默认值 */
  defaultValue?: FieldValue;
  
  /** 帮助提示 */
  helpText?: string | ReactElement;
  
  /** 占位符文本 */
  placeholder?: string;
  
  /** 嵌套子字段 */
  children?: FieldSchema[];
  
  /** 字段是否禁用 */
  disabled?: boolean;
  
  /** 字段是否只读 */
  readonly?: boolean;
  
  /** 字段是否必填 */
  required?: boolean;
  
  /** 字段分组 */
  group?: string;
  
  /** 字段排序权重 */
  order?: number;
  
  /** 自定义CSS类名 */
  className?: string;
  
  /** 自定义样式 */
  style?: Record<string, unknown>;
  
  /** 条件显示规则 */
  showWhen?: {
    field: FieldPath;
    value: FieldValue;
    operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin';
  };
}

// ======================== 运行时状态接口 ========================

/**
 * 字段运行时状态
 */
export interface FieldState {
  /** 当前值 */
  value?: FieldValue;
  
  /** 是否可见 */
  visible: boolean;
  
  /** 动态选项列表 */
  options: OptionItem[];
  
  /** 警告提示 */
  warningMessage?: string;
  
  /** 错误消息 */
  errorMessage?: string;
  
  /** 成功提示 */
  successMessage?: string;
  
  /** 动态验证规则 */
  validation?: ZodType;
  
  /** 是否禁用 */
  disabled: boolean;
  
  /** 是否只读 */
  readonly: boolean;
  
  /** 是否必填 */
  required: boolean;
  
  /** 加载状态 */
  loading?: boolean;
  
  /** 字段状态：正常/警告/错误/成功 */
  status?: 'normal' | 'warning' | 'error' | 'success';
  
  /** 最后修改时间 */
  lastModified?: Date;
  
  /** 是否已被用户修改过 */
  isDirty?: boolean;
  
  /** 是否已经过验证 */
  isValidated?: boolean;
}

// ======================== 表单配置接口 ========================

/**
 * 表单配置接口
 */
export interface FormSchema {
  /** 表单字段列表 */
  fields: FieldSchema[];
  
  /** 表单标题 */
  title?: string;
  
  /** 表单描述 */
  description?: string;
  
  /** 表单布局模式 */
  layout?: 'horizontal' | 'vertical' | 'inline' | 'grid';
  
  /** 网格布局配置 */
  gridConfig?: {
    columns: number;
    gap?: number;
    responsive?: Record<string, number>;
  };
  
  /** 表单验证模式 */
  validateMode?: 'onChange' | 'onBlur' | 'onSubmit' | 'manual';
  
  /** 是否显示重置按钮 */
  showReset?: boolean;
  
  /** 是否显示提交按钮 */
  showSubmit?: boolean;
  
  /** 提交按钮文本 */
  submitText?: string;
  
  /** 重置按钮文本 */
  resetText?: string;
}

// ======================== 响应式系统类型 ========================

/**
 * 响应式上下文接口
 */
export interface ReactiveContext {
  /** 获取字段值 */
  get: (path: FieldPath, prop?: keyof FieldState) => FieldValue;
  
  /** 设置字段状态 */
  set: (
    path: FieldPath | FieldPath[], 
    prop: keyof FieldState, 
    value: FieldValue
  ) => void;
  
  /** 批量设置多个字段 */
  batch: (updates: Array<{
    path: FieldPath;
    prop: keyof FieldState;
    value: FieldValue;
  }>) => void;
  
  /** 获取表单所有数据 */
  getFormData: () => Record<string, unknown>;
  
  /** 验证指定字段 */
  validate: (paths?: FieldPath[]) => Promise<boolean>;
  
  /** 重置指定字段 */
  reset: (paths?: FieldPath[]) => void;
}

/**
 * 响应式副作用函数
 */
export type ReactiveEffect = (ctx: ReactiveContext) => void | Promise<void>;

/**
 * 响应式规则接口
 */
export interface ReactiveRule {
  /** 依赖的字段路径 */
  deps: FieldPath[];
  
  /** 副作用函数 */
  effect: ReactiveEffect;
  
  /** 规则名称，用于调试 */
  name?: string;
  
  /** 是否立即执行 */
  immediate?: boolean;
  
  /** 防抖延迟时间(ms) */
  debounce?: number;
  
  /** 规则优先级 */
  priority?: number;
}

// ======================== 内部状态接口 ========================

/**
 * 字段完整状态接口（包含配置和运行时状态）
 */
export interface FieldWithStateSchema {
  /** 字段标识 */
  key: FieldKey;
  
  /** 字段路径 */
  path: FieldPath;
  
  /** 运行时状态 */
  state?: FieldState;
  
  /** 配置数据（排除key和validate） */
  schema?: Omit<FieldSchema, 'key' | 'validate'>;
  
  /** 绑定的副作用列表 */
  effects?: ReactiveEffect[];
  
  /** 子字段 */
  children: FieldWithStateSchema[];
  
  /** 缓存数据 */
  cache?: {
    /** 编译后的Zod验证对象 */
    zodSchema?: ZodType;
    /** 计算属性缓存 */
    computed?: Record<string, unknown>;
    /** 最后计算时间 */
    lastComputed?: Date;
  };
  
  /** 字段元数据 */
  meta?: {
    /** 创建时间 */
    createdAt?: Date;
    /** 更新时间 */
    updatedAt?: Date;
    /** 版本号 */
    version?: number;
  };
}

// ======================== 验证相关类型 ========================

/**
 * 验证错误接口
 */
export interface ValidationError {
  /** 字段路径 */
  path: FieldPath;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code?: string;
  /** 错误参数 */
  params?: Record<string, unknown>;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否验证成功 */
  success: boolean;
  /** 验证后的数据 */
  data?: Record<string, unknown>;
  /** 错误列表 */
  errors?: ValidationError[];
}

// ======================== 事件类型 ========================

/**
 * 表单事件类型
 */
export type FormEventType = 
  | 'fieldChange'     // 字段值变化
  | 'fieldBlur'       // 字段失焦
  | 'fieldFocus'      // 字段聚焦
  | 'fieldValidate'   // 字段验证
  | 'formSubmit'      // 表单提交
  | 'formReset'       // 表单重置
  | 'formValidate'    // 表单验证
  | 'ruleExecute';    // 规则执行

/**
 * 表单事件接口
 */
export interface FormEvent<T = unknown> {
  /** 事件类型 */
  type: FormEventType;
  /** 触发字段路径 */
  fieldPath?: FieldPath;
  /** 事件数据 */
  payload?: T;
  /** 事件时间戳 */
  timestamp: number;
  /** 是否可取消 */
  cancelable?: boolean;
  /** 取消事件 */
  preventDefault?: () => void;
}

/**
 * 事件监听器
 */
export type FormEventListener<T = unknown> = (event: FormEvent<T>) => void | Promise<void>;

// ======================== 工具类型 ========================

/**
 * 深度可选类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 提取字段值类型
 */
export type ExtractFieldValue<T extends FieldSchema> = 
  T['defaultValue'] extends infer V ? V : FieldValue;

/**
 * 表单数据类型提取器
 */
export type FormData<T extends FormSchema> = {
  [K in T['fields'][number]['key']]: ExtractFieldValue<
    Extract<T['fields'][number], { key: K }>
  >;
};
