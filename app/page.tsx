"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Steps, Space, message, Typography, Divider, Card } from "antd";
import { Generator, useDynamicForm } from "../utils/generator";
import { FormModel, FieldPath, FormSchema } from "../utils/structures";
import { z } from "zod";

const { Title, Paragraph, Text } = Typography;

export default function Page() {
  // 1) 定义表单结构 Schema（包含多步骤会用到的字段分组）
  const schema = useMemo<FormSchema>(
    () => ({
      fields: [
        {
          key: "basic",
          label: "基础信息",
          childrenFields: [
            {
              key: "name",
              label: "姓名",
              control: "input",
              validate: z.string().min(1, "请填写姓名"),
              helpTip: "用于展示在你的资料卡上",
              defaultValue: "",
            },
            {
              key: "role",
              label: "角色",
              control: "select",
              options: [
                { label: "学生", value: "student" },
                { label: "上班族", value: "worker" },
                { label: "其他", value: "other" },
              ],
              validate: z.string(),
              defaultValue: "student",
              helpTip: "不同角色会影响需要填写的内容",
            },
            {
              key: "school",
              label: "学校",
              control: "input",
              validate: z.string().min(1, "请填写学校"),
              initialVisible: false,
              helpTip: "当选择“学生”时需要填写",
              defaultValue: "",
            },
          ],
        },
        {
          key: "contact",
          label: "联系信息",
          childrenFields: [
            {
              key: "email",
              label: "邮箱",
              control: "input",
              validate: z
                .string()
                .email({ message: "邮箱格式不正确" })
                .min(1, "请填写邮箱"),
              defaultValue: "",
            },
            {
              key: "confirmEmail",
              label: "确认邮箱",
              control: "input",
              // 初始简单规则，真正的动态规则会在下面的 reactive rule 中设置
              validate: z.string().min(1, "请再次输入邮箱"),
              helpTip: "需要与邮箱保持一致（动态校验示例）",
              defaultValue: "",
            },
          ],
        },
        {
          key: "payment",
          label: "支付设置",
          childrenFields: [
            {
              key: "amount",
              label: "预算金额",
              control: "input",
              // 将字符串转数字再做校验
              validate: z.coerce.number().min(0, "金额需≥0"),
              helpTip: "不同角色对最低预算有不同要求（动态校验示例）",
              defaultValue: "0",
            },
          ],
        },
      ],
    }),
    []
  );

  // 2) 初始化模型 & 注册规则（仅创建一次）
  const model = useMemo(() => new FormModel(schema), [schema]);

  useEffect(() => {
    // 规则 A：角色为“学生”时显示并要求“学校”，否则隐藏
    model.registerRule(({ get, set }) => {
      const role = get(["basic", "role"]) as string | undefined;
      const isStudent = role === "student";
      set(["basic", "school"], "visible", isStudent);
      set(
        ["basic", "school"],
        "validation",
        isStudent
          ? z.string().min(1, "学生需要填写学校")
          : z.string().optional()
      );
    });

    // 规则 B：确认邮箱需要与邮箱一致（动态校验规则示例）
    model.registerRule(({ get, set }) => {
      const email = (get(["contact", "email"]) as string) ?? "";
      set(
        ["contact", "confirmEmail"],
        "validation",
        z
          .string()
          .min(1, "请再次输入邮箱")
          .refine((v) => v === email, { message: "两次邮箱不一致" })
      );
    });

    // 规则 C：不同角色对金额有不同最低要求
    model.registerRule(({ get, set }) => {
      const role = get(["basic", "role"]) as string | undefined;
      const minByRole = role === "worker" ? 100 : 0;
      set(
        ["payment", "amount"],
        "validation",
        z.coerce.number().min(minByRole, `金额需≥${minByRole}`)
      );
    });

    // 初始执行一次所有规则，确保初始状态正确
    model.runAllRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // 3) 多步骤分页渲染配置
  const steps: { title: string; fields: FieldPath[] }[] = [
    {
      title: "基础信息",
      fields: [["basic"]],
    },
    {
      title: "联系信息",
      fields: [["contact"]],
    },
    {
      title: "支付设置",
      fields: [["payment"]],
    },
  ];

  const [current, setCurrent] = useState(0);
  const form = useDynamicForm(model);

  const next = async () => {
    try {
      console.log(model.getSnapshot());
      await form.validateFields(steps[current].fields);
      setCurrent((c) => c + 1);
    } catch (e) {
      message.error("请修正本页校验错误后再继续");
    }
  };

  const prev = () => setCurrent((c) => c - 1);

  const submitAll = async () => {
    try {
      await form.validateAllFields();
      const data = model.getJSONData();
      message.success({ content: "提交成功，见控制台与下方快照", duration: 2 });
      // 控制台输出，方便查看
      // eslint-disable-next-line no-console
      console.log("提交数据:", data);
    } catch (e) {
      message.error("请修正表单中的错误后再提交");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>动态表单生成器 - 分页 Demo</Title>
      <Paragraph type="secondary">
        本示例演示：多步骤分页、依赖显隐规则（角色→学校）、动态校验规则（确认邮箱与邮箱一致；不同角色的金额下限）。
      </Paragraph>

      <Card style={{ marginTop: 12 }}>
        <Steps
          current={current}
          items={steps.map((s) => ({ title: s.title }))}
        />
        <Divider style={{ margin: "16px 0" }} />

        <Generator model={model} displayFields={steps[current].fields} />

        <Space style={{ marginTop: 12 }}>
          {current > 0 && <Button onClick={prev}>上一步</Button>}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" onClick={submitAll}>
              提交
            </Button>
          )}
        </Space>
      </Card>

      <Divider />
      <Text type="secondary">
        提示：下方“调试：内部对象快照”会实时显示可见字段的 JSON 值。
      </Text>
    </div>
  );
}
