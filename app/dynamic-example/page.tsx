"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Space, message } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";

export default function DynamicExamplePage() {
  // 1) 定义 Schema
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "userType",
          label: "用户类型",
          control: "radio",
          controlProps: {
            options: [
              { label: "个人", value: "person" },
              { label: "企业", value: "company" },
            ],
          },
          defaultValue: "person",
          validate: z.enum(["person", "company"], {
            message: "请选择用户类型",
          }),
        },
        {
          key: "companyName",
          label: "公司名称",
          control: "input",
          initialVisible: false,
          validate: z.string().min(1, { message: "请输入公司名称" }),
        },
        {
          key: "startAge",
          label: "起始年龄",
          control: "input",
          controlProps: { type: "number", placeholder: "起始年龄" },
          defaultValue: 18,
          validate: z
            .union([z.number(), z.string()])
            .transform((v) => (typeof v === "string" ? Number(v) : v))
            .pipe(z.number().min(0, { message: "起始年龄不能为负" }))
            .optional(),
        },
        {
          key: "endAge",
          label: "结束年龄",
          control: "input",
          controlProps: { type: "number", placeholder: "结束年龄" },
          defaultValue: 60,
          validate: z
            .union([z.number(), z.string()])
            .transform((v) => (typeof v === "string" ? Number(v) : v))
            .pipe(z.number().min(0, { message: "结束年龄不能为负" }))
            .optional(),
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  // 2) 初始化模型 & Hook
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 3) 注册规则：条件显示 + 跨字段校验
  useEffect(() => {
    // 设置一次根级跨字段校验：公司名条件必填 & 年龄范围有效
    model.setRefiner([], (base) =>
      base.superRefine((data, rctx) => {
        const d = data as any;
        // 2) 跨字段：结束年龄必须 ≥ 起始年龄
        const s =
          typeof d?.startAge === "string" ? Number(d?.startAge) : d?.startAge;
        const e = typeof d?.endAge === "string" ? Number(d?.endAge) : d?.endAge;
        if (
          typeof s === "number" &&
          typeof e === "number" &&
          !Number.isNaN(s) &&
          !Number.isNaN(e) &&
          e < s
        ) {
          rctx.addIssue({
            code: "custom",
            path: ["endAge"],
            message: "结束年龄必须 ≥ 起始年龄",
          });
        }
      })
    );

    const stop = model.registerRule((ctx) => {
      const userType = ctx.track(["userType"]);
      // 条件显示：企业显示公司名
      ctx.setVisible(["companyName"], userType === "company");
      // 动态 required：切换字段校验（用于 Required 星标与即时校验）
      if (userType === "company") {
        ctx.setValidation(
          ["companyName"],
          z.string().min(1, { message: "请输入公司名称" })
        );
      } else {
        ctx.setValidation(["companyName"], z.string().optional());
      }
    });

    // 初始化一次，让规则先跑
    model.initial();

    return () => stop();
  }, []);

  // 4) 展示字段顺序
  const displayFields: FieldPath[] = useMemo(
    () => [["userType"], ["companyName"], ["startAge"], ["endAge"]],
    []
  );

  // 5) 交互
  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，见控制台");
      // eslint-disable-next-line no-console
      console.log("提交数据:", data);
    } catch (e) {
      message.error("请检查表单校验错误");
    }
  };

  return (
    <div className="p-6">
      <Card title="动态示例：条件显示 + 跨字段校验" bordered>
        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ labelSpan: 6, fieldSpan: 18, showDebug: true }}
        />
        <Divider />
        <Space>
          <Button type="primary" onClick={onSubmit}>
            提交
          </Button>
          <Button
            onClick={() => {
              form.setFieldsValue({
                userType: "person",
                startAge: 20,
                endAge: 35,
                companyName: "",
              });
            }}
          >
            一键填充
          </Button>
        </Space>
      </Card>
    </div>
  );
}
