"use client";

import { Button, message } from "antd";
import { FormModel } from "@/utils/structures";
import { Generator, useDynamicForm } from "@/utils/generator";
import { z } from "zod";

export default function AppPage() {
  // 创建表单模型
  const formModel = new FormModel({
    fields: [
      {
        key: "name",
        label: "姓名",
        control: "input",
        validate: z.string().min(1, "请输入姓名"),
        defaultValue: "",
        helpTip: "请输入您的真实姓名",
      },
      {
        key: "email",
        label: "邮箱",
        control: "input",
        validate: z.string().email("请输入有效的邮箱地址"),
        defaultValue: "",
        helpTip: "用于接收通知",
      },
      {
        key: "gender",
        label: "性别",
        control: "radio",
        options: [
          { label: "男", value: "male" },
          { label: "女", value: "female" },
        ],
        validate: z.enum(["male", "female"], "请选择性别"),
        defaultValue: "male",
      },
      {
        key: "city",
        label: "城市",
        control: "select",
        options: [
          { label: "北京", value: "beijing" },
          { label: "上海", value: "shanghai" },
          { label: "广州", value: "guangzhou" },
          { label: "深圳", value: "shenzhen" },
        ],
        validate: z.string().min(1, "请选择城市"),
        defaultValue: "",
      },
      {
        key: "phone",
        label: "手机号",
        control: "input",
        validate: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
        defaultValue: "",
        controlProps: {
          placeholder: "请输入11位手机号",
        },
      },
      {
        key: "address",
        label: "详细地址",
        control: "input",
        validate: z.string().min(5, "地址至少5个字符"),
        defaultValue: "",
        controlProps: {
          placeholder: "请输入详细地址",
        },
      },
    ],
  });

  // 使用表单 hook
  const form = useDynamicForm(formModel);

  // 提交处理
  const handleSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功！");
      console.log("表单数据:", data);
    } catch (error) {
      message.error("请检查表单填写是否正确");
      console.error("验证失败:", error);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.setFieldsValue({
      name: "",
      email: "",
      gender: "male",
      city: "",
      phone: "",
      address: "",
    });
    message.info("表单已重置");
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "30px" }}>用户信息登记表</h1>

      <Generator
        model={formModel}
        displayFields={[
          ["name"],
          ["email"],
          ["gender"],
          ["city"],
          ["phone"],
          ["address"],
        ]}
        size="normal"
        displayOption={{
          labelSpan: 4,
          fieldSpan: 20,
          showDebug: false,
        }}
      />

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          gap: "10px",
          justifyContent: "center",
        }}
      >
        <Button type="primary" onClick={handleSubmit} size="large">
          提交
        </Button>
        <Button onClick={handleReset} size="large">
          重置
        </Button>
      </div>
    </div>
  );
}
