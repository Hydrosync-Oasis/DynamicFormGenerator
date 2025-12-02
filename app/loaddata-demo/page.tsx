"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Space, message } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";

export default function LoadDataDemoPage() {
  // 定义简洁的表单Schema
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "name",
          label: "姓名",
          control: "input",
          controlProps: {
            placeholder: "请输入姓名",
          },
          validate: z.string().min(1, { message: "姓名不能为空" }),
        },
        {
          key: "email",
          label: "邮箱",
          control: "input",
          controlProps: {
            placeholder: "请输入邮箱",
          },
          validate: z.string().email({ message: "邮箱格式不正确" }),
        },
        {
          key: "status",
          label: "状态",
          control: "select",
          controlProps: {
            placeholder: "请选择状态",
            options: [
              { label: "激活", value: "active" },
              { label: "未激活", value: "inactive" },
            ],
          },
          validate: z.enum(["active", "inactive"]),
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  // 初始化模型
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 模拟的数据源（比如从服务器加载）
  const dataSource = useMemo(
    () => ({
      name: "张三",
      email: "zhangsan@example.com",
      status: "active",
    }),
    []
  );

  // 动态默认值（比如根据当前时间或其他条件生成）
  const [dynamicDefaults, setDynamicDefaults] = useState({
    email: "default@example.com",
    status: "inactive",
  });

  useEffect(() => {
    model.initial();
  }, [model]);

  // 展示字段
  const displayFields: FieldPath[] = useMemo(
    () => [["name"], ["email"], ["status"]],
    []
  );

  // 测试1：使用 loadData 加载数据
  const handleLoadData = () => {
    model.loadData(dataSource);
    message.success("已使用 loadData 加载数据源");
  };

  // 测试2：使用 setValuesIfUserNotModified 设置动态默认值
  const handleSetDynamicDefaults = () => {
    model.setValuesIfUserNotModified([], dynamicDefaults, false, true);
    message.success("已使用 setValuesIfUserNotModified 设置动态默认值");
  };

  // 测试3：先加载数据，再设置动态默认值（只更新用户未修改的字段）
  const handleLoadAndSetDynamic = () => {
    // 先加载数据
    model.loadData(dataSource);

    // 然后设置动态默认值（只会更新用户未修改的字段）
    setTimeout(() => {
      model.setValuesIfUserNotModified([], dynamicDefaults, false, true);
      message.success("已加载数据并设置动态默认值（未修改字段）");
    }, 100);
  };

  // 更新动态默认值
  const handleUpdateDynamicDefaults = () => {
    const newDefaults = {
      email: `updated_${Date.now()}@example.com`,
      status: "active",
    };
    setDynamicDefaults(newDefaults);
    model.setValuesIfUserNotModified([], newDefaults, false);
    message.success("已更新动态默认值");
  };

  // 重置表单
  const handleReset = () => {
    form.resetFields();
    message.success("已重置表单");
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功");
      console.log("表单数据：", data);
    } catch (error) {
      message.error("表单校验失败");
      console.error(error);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <Card
        title="LoadData 和 SetValuesIfUserNotModified 测试"
        bordered={false}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* 说明 */}
          <div
            style={{
              background: "#f5f5f5",
              padding: "16px",
              borderRadius: "4px",
            }}
          >
            <h3>测试说明：</h3>
            <ul>
              <li>
                <strong>loadData</strong>：从数据源加载数据到表单
              </li>
              <li>
                <strong>setValuesIfUserNotModified</strong>
                ：设置动态默认值，但只更新用户未手动修改过的字段
              </li>
              <li>
                <strong>测试流程</strong>：
                <ol>
                  <li>点击"加载数据"按钮，从数据源加载初始数据</li>
                  <li>手动修改某个字段（如姓名）</li>
                  <li>
                    点击"设置动态默认值"按钮，观察：已修改的字段不会被覆盖
                  </li>
                </ol>
              </li>
            </ul>
          </div>

          {/* 表单 */}
          <div
            style={{
              border: "1px solid #d9d9d9",
              padding: "16px",
              borderRadius: "4px",
            }}
          >
            <Generator model={model} displayFields={displayFields} />
          </div>

          {/* 操作按钮 */}
          <Space wrap>
            <Button onClick={() => console.log(model)}>输出Model</Button>
            <Button type="primary" onClick={handleLoadData}>
              1. 加载数据 (loadData)
            </Button>
            <Button onClick={handleSetDynamicDefaults}>
              2. 设置动态默认值 (setValuesIfUserNotModified)
            </Button>
            <Button onClick={handleLoadAndSetDynamic}>
              3. 加载+设置动态值
            </Button>
            <Button onClick={handleUpdateDynamicDefaults}>
              4. 更新动态默认值
            </Button>
            <Button onClick={handleReset}>重置表单</Button>
            <Button type="primary" onClick={handleSubmit}>
              提交
            </Button>
          </Space>

          {/* 数据显示 */}
          <Card size="small" title="当前数据源" type="inner">
            <pre>{JSON.stringify(dataSource, null, 2)}</pre>
          </Card>

          <Card size="small" title="当前动态默认值" type="inner">
            <pre>{JSON.stringify(dynamicDefaults, null, 2)}</pre>
          </Card>
        </Space>
      </Card>
    </div>
  );
}
