"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Space, message, Alert } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";

export default function TestSetValuesPage() {
  // 定义表单 Schema - 包含多种字段类型
  const schema = useMemo(
    () => ({
      fields: [
        // 基础字段
        {
          key: "username",
          label: "用户名",
          control: "input",
          controlProps: {
            placeholder: "请输入用户名",
          },
          validate: z.string().min(2, { message: "用户名至少2个字符" }),
        },
        {
          key: "email",
          label: "邮箱",
          control: "input",
          controlProps: {
            placeholder: "请输入邮箱",
            type: "email",
          },
          validate: z
            .string()
            .email({ message: "请输入有效的邮箱地址" })
            .optional(),
        },
        {
          key: "age",
          label: "年龄",
          control: "input",
          controlProps: {
            placeholder: "请输入年龄",
            type: "number",
          },
          validate: z
            .union([z.number(), z.string()])
            .transform((v) => (typeof v === "string" ? Number(v) : v))
            .pipe(
              z.number().min(1, { message: "年龄必须大于0" }).max(150, {
                message: "年龄必须小于150",
              })
            )
            .optional(),
        },
        // 单选框
        {
          key: "gender",
          label: "性别",
          control: "radio",
          controlProps: {
            options: [
              { label: "男", value: "male" },
              { label: "女", value: "female" },
              { label: "其他", value: "other" },
            ],
          },
          validate: z.enum(["male", "female", "other"], {
            message: "请选择性别",
          }),
          defaultValue: "male",
        },
        // 下拉选择
        {
          key: "country",
          label: "国家",
          control: "select",
          controlProps: {
            placeholder: "请选择国家",
            options: [
              { label: "中国", value: "china" },
              { label: "美国", value: "usa" },
              { label: "日本", value: "japan" },
              { label: "英国", value: "uk" },
            ],
          },
          validate: z
            .enum(["china", "usa", "japan", "uk"], {
              message: "请选择国家",
            })
            .optional(),
        },
        // 条件显示字段
        {
          key: "address",
          label: "详细地址",
          control: "input",
          controlProps: {
            placeholder: "请输入详细地址",
          },
          initialVisible: false,
          validate: z.string().min(5, { message: "地址至少5个字符" }),
        },
        // 嵌套对象字段
        {
          key: "contact",
          isArray: false,
          childrenFields: [
            {
              key: "phone",
              label: "联系电话",
              control: "input",
              controlProps: {
                placeholder: "请输入联系电话",
              },
              validate: z
                .string()
                .regex(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号码" })
                .optional(),
            },
            {
              key: "wechat",
              label: "微信号",
              control: "input",
              controlProps: {
                placeholder: "请输入微信号",
              },
              validate: z.string().optional(),
            },
          ],
        },
        // 数组型嵌套字段
        {
          key: "hobbies",
          label: "兴趣爱好",
          isArray: true,
          arraySchema: {
            isArray: false,
            childrenFields: [
              {
                key: "name",
                label: "爱好名称",
                control: "input",
                controlProps: {
                  placeholder: "请输入爱好名称",
                },
                validate: z.string().min(1, { message: "请输入爱好名称" }),
              },
              {
                key: "level",
                label: "熟练程度",
                control: "select",
                controlProps: {
                  placeholder: "请选择熟练程度",
                  options: [
                    { label: "初学者", value: "beginner" },
                    { label: "中级", value: "intermediate" },
                    { label: "高级", value: "advanced" },
                    { label: "专家", value: "expert" },
                  ],
                },
                validate: z.enum(
                  ["beginner", "intermediate", "advanced", "expert"],
                  {
                    message: "请选择熟练程度",
                  }
                ),
              },
            ],
          },
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  // 初始化模型 & Hook
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 注册联动规则：当选择中国时显示详细地址
  useEffect(() => {
    const stop = model.registerRule((ctx) => {
      const country = ctx.get(["country"]);
      const shouldShowAddress = country === "china";

      ctx.setVisible(["address"], shouldShowAddress);

      if (shouldShowAddress) {
        ctx.setValidation(
          ["address"],
          z.string().min(5, { message: "地址至少5个字符" })
        );
      } else {
        ctx.setValidation(["address"], z.string().optional());
      }
    });

    model.initial();
    return () => stop();
  }, [model]);

  // 展示字段
  const displayFields: FieldPath[] = useMemo(
    () => [
      ["username"],
      ["email"],
      ["age"],
      ["gender"],
      ["country"],
      ["address"],
      ["contact"],
      ["hobbies"],
    ],
    []
  );

  // 测试场景1：填充基础数据
  const handleFillBasicData = () => {
    form.setFieldsValue({
      username: "张三",
      email: "zhangsan@example.com",
      age: 25,
      gender: "male",
    });
    message.success("已填充基础数据");
  };

  // 测试场景2：填充完整数据（包括嵌套字段和数组字段）
  const handleFillCompleteData = () => {
    form.setFieldsValue({
      username: "李四",
      email: "lisi@example.com",
      age: 30,
      gender: "female",
      country: "china",
      address: "北京市朝阳区某某街道123号",
      contact: {
        phone: "13800138000",
        wechat: "lisi_wx",
      },
      hobbies: {
        hobby1: {
          name: "游泳",
          level: "intermediate",
        },
        hobby2: {
          name: "编程",
          level: "advanced",
        },
        hobby3: {
          name: "摄影",
          level: "beginner",
        },
      },
    });
    message.success("已填充完整数据（包括嵌套字段和数组字段）");
  };

  // 测试场景3：部分更新数据
  const handlePartialUpdate = () => {
    form.setFieldsValue({
      age: 35,
      country: "usa",
    });
    message.success("已部分更新年龄和国家");
  };

  // 测试场景4：更新嵌套字段
  const handleUpdateNestedField = () => {
    form.setFieldsValue({
      contact: {
        phone: "13912345678",
      },
    });
    message.success("已更新嵌套字段（联系电话）");
  };

  // 测试场景4.5：更新数组字段
  const handleUpdateArrayField = () => {
    form.setFieldsValue({
      hobbies: {
        hobby1: {
          name: "篮球",
          level: "advanced",
        },
        hobby2: {
          name: "吉他",
          level: "intermediate",
        },
      },
    });
    message.success("已更新数组字段（兴趣爱好）");
  };

  // 测试场景5：触发联动规则
  const handleTriggerRule = () => {
    form.setFieldsValue({
      country: "china",
      address: "上海市浦东新区陆家嘴环路1000号",
    });
    message.success("已选择中国，触发地址字段显示");
  };

  // 测试场景6：清空表单（使用 resetFields）
  const handleClearForm = () => {
    form.resetFields();
    message.success("已重置表单到初始状态");
  };

  // 测试场景7：边界值测试
  const handleBoundaryTest = () => {
    form.setFieldsValue({
      username: "A", // 应该触发校验错误（最少2个字符）
      email: "invalid-email", // 应该触发邮箱格式校验错误
      age: 200, // 应该触发年龄范围校验错误
    });
    message.warning("已填充边界值，请查看校验结果");
  };

  // 提交表单
  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，请查看控制台");
      console.log("提交数据:", data);
    } catch (e) {
      message.error("请检查表单校验错误");
      console.error("校验错误:", e);
    }
  };

  // 获取当前表单数据
  const handleGetCurrentData = () => {
    const data = model.getJSONData();
    console.log("当前表单数据:", data);
    message.info("当前数据已打印到控制台");
  };

  return (
    <div className="p-6">
      <Card title="测试 setFieldsValue 函数" bordered>
        <Alert
          message="功能说明"
          description={
            <div>
              <p>
                本页面用于测试表单生成器的 <code>setFieldsValue</code>{" "}
                函数，涵盖以下测试场景：
              </p>
              <ul>
                <li>1. 填充基础数据（单层字段）</li>
                <li>2. 填充完整数据（包括嵌套字段和数组字段）</li>
                <li>3. 部分更新数据</li>
                <li>4. 单独更新嵌套对象字段</li>
                <li>4.5. 单独更新数组型嵌套字段</li>
                <li>5. 触发联动规则（选择中国后显示地址字段）</li>
                <li>6. 清空表单（使用 resetFields）</li>
                <li>7. 边界值测试（触发校验错误）</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ showDebug: true }}
        />

        <Divider />

        <div>
          <h3 style={{ marginBottom: 16 }}>测试操作按钮</h3>
          <Space wrap>
            <Button type="primary" onClick={handleFillBasicData}>
              场景1：填充基础数据
            </Button>
            <Button type="primary" onClick={handleFillCompleteData}>
              场景2：填充完整数据
            </Button>
            <Button onClick={handlePartialUpdate}>场景3：部分更新</Button>
            <Button onClick={handleUpdateNestedField}>
              场景4：更新嵌套字段
            </Button>
            <Button onClick={handleUpdateArrayField}>
              场景4.5：更新数组字段
            </Button>
            <Button onClick={handleTriggerRule}>场景5：触发联动规则</Button>
            <Button onClick={handleClearForm} danger>
              场景6：重置表单
            </Button>
            <Button onClick={handleBoundaryTest} danger>
              场景7：边界值测试
            </Button>
          </Space>
        </div>

        <Divider />

        <Space>
          <Button type="primary" onClick={onSubmit}>
            提交表单
          </Button>
          <Button onClick={handleGetCurrentData}>获取当前数据</Button>
        </Space>
      </Card>
    </div>
  );
}
