# 动态表单生成器使用说明

本文档介绍动态表单生成器的核心概念、使用步骤与推荐实践，帮助你在复杂场景中稳定地构建可维护的动态表单。

## 核心概念关系图

```
FormSchema --定义字段结构/校验/控件--> FormModel --响应式状态 & 规则引擎--> React Hook(useDynamicForm) --暴露操作--> Generator 组件 --渲染表单
```

- **FormSchema**：一份纯数据描述，定义字段的层级、控件类型、默认值与基础校验规则。
- **FormModel**：基于 Schema 编译得到的运行时模型，负责字段状态（值、可见性、校验）和响应式规则的触发。
- **useDynamicForm**：将 FormModel 包装成 React Hook，提供 `getFieldValue`、`setFieldValue`、`validateAllFields` 等操作，同时保持与 React 组件生命周期的一致性。
- **Generator 组件**：读取 FormModel 的实时快照并渲染出完整的 UI，当 Model 状态变化时自动刷新界面。

## 快速上手步骤

1. **定义 Schema**：描述字段层级、控件类型、默认值与基础校验。
2. **初始化 FormModel**：`const model = new FormModel(schema)`。
3. **在组件中使用 Hook**：`const form = useDynamicForm(model)`。
4. **渲染 Generator**：`<Generator model={model} displayFields={[["fieldKey"]]} />`，或在示例中通过二维数组按步骤渲染。
5. **注册响应式规则（可选）**：使用 `model.registerRule(effect)` 实现跨字段联动、动态子字段更新等。

示例可参考 `app/page.tsx` 中的完整用法，它展示了如何根据 `ipList` 动态生成数组型字段、如何监听字段变化并调整可见性和校验规则。

## Schema 字段配置一览

| 字段             | 说明                                                        |
| ---------------- | ----------------------------------------------------------- |
| `key`            | 字段唯一标识，用于路径访问。                                |
| `label`          | 表单项标题。                                                |
| `control`        | 预置控件类型（如 `input`、`radio`、`select`）或自定义组件。 |
| `validate`       | 基础 Zod 校验规则，默认提供必填校验。                       |
| `defaultValue`   | 初始值。                                                    |
| `options`        | 单选/下拉等枚举控件的选项。                                 |
| `itemProps`      | 透传给控件的额外属性。                                      |
| `initialVisible` | 初始可见性，用于条件渲染。                                  |
| `childrenFields` | 嵌套字段数组；配合 `isArray` 支持动态子表单。               |
| `isArray`        | 将当前节点声明为数组型嵌套字段。                            |

## 功能说明

- **响应式规则系统**：`registerRule` 自动收集依赖。每次 `ctx.get(path)` 的调用都会被记录，当对应字段值变化或数组型字段的结构发生调整时触发副作用。副作用函数会接收 `cause` 参数，区分触发来源：`value-changed`、`children-updated`、`initial-run` 与 `dependencies-collecting`，便于按需处理不同场景。
- **动态子字段**：通过 `ctx.updateChildren` 为 `isArray: true` 的字段生成或更新子字段树，并可选择是否保留历史填写的数据。
- **规则触发控制**：`ctx.updateChildren` 支持 `shouldTriggerRule: false` 选项，可在批量变更数组结构时抑制额外的规则连锁触发。
- **校验机制**：默认使用字段的 `validate` 定义；你可以通过规则内的 `ctx.setValidation` 替换运行时校验，也可以用 `model.validateAllFields(enhance)` 在提交时注入额外的 `refine`/`superRefine` 逻辑实现跨字段验证。
- **受控值读写**：`model.get(path, "value")` 读取当前值，`model.setValue(path, value)` 更新值，Hook 的 `setFieldsValue` 支持批量赋值。

## 使用原则与最佳实践

### 何时使用数组型嵌套字段

- 当需要按“条目/分组”动态增删一组字段，且这些字段共享相同结构时，应将父级声明为 `isArray: true`。
- 数组型字段内部的每一项依旧可以是对象树，自由组合子字段。

### 数组型字段的监听规则

- 注册规则时，调用 `ctx.get(["perIP"])` 读取数组型字段会把该数组记录为依赖：不仅数组的结构变化（增删、重排、替换 children）会触发，当它的后代字段值发生变化时也会触发该数组字段上的规则。
- 由于数组下的具体子节点是在运行时动态生成的，依赖采集粒度依旧以数组字段为单位；因此推荐围绕数组字段编写规则，再在规则体内手动遍历 `ctx.get` 返回的数组子键，读取或更新所需的后代字段。

### `ctx.get` 的调用位置

- `ctx.get` 会在依赖收集阶段执行，与 React Hook 的用法类似，应保持调用顺序稳定。
- 推荐把所有 `ctx.get` 放在规则函数的顶部或固定的逻辑分支内，避免在条件语句或异步回调中动态增删 `ctx.get` 调用，以确保每次触发时依赖集合一致。

### 注册规则与运行时校验

- 使用 `model.registerRule(effect)` 返回的清理函数在组件卸载时注销规则。
- 可在规则注册后调用 `model.runAllRules()` 主动执行一次，`cause` 将为 `initial-run`，适合在挂载时做初始化同步。
- 在规则中可以通过 `ctx.setValidation` 切换字段的 Zod Schema，并利用 `model.validateField(path)` 主动触发校验。
- **跨字段实时校验**：组合 `registerRule`、`ctx.get` 与 `zod.refine()`/`superRefine()`，即可根据其他字段值动态调整校验。例如在规则内部读取多个字段后调用 `ctx.setValidation(path, zodSchema.refine(...))`。

### 提交与批量校验

- 调用 `form.validateAllFields((schema) => schema.superRefine(...))` 在提交前执行全局增强校验。
- 若还需要获取表单数据，`form.submit()` 会先执行 `validateAllFields` 再返回 `model.getJSONData(true)` 的最新数据。

### 其他注意事项

- 数组节点的值更新应使用 `ctx.updateChildren`，不要直接对其子节点调用 `setValue` 以保证结构与缓存的一致。
- 当需要保持数组项中已填写的数据时，为 `ctx.updateChildren` 传入 `keepPreviousData: true`。
- `model.onChange` 可监听字段值变更（通过 `setValue` 的 `invokeOnChange` 触发），便于与外部状态同步。

## 参考示例

- `app/page.tsx` 展示了一个完整的动态数组场景：
  - 通过 `ipList` 输入动态生成 `perIP` 数组项。
  - 在规则中读取数组节点并为每个条目调整可见性与校验。
  - 使用 `zod.superRefine` 做基础输入校验，并结合 `ctx.setValidation` 实现条件校验。
- `app/paginated-demo/page.tsx` 演示分页表单：
  - 使用 Ant Design 的 `Pagination` 组件拆分字段，跨分页聚合提交。
  - 结合 `ctx.updateChildren`、`ctx.setVisible` 与 `ctx.setValidation` 覆盖数组字段、条件字段和跨字段校验。
  - 通过规则自动生成摘要字段，并在页签切换时调用 `form.validateFields` 保持校验实时。

将本说明与示例代码结合阅读，可以快速掌握动态表单生成器的高级功能与使用范式。
