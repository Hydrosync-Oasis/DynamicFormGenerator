"use client";

import React, { useEffect, useMemo } from "react";
import { Typography, Divider, Card } from "antd";
import { Generator } from "../utils/generator";
import { FormModel, FormSchema } from "../utils/structures";
import { z } from "zod";

const { Title, Paragraph, Text } = Typography;

export default function Page() {
  // 单步骤：一个输入框(逗号分隔IP) + 一个数组字段“machines”，其子字段通过 set(path, "children") 全量生成
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
          label: "机器配置（随 IP 动态生成）",
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

      const osOptions = [
        { label: "Windows", value: "windows" },
        { label: "Linux", value: "linux" },
      ];

      // 构建每个 IP 对应的一组配置（os 下拉 + remark 输入）
      const groups = ips.map((ip) => {
        const osNode: any = {
          key: "os",
          path: ["machines", ip, "os"],
          state: {
            value: "linux",
            visible: true,
            options: osOptions,
            validation: z.string().min(1, "请选择操作系统"),
            disabled: false,
          },
          schemaData: {
            label: `操作系统（${ip}）`,
            control: "select",
            options: osOptions,
          },
          children: [],
        };

        const remarkNode: any = {
          key: "remark",
          path: ["machines", ip, "remark"],
          state: {
            value: "",
            visible: true,
            options: [],
            validation: z.string().optional(),
            disabled: false,
          },
          schemaData: {
            label: `备注（${ip}）`,
            control: "input",
          },
          children: [],
        };

        const groupNode: any = {
          key: ip,
          path: ["machines", ip],
          // 非叶子容器，无 state/schemaData，仅承载子字段
          children: [osNode, remarkNode],
        };

        return groupNode;
      });

      // 全量替换 children（不保留旧值）
      // 注意：规则上下文的 set 仅允许 FieldState 的键，这里需要直接使用 model.set 来设置 children
      model.set(["machines"], "children", groups);
    });

    // 初始化一次
    model.runAllRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>机器配置（基于 IP 动态生成）</Title>
      <Paragraph type="secondary">
        输入逗号分隔的机器 IP，系统会为每个 IP
        生成一组配置字段（操作系统、备注），并通过
        <Text code>set(path, "children")</Text> 全量替换。
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
