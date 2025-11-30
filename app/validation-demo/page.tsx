"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";
import { FormModel } from "@/utils/structures";
import { Generator, useDynamicForm } from "@/utils/generator";
import { FieldSchema } from "@/utils/type";
import { Button, Card, Space, Typography, Divider, Tag } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function ValidationDemo() {
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [validationLog, setValidationLog] = useState<string[]>([]);

  // 添加验证日志
  const addLog = (message: string) => {
    setValidationLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // 定义表单模式 - 展示三种验证时机和动态可见性
  const schema = useMemo<FieldSchema[]>(() => {
    return [
      {
        key: "username",
        label: "用户名",
        control: "input",
        defaultValue: "",
        // onChange 验证：实时验证
        validate: {
          onChange: z
            .string()
            .min(3, "用户名至少3个字符")
            .max(20, "用户名最多20个字符"),
        },
        helpTip: "实时验证 (onChange)：输入时立即验证长度",
        controlProps: {
          placeholder: "输入用户名（3-20字符）",
        },
      },
      {
        key: "email",
        label: "邮箱",
        control: "input",
        defaultValue: "",
        // onBlur 验证：失焦时验证
        validate: {
          onBlur: z.string().email("请输入有效的邮箱地址"),
        },
        helpTip: "失焦验证 (onBlur)：离开输入框时验证格式",
        controlProps: {
          placeholder: "输入邮箱地址",
        },
      },
      {
        key: "userType",
        label: "用户类型",
        control: "radio",
        defaultValue: "personal",
        validate: z.enum(["personal", "business"]),
        controlProps: {
          options: [
            { label: "个人用户", value: "personal" },
            { label: "企业用户", value: "business" },
          ],
        },
        helpTip: "选择用户类型，控制后续字段的显示",
      },
      {
        key: "idNumber",
        label: "身份证号",
        control: "input",
        defaultValue: "",
        validate: {
          onChange: z
            .string()
            .regex(/^\d{18}$|^\d{17}X$/, "请输入有效的18位身份证号"),
        },
        helpTip: "个人用户专属字段 - onChange 验证",
        controlProps: {
          placeholder: "输入18位身份证号",
        },
      },
      {
        key: "companyName",
        label: "公司名称",
        control: "input",
        defaultValue: "",
        initialVisible: false, // 默认不可见
        validate: {
          onBlur: z.string().min(2, "公司名称至少2个字符"),
        },
        helpTip: "企业用户专属字段 - onBlur 验证",
        controlProps: {
          placeholder: "输入公司名称",
        },
      },
      {
        key: "businessLicense",
        label: "营业执照号",
        control: "input",
        defaultValue: "",
        initialVisible: false, // 默认不可见
        validate: {
          onChange: z
            .string()
            .regex(/^[0-9A-Z]{18}$/, "营业执照号为18位数字或大写字母"),
        },
        helpTip: "企业用户专属字段 - onChange 验证",
        controlProps: {
          placeholder: "输入18位营业执照号",
        },
      },
      {
        key: "password",
        label: "密码",
        control: "input",
        defaultValue: "",
        // onSubmit 验证：仅在提交时验证
        validate: {
          onSubmit: z
            .string()
            .min(8, "密码至少8个字符")
            .regex(/[A-Z]/, "密码必须包含至少一个大写字母")
            .regex(/[a-z]/, "密码必须包含至少一个小写字母")
            .regex(/[0-9]/, "密码必须包含至少一个数字"),
        },
        helpTip: "提交验证 (onSubmit)：仅在点击提交时验证复杂规则",
        controlProps: {
          type: "password",
          placeholder: "输入密码（8+字符，含大小写字母和数字）",
        },
      },
      {
        key: "confirmPassword",
        label: "确认密码",
        control: "input",
        defaultValue: "",
        validate: {
          onSubmit: z.string().min(1, "请确认密码"),
        },
        helpTip: "提交验证 (onSubmit)：仅在提交时验证",
        controlProps: {
          type: "password",
          placeholder: "再次输入密码",
        },
      },
      {
        key: "phone",
        label: "手机号",
        control: "input",
        defaultValue: "",
        // 组合验证：onChange 做基础验证，onSubmit 做完整验证
        validate: {
          onChange: z.string().regex(/^\d*$/, "只能输入数字"),
          onSubmit: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的11位手机号"),
        },
        helpTip: "组合验证：输入时验证数字，提交时验证完整格式",
        controlProps: {
          placeholder: "输入11位手机号",
        },
      },
      {
        key: "age",
        label: "年龄",
        control: "input",
        defaultValue: "",
        validate: {
          onBlur: z
            .string()
            .min(1, "请输入年龄")
            .transform((val) => (val === "" ? undefined : Number(val)))
            .refine(
              (val) =>
                val === undefined || (!isNaN(val) && val >= 18 && val <= 100),
              {
                message: "年龄必须在18-100之间",
              }
            ),
        },
        helpTip: "onBlur 验证：失焦时验证年龄范围",
        controlProps: {
          placeholder: "输入年龄（18-100）",
        },
      },
      {
        key: "website",
        label: "个人网站",
        control: "input",
        defaultValue: "",
        validate: {
          onBlur: z
            .string()
            .url("请输入有效的URL")
            .or(z.string().length(0))
            .optional(),
        },
        helpTip: "onBlur 验证：可选字段，填写时验证URL格式",
        controlProps: {
          placeholder: "输入网站URL（可选）",
        },
      },
    ];
  }, []);

  // 创建表单模型
  const model = useMemo(() => {
    const formModel = new FormModel({ fields: schema });

    // 注册响应式规则：根据用户类型控制字段可见性
    formModel.registerRule((ctx, cause) => {
      const userType = ctx.track(["userType"]);

      if (userType === "personal") {
        // 个人用户：显示身份证号，隐藏企业相关字段
        ctx.setVisible(["idNumber"], true);
        ctx.setVisible(["companyName"], false);
        ctx.setVisible(["businessLicense"], false);
        if (cause !== "dependencies-collecting") {
          addLog("切换到个人用户模式 - 显示身份证号字段");
        }
      } else if (userType === "business") {
        // 企业用户：显示企业相关字段，隐藏身份证号
        ctx.setVisible(["idNumber"], false);
        ctx.setVisible(["companyName"], true);
        ctx.setVisible(["businessLicense"], true);
        if (cause !== "dependencies-collecting") {
          addLog("切换到企业用户模式 - 显示公司名称和营业执照字段");
        }
      }
    });

    // 注册响应式规则：验证密码确认
    formModel.registerRule((ctx, cause) => {
      const password = ctx.track(["password"]);
      const confirmPassword = ctx.track(["confirmPassword"]);

      if (confirmPassword && password !== confirmPassword) {
        ctx.setValidation(
          ["confirmPassword"],
          z.string().refine(() => false, { message: "两次密码输入不一致" }),
          "onSubmit"
        );
      } else {
        ctx.setValidation(
          ["confirmPassword"],
          z.string().min(1, "请确认密码"),
          "onSubmit"
        );
      }
    });

    return formModel;
  }, [schema]);

  const form = useDynamicForm(model);

  const handleSubmit = async () => {
    setSubmitResult(null);
    addLog("🚀 开始提交表单...");

    try {
      const data = await form.submit();
      setSubmitResult({ success: true, data });
      addLog("✅ 表单提交成功！所有验证通过");
    } catch (error: any) {
      setSubmitResult({ success: false, error: error.message });
      addLog("❌ 表单提交失败：存在验证错误");
    }
  };

  const handleReset = () => {
    form.resetFields();
    setSubmitResult(null);
    setValidationLog([]);
    addLog("🔄 表单已重置");
  };

  const handleClearLog = () => {
    setValidationLog([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <Card className="mb-6">
          <Title level={2}>🎯 动态表单验证器演示</Title>
          <Paragraph>
            本演示展示了表单生成器的三种验证时机和动态字段可见性控制能力：
          </Paragraph>
          <Space direction="vertical" className="w-full">
            <div>
              <Tag color="blue">onChange 验证</Tag>
              <Text>
                实时验证，输入时立即反馈（用户名、身份证号、营业执照号、手机号基础验证）
              </Text>
            </div>
            <div>
              <Tag color="green">onBlur 验证</Tag>
              <Text>
                失焦验证，离开输入框时验证（邮箱、公司名称、年龄、网站）
              </Text>
            </div>
            <div>
              <Tag color="orange">onSubmit 验证</Tag>
              <Text>
                提交验证，仅在提交表单时验证（密码复杂度、密码确认、手机号完整验证）
              </Text>
            </div>
            <div>
              <Tag color="purple">动态可见性</Tag>
              <Text>
                根据用户类型切换，显示不同的字段（个人用户显示身份证号，企业用户显示公司信息）
              </Text>
            </div>
          </Space>
        </Card>

        <Card title="📝 表单" className="mb-6">
          <Generator
            model={model}
            displayFields={[
              ["username"],
              ["email"],
              ["userType"],
              ["idNumber"],
              ["companyName"],
              ["businessLicense"],
              ["password"],
              ["confirmPassword"],
              ["phone"],
              ["age"],
              ["website"],
            ]}
          />

          <Divider />

          <Space>
            <Button type="primary" onClick={handleSubmit} size="large">
              提交表单
            </Button>
            <Button onClick={handleReset} size="large">
              重置表单
            </Button>
          </Space>

          {submitResult && (
            <Card
              className="mt-4"
              type="inner"
              title={submitResult.success ? "✅ 提交成功" : "❌ 提交失败"}
            >
              <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(
                  submitResult.success ? submitResult.data : submitResult.error,
                  null,
                  2
                )}
              </pre>
            </Card>
          )}
        </Card>

        <Card
          title="📋 验证日志"
          extra={
            <Button size="small" onClick={handleClearLog}>
              清空日志
            </Button>
          }
        >
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-auto">
            {validationLog.length === 0 ? (
              <div className="text-gray-500">暂无日志...</div>
            ) : (
              validationLog.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="mt-6" title="💡 使用说明">
          <Space direction="vertical" className="w-full">
            <Text strong>1. onChange 验证体验：</Text>
            <Text>• 在"用户名"字段输入少于3个字符，立即看到错误提示</Text>
            <Text>• 在"手机号"字段输入非数字字符，立即被拦截</Text>

            <Text strong className="mt-4">
              2. onBlur 验证体验：
            </Text>
            <Text>• 在"邮箱"字段输入无效邮箱，离开输入框时显示错误</Text>
            <Text>• 在"年龄"字段输入超出范围的值，失焦后提示</Text>

            <Text strong className="mt-4">
              3. onSubmit 验证体验：
            </Text>
            <Text>
              • "密码"字段的复杂度要求仅在提交时验证，避免输入时过度打扰
            </Text>
            <Text>• "密码确认"自动验证两次密码是否一致</Text>

            <Text strong className="mt-4">
              4. 动态可见性体验：
            </Text>
            <Text>• 切换"用户类型"单选框，观察不同字段的显示与隐藏</Text>
            <Text>• 个人用户需要填写身份证号，企业用户需要填写公司信息</Text>

            <Text strong className="mt-4">
              5. 组合验证体验：
            </Text>
            <Text>• "手机号"字段同时使用 onChange 和 onSubmit 验证</Text>
            <Text>• 输入时验证数字格式，提交时验证完整的11位手机号规则</Text>
          </Space>
        </Card>
      </div>
    </div>
  );
}
