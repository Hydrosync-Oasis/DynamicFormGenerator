# `utils/structures.ts` API 文档

本文档概述 `utils/structures.ts` 中定义的动态表单内部数据模型、类型别名和 `FormModel` 类的公共接口。该模块负责把声明式表单 Schema 编译为可响应的运行时结构，并提供控制值、可见性、校验规则与子字段的 API。

## 核心类型

### `FieldSchema`
表示单个字段的声明式描述，是构建表单 Schema 的基本单元。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `key` | `string` | 字段唯一键。 |
| `label` | `string` | 字段标题。 |
| `isArray` | `boolean` | 是否为数组字段。 |
| `validate` | `ZodType` | 使用 [Zod](https://github.com/colinhacks/zod) 定义的校验规则。 |
| `control` | `ControlType` | 渲染组件类型，支持内置字符串（`input` / `radio` / `select`）或 React 组件。 |
| `options` | `{label, value}[]` | 选项列表，供枚举型控件使用。 |
| `initialVisible` | `boolean` | 初始可见性，默认为 `true`。 |
| `itemProps` | `Record<string, unknown>` | 传递给具体控件的附加属性。 |
| `defaultValue` | `any` | 默认值。 |
| `helpTip` | `string \| JSX.Element` | 帮助提示信息。 |
| `childrenFields` | `FieldSchema[]` | 嵌套子字段。 |
| `disabled` | `boolean` | 控件是否禁用。 |

### `FieldState`
运行时字段状态，存储在编译后的结点中。

- `value`: 当前值，仅叶子结点有效。
- `visible`: 是否可见；不可见字段不会参与动态校验。
- `options`: 运行时选项数组。
- `alertTip`: 警告提示信息。
- `errorMessage`: 最近一次校验失败的错误文案。
- `validation`: 当前使用的 Zod 校验器，可以被动态替换。
- `disabled`: 控件是否禁用。

### `CompiledFieldNode`
编译后的树结点结构，既包含原始 Schema 信息，也持有运行时状态。

重要属性：

- `path`: 数组形式的字段路径（如 `['user', 'name']`）。
- `type`: `"field"` / `"object"` / `"array"`。
- `state`: 可选 `FieldState`，仅叶子或可见结点拥有。
- `rootArrayField`: 若节点位于数组字段内部，指向最近的数组根节点，便于触发局部规则。
- `effect`: 依赖当前字段的副作用集合。
- `children`: 子结点数组。
- `cache`: 缓存，用于存储编译后的 Zod schema 与数组子节点的历史数据。

## `FormModel`
`FormModel` 是运行时控制器，负责：

- 把 `FormSchema` 编译为 `CompiledFieldNode` 树。
- 维护字段值与可见性状态。
- 注册与运行依赖字段变化的副作用规则。
- 动态构建 Zod schema 以支持仅校验可见字段。

### 构造函数
```ts
const model = new FormModel({
  fields: [/* FieldSchema[] */],
});
```
- 编译 Schema 并生成根节点。
- 自动构建可见字段的动态 Zod schema 缓存。

### 监听与通知
- `subscribe(listener: (nodes: CompiledFieldNode[]) => void): () => void`：订阅内部状态变化，返回取消订阅函数。监听器会收到根节点子数组的引用。【F:utils/structures.ts†L198-L206】
- 内部 `notify()` 在状态变化或校验后触发监听器。【F:utils/structures.ts†L208-L212】

### 节点访问
- `findNodeByPath(path: FieldPath)`：按路径查找节点，不存在时返回 `undefined`。【F:utils/structures.ts†L181-L195】
- `get(path: FieldPath, prop: keyof FieldProp = 'value')`：读取字段值或状态属性。当请求 `children` 时仅数组字段合法；读取值时必须为叶子节点。【F:utils/structures.ts†L214-L251】

### 值与可见性管理
- `setVisible(path, visible)`：切换可见性，重建动态 schema，并通知监听器。【F:utils/structures.ts†L253-L272】
- `setValue(path, value, option?)`：更新值，可选触发 `onChange` 或副作用。对数组内的叶子字段自动触发所属数组的规则。【F:utils/structures.ts†L274-L318】
- `setValidation(path, validator)`：替换叶子节点的校验器并刷新缓存。【F:utils/structures.ts†L320-L333】
- `updateChildren(path, childrenSchema, option?)`：仅用于数组字段，动态替换其子字段定义，并可选择保留缓存值或触发规则。【F:utils/structures.ts†L335-L462】

### 规则系统
- `registerRule({ deps, effect })`：收集依赖路径后注册副作用，返回反注册函数。`deps` 中的每个字段都会记录 effect，并在值变更时触发。【F:utils/structures.ts†L468-L513】
- `runAllRules()`：在初始化或需要时手动触发全部规则。【F:utils/structures.ts†L515-L524】
- `triggerEffectsFor(path, cause)`：手动触发指定字段关联的 effect 集合。【F:utils/structures.ts†L545-L557】

`ReactiveEffectContext` 为规则执行提供读写 API（`get`、`setVisible`、`setValue`、`setValidation`、`updateChildren`）。【F:utils/structures.ts†L128-L152】【F:utils/structures.ts†L531-L543】

### 数据提取
- `getAllLeafPaths(node?)`：返回从指定节点（默认根）出发的所有叶子字段路径，用于批量校验或调试。【F:utils/structures.ts†L559-L584】
- `getJSONData(shouldGenerateArray)`：按照当前可见性构建层级数据对象，`shouldGenerateArray` 为 `true` 时数组节点会生成数组结构。【F:utils/structures.ts†L586-L636】

### 校验能力
- `validateField(path)`：校验单个字段，优先使用响应式校验器；失败时填充 `errorMessage`。【F:utils/structures.ts†L638-L676】
- `validateFields(paths)`：校验多字段的便捷方法，委托给 `validateFieldsWithEnhancer`。【F:utils/structures.ts†L678-L684】
- `validateFieldsWithEnhancer(paths)`：构建只包含目标叶子节点的局部 Zod schema，并返回校验结果。【F:utils/structures.ts†L688-L741】
- `validateAllFields(enhance?)`：构建考虑可见性的动态 schema 校验全部字段，支持传入增强函数进行跨字段校验。失败时为相关节点填充 `errorMessage`。【F:utils/structures.ts†L796-L854】

### Zod 缓存
- `rebuildDynamicSchema()`：基于当前可见节点递归生成 Zod schema，并缓存每个节点的结果，避免重复构建。【F:utils/structures.ts†L743-L794】

## 使用示例
以下示例展示了如何声明 Schema、构造模型、订阅变化并操作字段：

```ts
import { z } from "zod";
import { FormModel } from "@/utils/structures";

const schema = {
  fields: [
    {
      key: "user",
      label: "用户信息",
      childrenFields: [
        {
          key: "name",
          label: "姓名",
          defaultValue: "",
          validate: z.string().min(1, "请输入姓名"),
        },
        {
          key: "age",
          label: "年龄",
          defaultValue: 18,
          validate: z.number().int().min(0),
        },
      ],
    },
  ],
} as const;

const model = new FormModel(schema);

// 订阅变化
const unsubscribe = model.subscribe((nodes) => {
  console.log("当前值:", model.get(["user", "name"]));
});

// 更新值并触发规则
model.setValue(["user", "name"], "Alice", { invokeOnChange: true });

// 校验单个字段
await model.validateField(["user", "name"]);

// 取消订阅
unsubscribe();
```

### 动态控制可见性与子字段
```ts
// 隐藏年龄字段
model.setVisible(["user", "age"], false);

// 基于规则动态添加地址子字段
model.updateChildren(["user"], [
  ...schema.fields[0].childrenFields!,
  {
    key: "address",
    label: "地址",
    defaultValue: "",
    validate: z.string(),
  },
]);
```

上述调用将自动重建动态 Zod schema，并在需要时触发关联的副作用规则。

## 设计要点
- **虚拟根节点**：构造函数创建 `key = "dummy"` 的根节点以统一遍历逻辑。【F:utils/structures.ts†L166-L190】
- **数组缓存**：`NodeChildrenCache` 允许在动态更新数组子字段时保留已有输入值。【F:utils/structures.ts†L349-L414】
- **规则依赖收集**：注册规则时先以 `dependencies-collecting` 模式执行一次 effect，以便记录其依赖的字段路径。【F:utils/structures.ts†L488-L513】

通过以上接口，`FormModel` 可以驱动高度动态的表单体验：字段结构、可见性与校验规则都可以在运行时即时响应。
