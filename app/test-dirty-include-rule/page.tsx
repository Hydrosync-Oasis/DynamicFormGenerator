"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Space, message, Alert, Tag, Divider } from "antd";
import { z } from "zod";
import { FormModel, FormSchema } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";

/**
 * 测试页面：表单Dirty状态 + Include策略 + 联动Rule
 *
 * 功能点：
 * 1. 测试字段的dirty状态（是否被用户修改）
 * 2. 测试include策略（always/when-visible/never）
 * 3. 测试联动规则（根据字段值动态控制其他字段的显示/隐藏/验证）
 */
export default function TestDirtyIncludeRulePage() {
  // 状态管理
  const [dirtyStatus, setDirtyStatus] = useState<Record<string, boolean>>({});
  const [includeInfo, setIncludeInfo] = useState<Record<string, string>>({});

  // 定义表单Schema
  const schema: FormSchema = useMemo(
    () => ({
      fields: [
        // 用户类型选择 - 用于触发联动规则
        {
          key: "userType",
          label: "用户类型",
          control: "radio",
          controlProps: {
            options: [
              { label: "个人用户", value: "personal" },
              { label: "企业用户", value: "enterprise" },
              { label: "VIP用户", value: "vip" },
            ],
          },
          defaultValue: "personal",
          validate: z.enum(["personal", "enterprise", "vip"], {
            message: "请选择用户类型",
          }),
          helpTip: "选择不同用户类型会影响后续字段的显示",
        },

        // 基础信息字段组
        {
          key: "basicInfo",
          isArray: false,
          initialVisible: true,
          childrenFields: [
            {
              key: "username",
              label: "用户名",
              control: "input",
              controlProps: {
                placeholder: "请输入用户名",
              },
              defaultValue: "张三",
              validate: z.string().min(2, { message: "用户名至少2个字符" }),
              helpTip: "初始值为'张三'，修改后会变为dirty状态",
            },
            {
              key: "email",
              label: "邮箱",
              control: "input",
              controlProps: {
                placeholder: "请输入邮箱",
              },
              defaultValue: "",
              validate: z
                .string()
                .email({ message: "请输入有效的邮箱地址" })
                .optional(),
              helpTip: "初始为空，输入后会变为dirty",
            },
          ],
        },

        // 个人用户专属字段 - 初始显示
        {
          key: "personalInfo",
          isArray: false,
          initialVisible: true,
          include: true, // 默认包含在提交中
          childrenFields: [
            {
              key: "idCard",
              label: "身份证号",
              control: "input",
              controlProps: {
                placeholder: "请输入身份证号",
              },
              defaultValue: "",
              validate: z
                .string()
                .regex(/^\d{18}$|^\d{17}X$/, "请输入有效的18位身份证号")
                .optional(),
              helpTip: "个人用户显示此字段",
            },
            {
              key: "birthday",
              label: "出生日期",
              control: "input",
              controlProps: {
                type: "date",
              },
              defaultValue: "",
              validate: z.string().optional(),
            },
          ],
        },

        // 企业用户专属字段 - 初始隐藏
        {
          key: "enterpriseInfo",
          isArray: false,
          initialVisible: false,
          include: false, // 初始不包含在提交中
          childrenFields: [
            {
              key: "companyName",
              label: "公司名称",
              control: "input",
              controlProps: {
                placeholder: "请输入公司名称",
              },
              defaultValue: "",
              validate: z.string().min(2, { message: "公司名称至少2个字符" }),
              helpTip: "企业用户显示此字段，默认不包含在提交中",
            },
            {
              key: "businessLicense",
              label: "营业执照号",
              control: "input",
              controlProps: {
                placeholder: "请输入营业执照号",
              },
              defaultValue: "",
              validate: z
                .string()
                .regex(/^[0-9A-Z]{18}$/, "营业执照号为18位数字或大写字母")
                .optional(),
            },
            {
              key: "registeredCapital",
              label: "注册资本（万元）",
              control: "input",
              controlProps: {
                type: "number",
                placeholder: "请输入注册资本",
              },
              defaultValue: "",
              validate: z
                .union([z.number(), z.string()])
                .transform((v) => (typeof v === "string" ? Number(v) : v))
                .pipe(z.number().positive({ message: "注册资本必须为正数" }))
                .optional(),
            },
          ],
        },

        // VIP用户专属字段 - 初始隐藏
        {
          key: "vipInfo",
          isArray: false,
          initialVisible: false,
          include: false,
          childrenFields: [
            {
              key: "vipLevel",
              label: "VIP等级",
              control: "select",
              controlProps: {
                placeholder: "请选择VIP等级",
                options: [
                  { label: "金牌会员", value: "gold" },
                  { label: "钻石会员", value: "diamond" },
                  { label: "至尊会员", value: "supreme" },
                ],
              },
              defaultValue: "gold",
              validate: z.enum(["gold", "diamond", "supreme"], {
                message: "请选择VIP等级",
              }),
            },
            {
              key: "vipExpireDate",
              label: "会员到期日",
              control: "input",
              controlProps: {
                type: "date",
              },
              defaultValue: "",
              validate: z.string().min(1, { message: "请选择会员到期日" }),
            },
          ],
        },

        // 联系方式 - 测试include策略
        {
          key: "contact",
          isArray: false,
          initialVisible: true,
          childrenFields: [
            {
              key: "phone",
              label: "手机号",
              control: "input",
              controlProps: {
                placeholder: "请输入手机号",
              },
              defaultValue: "",
              validate: z
                .string()
                .regex(/^1[3-9]\d{9}$/, "请输入有效的11位手机号")
                .optional(),
              helpTip: "测试include策略的字段",
            },
            {
              key: "address",
              label: "联系地址",
              control: "input",
              controlProps: {
                placeholder: "请输入联系地址",
              },
              defaultValue: "",
              initialVisible: false,
              validate: z.string().optional(),
              helpTip: "初始隐藏，可通过按钮控制显示",
            },
          ],
        },

        // 备注字段 - 测试动态必填
        {
          key: "remarks",
          label: "备注",
          control: "input",
          controlProps: {
            placeholder: "请输入备注",
          },
          defaultValue: "",
          validate: z.string().optional(),
          helpTip: "VIP用户此字段为必填",
        },
      ],
    }),
    [],
  );

  // 创建表单模型
  const model = useRef(new FormModel(schema));
  const form = useDynamicForm(model.current);

  // 注册联动规则
  useEffect(() => {
    // 规则1: 根据用户类型控制不同字段组的显示和隐藏
    const rule1 = model.current.registerRule((ctx, cause) => {
      const userType = ctx.track(["userType"]);

      if (cause === "initial-run" || cause === "value-changed") {
        // 控制个人信息的显示
        if (userType === "personal") {
          ctx.setVisible(["personalInfo"], true);
          ctx.setVisible(["enterpriseInfo"], false);
          ctx.setVisible(["vipInfo"], false);
        }
        // 控制企业信息的显示
        else if (userType === "enterprise") {
          ctx.setVisible(["personalInfo"], false);
          ctx.setVisible(["enterpriseInfo"], true);
          ctx.setVisible(["vipInfo"], false);

          // 企业用户必填公司名称
          ctx.setValidation(
            ["enterpriseInfo", "companyName"],
            z.string().min(2, { message: "公司名称至少2个字符" }),
          );
        }
        // 控制VIP信息的显示
        else if (userType === "vip") {
          ctx.setVisible(["personalInfo"], false);
          ctx.setVisible(["enterpriseInfo"], false);
          ctx.setVisible(["vipInfo"], true);

          // VIP用户备注必填
          ctx.setValidation(
            ["remarks"],
            z.string().min(1, { message: "VIP用户必须填写备注" }),
          );
        }
      }
    });

    // 规则2: VIP等级联动 - 至尊会员自动显示联系地址
    const rule2 = model.current.registerRule((ctx, cause) => {
      const userType = ctx.track(["userType"]);
      const vipLevel = ctx.track(["vipInfo", "vipLevel"]);

      if (userType === "vip" && vipLevel === "supreme") {
        ctx.setVisible(["contact", "address"], true);
        ctx.setValidation(
          ["contact", "address"],
          z.string().min(5, { message: "至尊会员必须填写详细地址" }),
        );
      } else if (userType === "vip") {
        ctx.setVisible(["contact", "address"], false);
        ctx.setValidation(["contact", "address"], z.string().optional());
      }
    });

    // 规则3: 企业用户注册资本联动
    const rule3 = model.current.registerRule((ctx, cause) => {
      const userType = ctx.track(["userType"]);
      const registeredCapital = ctx.track([
        "enterpriseInfo",
        "registeredCapital",
      ]);

      if (userType === "enterprise" && registeredCapital) {
        const capital =
          typeof registeredCapital === "string"
            ? Number(registeredCapital)
            : registeredCapital;

        if (capital >= 1000) {
          // 注册资本大于1000万，显示提示
          ctx.setAlertTip(
            ["enterpriseInfo", "registeredCapital"],
            <Tag color="gold">大型企业</Tag>,
          );
        } else if (capital >= 100) {
          ctx.setAlertTip(
            ["enterpriseInfo", "registeredCapital"],
            <Tag color="blue">中型企业</Tag>,
          );
        } else if (capital > 0) {
          ctx.setAlertTip(
            ["enterpriseInfo", "registeredCapital"],
            <Tag color="green">小型企业</Tag>,
          );
        }
      }
    });

    // 初始化表单
    model.current.initial();
  }, []);

  // 更新dirty状态显示
  const updateDirtyStatus = () => {
    const status: Record<string, boolean> = {};

    // 检查各个字段的dirty状态
    try {
      const paths = [
        ["basicInfo", "username"],
        ["basicInfo", "email"],
        ["personalInfo", "idCard"],
        ["personalInfo", "birthday"],
        ["enterpriseInfo", "companyName"],
        ["enterpriseInfo", "businessLicense"],
        ["enterpriseInfo", "registeredCapital"],
        ["vipInfo", "vipLevel"],
        ["vipInfo", "vipExpireDate"],
        ["contact", "phone"],
        ["contact", "address"],
        ["remarks"],
      ];

      paths.forEach((path) => {
        try {
          const node = model.current.findNodeByPath(path);
          if (node && node.type === "field") {
            status[path.join(".")] = node.cache.selfDirty;
          }
        } catch (e) {
          // 忽略找不到的节点
        }
      });
    } catch (e) {
      console.error("更新dirty状态失败", e);
    }

    setDirtyStatus(status);
    message.info("已刷新Dirty状态");
  };

  // 更新include信息
  const updateIncludeInfo = () => {
    const info: Record<string, string> = {};

    try {
      const paths = [
        ["personalInfo"],
        ["enterpriseInfo"],
        ["vipInfo"],
        ["contact", "phone"],
        ["contact", "address"],
      ];

      paths.forEach((path) => {
        try {
          const node = model.current.findNodeByPath(path);
          if (node) {
            info[path.join(".")] = node.dynamicProp.include
              ? "✓ 包含"
              : "✗ 不包含";
          }
        } catch (e) {
          // 忽略
        }
      });
    } catch (e) {
      console.error("更新include信息失败", e);
    }

    setIncludeInfo(info);
    message.info("已刷新Include状态");
  };

  return (
    <div className="p-6">
      <Card
        title="测试：表单Dirty + Include策略 + 联动Rule"
        extra={
          <Space>
            <Button onClick={() => console.log(model.current)}>
              查看Model
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                try {
                  const data = await form.submit();
                  message.success("提交成功！");
                  console.log("提交的数据:", data);
                } catch (e) {
                  message.error("提交失败，请检查表单");
                  console.error(e);
                }
              }}
            >
              提交表单
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* 说明区域 */}
          <Alert
            type="info"
            message="功能说明"
            description={
              <div>
                <p>
                  <strong>1. 联动规则测试：</strong>
                </p>
                <ul>
                  <li>选择"个人用户"：显示身份证号、生日等个人信息</li>
                  <li>
                    选择"企业用户"：显示公司名称、营业执照等企业信息，注册资本会显示企业规模标签
                  </li>
                  <li>
                    选择"VIP用户"：显示VIP等级、到期日，备注变为必填；至尊会员需填写详细地址
                  </li>
                </ul>
                <p>
                  <strong>2. Dirty状态测试：</strong>
                  点击"查看Dirty状态"按钮查看哪些字段被用户修改过
                </p>
                <p>
                  <strong>3. Include策略测试：</strong>
                  点击"查看Include状态"按钮查看哪些字段会包含在提交数据中
                </p>
              </div>
            }
          />

          {/* 操作按钮区 */}
          <Card title="测试操作" size="small">
            <Space wrap>
              <Button onClick={updateDirtyStatus}>查看Dirty状态</Button>
              <Button onClick={updateIncludeInfo}>查看Include状态</Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["contact", "phone"], true);
                  message.info("已设置手机号 include = true");
                }}
              >
                手机号 → Include(true)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["contact", "phone"], false);
                  message.info("已设置手机号 include = false");
                }}
              >
                手机号 → Include(false)
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["contact", "address"], true, true);
                  message.info("已显示联系地址");
                }}
              >
                显示联系地址
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["contact", "address"], false, true);
                  message.info("已隐藏联系地址");
                }}
              >
                隐藏联系地址
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  message.info("已重置表单");
                }}
                danger
              >
                重置表单
              </Button>
            </Space>
          </Card>

          {/* Dirty状态显示 */}
          {Object.keys(dirtyStatus).length > 0 && (
            <Card title="Dirty状态" size="small">
              <Space wrap>
                {Object.entries(dirtyStatus).map(([path, isDirty]) => (
                  <Tag key={path} color={isDirty ? "red" : "green"}>
                    {path}: {isDirty ? "已修改 ✓" : "未修改"}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {/* Include状态显示 */}
          {Object.keys(includeInfo).length > 0 && (
            <Card title="Include状态" size="small">
              <Space wrap>
                {Object.entries(includeInfo).map(([path, status]) => (
                  <Tag
                    key={path}
                    color={status.includes("✓") ? "blue" : "default"}
                  >
                    {path}: {status}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {/* 表单渲染区域 */}
          <Card title="表单区域" size="small">
            <Generator
              model={model.current}
              displayFields={[[]]}
              displayOption={{
                showDebug: true,
              }}
            />
          </Card>
        </Space>
      </Card>
    </div>
  );
}
