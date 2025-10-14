"use client";

import React, { useEffect, useMemo } from "react";
import { Typography, Divider, Card } from "antd";
import { Generator } from "../utils/generator";
import { FieldSchema, FormModel, FormSchema } from "../utils/structures";
import { z } from "zod";
import InnerConfigForm, {
  InnerConfigValue,
} from "./components/InnerConfigForm";

const { Title, Paragraph, Text } = Typography;

export default function Page() {
  // 单步骤：一个输入框(逗号分隔IP) + 一个数组字段“machines”，其子字段通过 updateChildren 全量生成
  const schema = useMemo<FormSchema>(
    () => ({
      fields: [
        {
          key: "ips",
          label: "机器IP（逗号分隔）",
          control: "input",
          helpTip: "例如：10.0.0.1, 10.0.0.2",
          validate: z.string(),
          defaultValue: "",
        },
        {
          key: "machines",
          isArray: true,
          // 初始无子项；每次根据 ips 全量 set(children)
          childrenFields: [],
        },
      ],
    }),
    []
  );

  const model = useMemo(() => new FormModel(schema), [schema]);

  useEffect(() => {
    // 当 ips 变化时，重新生成 machines 的所有子字段（不保留旧值，直接全量设置）
    model.registerRule(({ get, set }) => {
      const raw = (get(["ips"]) as string) || "";
      const ips = Array.from(
        new Set(
          raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );

      // 移除旧示例中的 OS 选项

      // 构建每个 IP 对应的一组配置（内嵌表单：备注/是否自动寻找路径/路径）
      const groups = ips.map((ip) => {
        const configField: FieldSchema = {
          key: "config",
          label: `配置（${ip}）`,
          control: InnerConfigForm as unknown as React.ComponentType<{
            value?: InnerConfigValue;
            onChange?: (v: InnerConfigValue) => void;
            disabled?: boolean;
          }>,
          // 外层对内嵌对象做一次整体校验：当 autoFindPath 为 false 时要求 path 必填
          validate: z
            .object({
              remark: z.string().optional(),
              autoFindPath: z.boolean(),
              path: z.string().optional(),
            })
            .refine(
              (d) => d.autoFindPath || !!(d.path && d.path.trim().length > 0),
              "当未自动寻找路径时，请填写路径"
            ),
          defaultValue: { remark: "", autoFindPath: true, path: "" },
        };

        const groupNode: FieldSchema = {
          key: ip,
          // 非叶子容器，无 state/schemaData，仅承载子字段
          childrenFields: [configField],
        };

        return groupNode;
      });

      // 全量替换 children（不保留旧值）
      // 注意：规则上下文的 set 仅允许 FieldState 的键，这里需要直接使用 model.set 来设置 children
      model.updateChildren(["machines"], groups, { keepPreviousData: true });

      // 内嵌表单自身处理显隐，这里无需在外层再注册显隐规则
    });

    // 初始化一次
    model.runAllRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>按 IP 动态生成嵌套表单</Title>
      <Paragraph type="secondary">
        输入逗号分隔的机器 IP。对于每个 IP，将在数组字段下生成一个嵌套表单：
        备注、是否自动寻找路径，以及在选择“否”时显示的“路径”。 使用
        <Text code>updateChildren</Text>全量替换子字段，并用规则控制字段显隐。
      </Paragraph>

      <Card style={{ marginTop: 12 }}>
        <Generator model={model} displayFields={[["ips"], ["machines"]]} />
      </Card>

      <Divider />
      <Text type="secondary">
        提示：下方快照实时反映当前可见字段的 JSON 值。
      </Text>
    </div>
  );
}
