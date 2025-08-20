# Dynamic Form Generator - 类型系统文档

## 文件结构

```
utils/
├── index.ts              # 主入口文件，导出所有公共 API
├── types.ts              # 新版本标准类型定义
├── legacy-types.ts       # 向后兼容类型层
├── structures.ts         # FormModel 核心实现
├── structures.d.ts       # TypeScript 类型声明文件
└── generator.tsx         # React 组件实现
```

## 类型系统设计

### 1. 标准类型 (`types.ts`)

包含所有新版本的标准类型定义：

- **基础类型**: `FieldKey`, `FieldPath`, `FieldValue`
- **组件类型**: `ControlType`, `CustomControlProps`
- **配置接口**: `FieldSchema`, `FieldState`, `FormSchema`
- **响应式系统**: `ReactiveContext`, `ReactiveEffect`, `ReactiveRule`
- **验证系统**: `ValidationError`, `ValidationResult`
- **事件系统**: `FormEvent`, `FormEventListener`
- **工具类型**: `DeepPartial`, `DeepReadonly`

### 2. 兼容类型 (`legacy-types.ts`)

提供向后兼容性支持：

- 保持所有旧版本接口不变
- 使用旧的属性名称（如 `fn` 而不是 `effect`）
- 支持旧的数据结构（如 `childrenFields`）
- 类型名称保持一致

### 3. 声明文件 (`structures.d.ts`)

为 IDE 和 TypeScript 编译器提供类型信息：

- 完整的 `FormModel` 类声明
- 所有公共方法的类型签名
- 详细的 JSDoc 注释
- 使用示例

## 使用方式

### 新项目（推荐）

```typescript
import { FormModel, type FormSchema } from './utils';

const schema: FormSchema = {
  fields: [
    {
      key: 'username',
      label: '用户名',
      control: 'input',
      required: true
    }
  ]
};

const form = new FormModel(schema);
```

### 现有项目（兼容）

```typescript
import { FormModel } from './utils/structures';
import type { FormSchema } from './utils/legacy-types';

// 现有代码无需修改，完全兼容
const schema: FormSchema = {
  fields: [
    {
      key: 'username',
      label: '用户名',
      control: 'input',
      helpTip: '请输入用户名',  // 旧属性名
      childrenFields: []       // 旧属性名
    }
  ]
};
```

## 迁移指南

### 类型迁移

| 旧版本 | 新版本 | 说明 |
|--------|--------|------|
| `ReflectiveEffect` | `ReactiveEffect` | 响应式副作用函数 |
| `childrenFields` | `children` | 子字段属性 |
| `helpTip` | `helpText` | 帮助文本 |
| `itemProps` | `controlProps` | 控件属性 |
| `alertTip` | `warningMessage` | 警告消息 |

### 接口迁移

1. **导入更新**:
   ```typescript
   // 旧版本
   import type { FieldSchema } from './utils/legacy-types';
   
   // 新版本
   import type { FieldSchema } from './utils/types';
   ```

2. **属性重命名**:
   ```typescript
   // 旧版本
   const field: FieldSchema = {
     key: 'test',
     childrenFields: [],
     helpTip: 'help'
   };
   
   // 新版本
   const field: FieldSchema = {
     key: 'test',
     children: [],
     helpText: 'help'
   };
   ```

## 版本计划

- **v1.0**: 当前版本，完全向后兼容
- **v1.1**: 标记旧类型为 `@deprecated`
- **v2.0**: 移除旧类型，使用新标准类型

## 开发规范

1. **新功能**: 只使用 `types.ts` 中的标准类型
2. **维护**: 保持 `legacy-types.ts` 的兼容性
3. **文档**: 更新类型注释和使用示例
4. **测试**: 确保新旧类型系统都能正常工作

## 特性支持

- ✅ 响应式数据流
- ✅ 实时验证
- ✅ 条件渲染  
- ✅ 嵌套表单
- ✅ 自定义组件
- ✅ 事件系统
- ✅ 多步骤表单
- ⏳ 国际化支持
- ⏳ 主题定制
