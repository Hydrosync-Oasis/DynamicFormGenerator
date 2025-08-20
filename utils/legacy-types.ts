/**
 * 向后兼容性层
 * 为了保持现有代码正常工作，提供旧版本类型的别名和适配器
 */

import type { ZodType } from 'zod';
import type { ComponentType, ReactElement } from 'react';

// ======================== 基础类型（保持不变） ========================

export type FieldKey = string;
export type FieldPath = FieldKey[];
export type FieldValue = any; // 保持 any 以兼容现有代码

// ======================== 旧版本接口（完全兼容） ========================

export type ControlType = "input" | "radio" | "select"
  | ComponentType<{
    value?: FieldValue, onChange?: (value: FieldValue) => void,
    [key: string]: any
  }>;

export interface FieldSchema {
  key: FieldKey;
  label?: string;
  validate?: ZodType;
  control?: ControlType;
  options?: Array<{ label: string; value: string | number | boolean }>;
  initialVisible?: boolean;
  itemProps?: object;
  defaultValue?: FieldValue;
  helpTip?: string | ReactElement;
  childrenFields?: FieldSchema[];
  disabled?: boolean;
}

export interface FieldState {
  value?: FieldValue;
  visible: boolean;
  options: Array<{ label: string; value: string | number | boolean }>;
  alertTip?: string;
  errorMessage?: string;
  validation?: ZodType;
  disabled: boolean;
}

export interface FormSchema {
  fields: FieldSchema[];
}

export type ReflectiveEffect = (ctx: {
  get: (path: FieldPath) => FieldValue;
  set: (path: FieldPath | FieldPath[], prop: keyof FieldState, value: FieldValue) => void;
}) => void;

export interface ReactiveRule {
  deps: FieldPath[]; 
  fn: ReflectiveEffect;
}

export interface FieldWithStateSchema {
  key: FieldKey;
  path: FieldPath;
  state?: FieldState;
  schemaData?: Omit<FieldSchema, 'key' | 'validate'>;
  effect?: ReflectiveEffect[];
  children: FieldWithStateSchema[];
  cache?: {
    zodObj?: ZodType
  }
}

// ======================== 同时导出新版本类型（用于迁移） ========================

// 重新导出新版本类型，方便后续迁移
export type {
  FieldKey as NewFieldKey,
  FieldPath as NewFieldPath,
  FieldSchema as NewFieldSchema,
  FieldState as NewFieldState,
  FormSchema as NewFormSchema,
  FieldWithStateSchema as NewFieldWithStateSchema,
  ReactiveRule as NewReactiveRule,
  OptionItem,
  CustomControlProps,
  ReactiveContext,
  ReactiveEffect,
  ValidationError,
  ValidationResult,
  FormEvent,
  FormEventType,
  FormEventListener,
  DeepPartial,
  DeepReadonly
} from './types';
