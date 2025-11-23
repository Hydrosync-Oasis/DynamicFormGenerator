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
                .refine((v) => v === "" || /^1[3-9]\d{9}$/.test(v), {
                  message: "请输入有效的手机号码",
                })
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
      const country = ctx.track(["country"]);
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

  // 测试场景8：嵌套对象中的缺失值
  const handleMissingNestedValues = () => {
    form.setFieldsValue({
      username: "测试用户",
      contact: {
        phone: "13800138000",
        // wechat 字段缺失，测试部分字段设置
      },
      hobbies: {
        hobby1: {
          name: "跑步",
          // level 字段缺失，测试必填字段缺失
        },
        hobby2: {
          level: "advanced",
          // name 字段缺失
        },
      },
    });
    message.warning("场景8：已设置嵌套对象缺失值，请检查校验");
  };

  // 测试场景9：设置多余的字段（schema中不存在的字段）
  const handleExtraFields = () => {
    form.setFieldsValue({
      username: "测试用户",
      email: "test@example.com",
      // @ts-ignore - 故意设置不存在的字段
      nickname: "小明", // schema中不存在的字段
      birthday: "2000-01-01", // schema中不存在的字段
      contact: {
        phone: "13800138000",
        // @ts-ignore
        qq: "123456789", // contact中不存在的字段
      },
      hobbies: {
        hobby1: {
          name: "游泳",
          level: "intermediate",
          // @ts-ignore
          years: 5, // hobbies中不存在的字段
          description: "业余爱好", // 不存在的字段
        },
      },
    });
    message.info("场景9：已设置多余字段，查看是否被忽略或报错");
  };

  // 测试场景10：空值和 null/undefined 测试
  const handleNullAndEmptyValues = () => {
    form.setFieldsValue({
      username: "", // 空字符串
      email: null as any, // null 值
      age: undefined, // undefined 值
      gender: "male",
      contact: {
        phone: "", // 空字符串
        wechat: null as any, // null 值
      },
      hobbies: {
        hobby1: {
          name: "",
          level: undefined as any,
        },
      },
    });
    message.warning("场景10：已设置空值/null/undefined，检查处理情况");
  };

  // 测试场景11：空对象和空数组
  const handleEmptyObjectAndArray = () => {
    form.setFieldsValue({
      username: "测试用户",
      contact: {}, // 空对象
      hobbies: {}, // 空数组对象
    });
    message.info("场景11：已设置空对象和空数组");
  };

  // 测试场景12：不连续的数组索引
  const handleNonSequentialArray = () => {
    form.setFieldsValue({
      username: "测试用户",
      hobbies: {
        hobby5: {
          // 跳过 hobby1-4，直接从 hobby5 开始
          name: "绘画",
          level: "beginner",
        },
        hobby2: {
          // 不按顺序
          name: "书法",
          level: "intermediate",
        },
        hobby10: {
          // 更大的索引
          name: "舞蹈",
          level: "advanced",
        },
      },
    });
    message.info("场景12：已设置不连续的数组索引");
  };

  // 测试场景13：类型错误测试
  const handleTypeErrors = () => {
    form.setFieldsValue({
      username: 12345 as any, // 应该是字符串，传入数字
      email: true as any, // 应该是字符串，传入布尔值
      age: "not-a-number", // 应该是数字，传入无法转换的字符串
      gender: "invalid-gender" as any, // 不在枚举值中
      contact: "should-be-object" as any, // 应该是对象，传入字符串
      hobbies: [
        // 应该是对象格式，传入数组格式
        { name: "游泳", level: "intermediate" },
        { name: "跑步", level: "beginner" },
      ] as any,
    });
    message.warning("场景13：已设置类型错误的数据，检查类型处理");
  };

  // 测试场景14：深层嵌套缺失
  const handleDeepNestedMissing = () => {
    form.setFieldsValue({
      username: "测试用户",
      // contact 整个对象缺失
      hobbies: {
        hobby1: null as any, // 整个 hobby1 为 null
        hobby2: {
          name: "音乐", // 只有 name，缺少 level
        },
        hobby3: {
          level: "expert", // 只有 level，缺少 name
        },
      },
    });
    message.warning("场景14：深层嵌套结构缺失，检查处理");
  };

  // 测试场景15：混合完整和不完整数据
  const handleMixedCompleteIncomplete = () => {
    form.setFieldsValue({
      username: "王五",
      email: "wangwu@example.com",
      age: 28,
      gender: "male",
      country: "china",
      address: "深圳市南山区科技园", // 完整的基础数据
      contact: {
        phone: "13900139000",
        // wechat 缺失
      },
      hobbies: {
        hobby1: {
          name: "足球",
          level: "advanced", // 完整的 hobby1
        },
        hobby2: {
          name: "乒乓球",
          // level 缺失
        },
        hobby3: {
          // name 缺失
          level: "beginner",
        },
        hobby4: null as any, // null 的 hobby
        hobby5: {
          name: "羽毛球",
          level: "intermediate", // 完整的 hobby5
        },
      },
    });
    message.warning("场景15：混合完整和不完整数据，检查表单状态");
  };

  // 测试场景16：连续更新测试（测试缓存和性能）
  const handleSequentialUpdates = async () => {
    message.info("开始连续更新测试...");

    // 第一次更新
    form.setFieldsValue({ username: "更新1" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 第二次更新
    form.setFieldsValue({ username: "更新2", email: "update2@test.com" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 第三次更新嵌套字段
    form.setFieldsValue({
      contact: { phone: "13800000001" },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 第四次更新数组
    form.setFieldsValue({
      hobbies: {
        hobby1: { name: "更新的爱好", level: "expert" },
      },
    });

    message.success("场景16：连续更新完成");
  };

  // 测试场景17：特殊字符和边界字符串
  const handleSpecialCharacters = () => {
    form.setFieldsValue({
      username: "用户@#$%^&*()_+-=[]{}|;:',.<>?/`~",
      email: "test+special@example.co.uk",
      contact: {
        phone: "13800138000",
        wechat: "微信😀emoji🎉测试",
      },
      hobbies: {
        hobby1: {
          name: "爱好名称包含<script>alert('xss')</script>",
          level: "beginner",
        },
        hobby2: {
          name: "超长文本测试".repeat(50), // 超长文本
          level: "intermediate",
        },
      },
    });
    message.info("场景17：已设置特殊字符和边界字符串");
  };

  // 测试场景18：重复键值覆盖测试
  const handleDuplicateKeyOverride = () => {
    form.setFieldsValue({
      username: "第一次设置",
      email: "first@test.com",
    });

    // 立即再次设置相同的键
    setTimeout(() => {
      form.setFieldsValue({
        username: "第二次设置（应该覆盖）",
        email: "second@test.com",
      });
      message.success("场景18：重复键值覆盖完成，检查最终值");
    }, 50);
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
    console.log(model);

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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <div>
                  <strong>基础测试：</strong>
                  <ul style={{ marginTop: 8 }}>
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
                <div>
                  <strong>边界条件测试：</strong>
                  <ul style={{ marginTop: 8 }}>
                    <li>8. 嵌套对象中的缺失值</li>
                    <li>9. 设置多余字段（schema不存在）</li>
                    <li>10. 空值和 null/undefined 测试</li>
                    <li>11. 空对象和空数组</li>
                    <li>12. 不连续的数组索引</li>
                    <li>13. 类型错误测试</li>
                    <li>14. 深层嵌套缺失</li>
                    <li>15. 混合完整和不完整数据</li>
                    <li>16. 连续更新测试</li>
                    <li>17. 特殊字符和边界字符串</li>
                    <li>18. 重复键值覆盖测试</li>
                  </ul>
                </div>
              </div>
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
          <h3 style={{ marginBottom: 16 }}>基础测试操作</h3>
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

          <h3 style={{ marginTop: 24, marginBottom: 16 }}>边界条件测试</h3>
          <Space wrap>
            <Button onClick={handleMissingNestedValues} type="dashed">
              场景8：缺失值测试
            </Button>
            <Button onClick={handleExtraFields} type="dashed">
              场景9：多余字段
            </Button>
            <Button onClick={handleNullAndEmptyValues} type="dashed">
              场景10：空值/null/undefined
            </Button>
            <Button onClick={handleEmptyObjectAndArray} type="dashed">
              场景11：空对象和数组
            </Button>
            <Button onClick={handleNonSequentialArray} type="dashed">
              场景12：不连续索引
            </Button>
            <Button onClick={handleTypeErrors} type="dashed" danger>
              场景13：类型错误
            </Button>
            <Button onClick={handleDeepNestedMissing} type="dashed">
              场景14：深层缺失
            </Button>
            <Button onClick={handleMixedCompleteIncomplete} type="dashed">
              场景15：混合数据
            </Button>
            <Button onClick={handleSequentialUpdates} type="dashed">
              场景16：连续更新
            </Button>
            <Button onClick={handleSpecialCharacters} type="dashed">
              场景17：特殊字符
            </Button>
            <Button onClick={handleDuplicateKeyOverride} type="dashed">
              场景18：重复覆盖
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
