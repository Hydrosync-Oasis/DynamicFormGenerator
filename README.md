# 🚀 动态表单生成器 (Dynamic Form Generator)

一个功能强大、类型安全的 React 动态表单生成工具库，支持复杂表单场景、实时验证、条件渲染和响应式数据流。

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)
![React](https://img.shields.io/badge/React-18+-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ 核心特性

- 🎯 **响应式数据流**: 基于观察者模式的状态管理，实现字段间的智能联动
- 🛡️ **类型安全**: 完整的 TypeScript 支持，提供强类型约束和 IDE 智能提示
- 🔧 **动态校验**: 支持实时、条件、跨字段等多种校验模式，基于 Zod 提供强大的校验能力
- 🎨 **灵活布局**: 支持嵌套字段、多步骤表单、自定义组件等复杂布局
- 🔄 **向后兼容**: 提供完善的兼容层，支持渐进式迁移
- 📱 **现代UI**: 基于 Ant Design 提供美观的表单组件

## 🏗️ 架构设计

### 核心模块

```
utils/
├── types.ts           # 标准类型定义系统
├── legacy-types.ts    # 向后兼容类型层
├── structures.ts      # FormModel 核心实现
├── generator.tsx      # React 组件生成器
└── index.ts          # 统一导出入口
```

### 设计理念

1. **分层架构**: 类型层 → 逻辑层 → 视图层，职责清晰分离
2. **响应式核心**: 基于观察者模式实现的字段间联动
3. **类型驱动**: 通过 TypeScript 和 Zod 实现完整的类型安全
4. **渐进增强**: 支持从简单表单到复杂业务场景的渐进式扩展

## 🚦 快速开始

### 启动开发服务器

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看效果。

[utils 目录文档](./utils/README.md)
