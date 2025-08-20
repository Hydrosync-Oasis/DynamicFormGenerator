/**
 * Dynamic Form Generator - 动态表单生成器
 * 
 * 一个功能强大、类型安全的 React 动态表单生成工具库
 * 支持复杂表单场景、实时验证、条件渲染和响应式数据流
 * 
 * @version 1.0.0
 * @author Dynamic Form Generator Team
 * @license MIT
 * 
 * @example
 * ```typescript
 * import { FormModel, type FormSchema } from '@/utils/form-generator';
 * 
 * const schema: FormSchema = {
 *   fields: [
 *     {
 *       key: 'username',
 *       label: '用户名',
 *       control: 'input',
 *       required: true,
 *       validate: z.string().min(2, '用户名至少2个字符')
 *     }
 *   ]
 * };
 * 
 * const formModel = new FormModel(schema);
 * ```
 */

// ======================== 核心导出 ========================

// 主要类
export { FormModel } from './structures';

// 标准类型系统
export type {
  // 基础类型
  FieldKey,
  FieldPath,
  FieldValue,
  ControlType,
  
  // 配置接口
  FieldSchema,
  FieldState,
  FormSchema,
  
  // 选项和属性
  OptionItem,
  CustomControlProps,
  
  // 响应式系统
  ReactiveContext,
  ReactiveEffect,
  ReactiveRule,
  
  // 内部状态
  FieldWithStateSchema,
  
  // 验证系统
  ValidationError,
  ValidationResult,
  
  // 事件系统
  FormEvent,
  FormEventType,
  FormEventListener,
  
  // 工具类型
  DeepPartial,
  DeepReadonly,
  ExtractFieldValue,
  FormData
} from './types';

// ======================== 向后兼容导出 ========================

// 为了保持现有代码正常工作，同时导出旧版本类型
export type {
  ReflectiveEffect
} from './legacy-types';

// ======================== 常量和工具 ========================

/**
 * 支持的控件类型列表
 */
export const CONTROL_TYPES = [
  'input',
  'textarea', 
  'radio',
  'checkbox',
  'select',
  'switch',
  'slider',
  'date',
  'time',
  'file'
] as const;

/**
 * 表单验证模式
 */
export const VALIDATE_MODES = [
  'onChange',
  'onBlur', 
  'onSubmit',
  'manual'
] as const;

/**
 * 表单布局模式
 */
export const LAYOUT_MODES = [
  'horizontal',
  'vertical',
  'inline',
  'grid'
] as const;

/**
 * 字段状态类型
 */
export const FIELD_STATUS = [
  'normal',
  'warning',
  'error',
  'success'
] as const;

/**
 * 表单事件类型
 */
export const FORM_EVENTS = [
  'fieldChange',
  'fieldBlur',
  'fieldFocus',
  'fieldValidate',
  'formSubmit',
  'formReset',
  'formValidate',
  'ruleExecute'
] as const;

// ======================== 版本信息 ========================

/**
 * 工具库版本信息
 */
export const VERSION = '1.0.0';

/**
 * 支持的功能特性
 */
export const FEATURES = {
  /** 响应式数据流 */
  reactive: true,
  /** 实时验证 */
  validation: true,
  /** 条件渲染 */
  conditional: true,
  /** 嵌套表单 */
  nested: true,
  /** 自定义组件 */
  customControls: true,
  /** 事件系统 */
  events: true,
  /** 多步骤表单 */
  wizard: true,
  /** 国际化 */
  i18n: false, // TODO: 后续版本支持
  /** 主题定制 */
  theming: false, // TODO: 后续版本支持
} as const;

// ======================== 默认配置 ========================

/**
 * 默认表单配置
 */
export const DEFAULT_FORM_CONFIG = {
  layout: 'vertical',
  validateMode: 'onChange',
  showReset: true,
  showSubmit: true,
  submitText: '提交',
  resetText: '重置',
} as const;

/**
 * 默认字段配置
 */
export const DEFAULT_FIELD_CONFIG = {
  initialVisible: true,
  disabled: false,
  readonly: false,
  required: false,
} as const;
