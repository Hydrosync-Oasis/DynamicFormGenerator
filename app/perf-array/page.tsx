"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Space, message } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";

export default function PerfArrayPage() {
  // 1) 仅声明一个数组型嵌套字段（每个元素为一个简单的输入框）
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "items",
          isArray: true,
          arraySchema: {
            label: "条目",
            control: "input",
            controlProps: { placeholder: "内容" },
            validate: z.string().optional(),
          },
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  // 2) 初始化模型 & Hook
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 3) 首次挂载时通过 setArray 填充 2000 条
  useEffect(() => {
    const data: Record<string, any> = {};
    for (let i = 0; i < 2000; i++) {
      data[i] = `Item ${i + 1}`;
    }
    console.time("setArray(2000)");
    model.setArray(["items"], data);
    console.timeEnd("setArray(2000)");
    model.initial();
    console.log(model);
  }, [model]);

  // 4) 展示字段顺序
  const displayFields: FieldPath[] = useMemo(() => [["items"]], []);

  // 5) 交互
  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，见控制台");
      // eslint-disable-next-line no-console
      console.log("提交数据:", data);
    } catch (e) {
      console.log(e);

      message.error("请检查表单校验错误");
    }
  };

  const fill2000 = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < 2000; i++) {
      data[i] = `Item ${i + 1}`;
    }
    console.time("refill setArray(2000)");
    model.setArray(["items"], data, undefined, true);
    console.timeEnd("refill setArray(2000)");
  };

  const clearAll = () => {
    console.time("clear setArray(0)");
    model.setArray(["items"], {}, undefined, true);
    console.timeEnd("clear setArray(0)");
  };

  return (
    <div className="p-6">
      <Card title="性能测试：数组型字段 x2000" bordered>
        <Generator model={model} displayFields={displayFields} />
        <Divider />
        <Space>
          <Button type="primary" onClick={onSubmit}>
            提交
          </Button>
          <Button onClick={fill2000}>填充2000条</Button>
          <Button onClick={clearAll}>清空</Button>
        </Space>
      </Card>
    </div>
  );
}
