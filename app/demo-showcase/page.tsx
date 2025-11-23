"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Divider,
  InputNumber,
  message,
  Segmented,
  Slider,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
} from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldPath, FieldSchema } from "../../utils/structures";

import type { ImmutableFormState } from "../../utils/type";

const sectionLabels: Record<string, string> = {
  basicInfo: "基础信息",
  planning: "方案与团队",
  deployment: "部署计划",
  compliance: "合规要求",
  approvals: "审批与上线",
};

type LayoutProps = {
  render: (state: ImmutableFormState) => React.ReactNode;
  state: ImmutableFormState;
};

const SectionCardLayout = React.memo(({ render, state }: LayoutProps) => {
  if (state.type === "field") {
    return <></>;
  }
  return (
    <Card
      key={state.key}
      title={sectionLabels[state.key] ?? state.key}
      bordered
      style={{ marginBottom: 24 }}
      bodyStyle={{ padding: 24 }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {state.children.map((child) => (
          <div
            key={child.key}
            className={child.type === "nested" ? "md:col-span-2" : ""}
          >
            {render(child)}
          </div>
        ))}
      </div>
    </Card>
  );
});
SectionCardLayout.displayName = "SectionCardLayout";

const HighlightLayout = React.memo(({ render, state }: LayoutProps) => {
  if (state.type === "field") {
    return <></>;
  }
  return (
    <Card
      key={state.key}
      bordered={false}
      style={{
        background: "linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)",
        marginBottom: 24,
      }}
      bodyStyle={{ padding: 24 }}
    >
      <Typography.Title
        level={5}
        style={{ marginTop: 0, marginBottom: 16, color: "#0958d9" }}
      >
        {sectionLabels[state.key] ?? state.key}
      </Typography.Title>
      <div className="grid gap-6 md:grid-cols-2">
        {state.children.map((child) => (
          <div key={child.key}>{render(child)}</div>
        ))}
      </div>
    </Card>
  );
});
HighlightLayout.displayName = "HighlightLayout";

const ChecklistLayout = React.memo(({ render, state }: LayoutProps) => {
  if (state.type === "field") {
    return <></>;
  }
  return (
    <Card
      key={state.key}
      size="small"
      title={sectionLabels[state.key] ?? state.key}
      style={{ marginBottom: 24 }}
    >
      <div className="flex flex-col gap-4">
        {state.children.map((child) => (
          <div key={child.key}>{render(child)}</div>
        ))}
      </div>
    </Card>
  );
});
ChecklistLayout.displayName = "ChecklistLayout";

const BudgetSlider: React.FC<{
  value?: number;
  onChange?: (value: number) => void;
}> = ({ value = 150000, onChange }) => {
  const numeric = typeof value === "number" ? value : Number(value) || 0;
  return (
    <div className="flex w-full items-center gap-4">
      <Slider
        style={{ flex: 1 }}
        min={20000}
        max={500000}
        step={5000}
        tooltip={{ formatter: (val) => `￥${val?.toLocaleString()}` }}
        value={numeric}
        onChange={(val) => onChange?.(Number(val))}
      />
      <InputNumber
        style={{ width: 150 }}
        value={numeric}
        min={10000}
        max={1000000}
        formatter={(val) =>
          val ? `￥ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "￥ 0"
        }
        parser={(val) => Number((val ?? "0").replace(/[￥,\s]/g, ""))}
        onChange={(next) => onChange?.(Number(next ?? 0))}
      />
    </div>
  );
};

const RiskLevelSelector: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
}> = ({ value = "medium", onChange }) => (
  <Segmented
    block
    value={value}
    onChange={(val) => onChange?.(val as string)}
    options={[
      {
        label: <Tag color="green">低风险</Tag>,
        value: "low",
      },
      {
        label: <Tag color="gold">中风险</Tag>,
        value: "medium",
      },
      {
        label: <Tag color="red">高风险</Tag>,
        value: "high",
      },
    ]}
  />
);

const BooleanSwitch: React.FC<{
  value?: boolean;
  onChange?: (value: boolean) => void;
}> = ({ value = false, onChange }) => (
  <Switch
    checked={!!value}
    checkedChildren="开启"
    unCheckedChildren="关闭"
    onChange={(checked) => onChange?.(checked)}
  />
);

export default function DemoShowcasePage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "basicInfo",
          isArray: false,
          LayoutComponent: SectionCardLayout,
          childrenFields: [
            {
              key: "projectName",
              label: "项目名称",
              control: "input",
              validate: z.string().min(2, { message: "请输入项目名称" }),
              helpTip: "将显示在报表与审批邮件中",
            },
            {
              key: "projectType",
              label: "项目类型",
              control: "radio",
              controlProps: {
                options: [
                  { label: "内部试点", value: "internal" },
                  { label: "客户项目", value: "client" },
                  { label: "创新实验", value: "innovation" },
                ],
              },
              defaultValue: "internal",
              validate: z.enum(["internal", "client", "innovation"], {
                message: "请选择项目类型",
              }),
            },
            {
              key: "projectOwnerEmail",
              label: "负责人邮箱",
              control: "input",
              controlProps: { type: "email" },
              validate: z.string().email({ message: "请输入有效的邮箱地址" }),
            },
            {
              key: "projectRegion",
              label: "投放区域",
              control: "select",
              controlProps: {
                options: [
                  { label: "中国", value: "cn" },
                  { label: "亚太", value: "apac" },
                  { label: "欧洲", value: "eu" },
                  { label: "北美", value: "na" },
                ],
                placeholder: "请选择主要区域",
              },
              validate: z.enum(["cn", "apac", "eu", "na"], {
                message: "请选择投放区域",
              }),
            },
            {
              key: "summary",
              label: "项目概述",
              control: "input",
              controlProps: {
                placeholder: "一句话介绍项目目标",
              },
              validate: z.string().min(6, { message: "请输入至少6个字符" }),
            },
          ],
        },
        {
          key: "planning",
          isArray: false,
          LayoutComponent: SectionCardLayout,
          childrenFields: [
            {
              key: "planType",
              label: "发布方案",
              control: "radio",
              controlProps: {
                options: [
                  { label: "标准", value: "standard" },
                  { label: "敏捷", value: "agile" },
                  { label: "企业版", value: "enterprise" },
                ],
              },
              defaultValue: "standard",
              validate: z.enum(["standard", "agile", "enterprise"], {
                message: "请选择发布方案",
              }),
            },
            {
              key: "teamSize",
              label: "团队规模",
              control: "input",
              controlProps: { type: "number", min: 1 },
              defaultValue: 6,
              validate: z.coerce
                .number()
                .min(2, { message: "至少需要2人团队" }),
            },
            {
              key: "estimatedBudget",
              label: "预算 (￥)",
              control: BudgetSlider,
              defaultValue: 150000,
              validate: z.coerce
                .number()
                .min(20000, { message: "预算需 ≥ 2万" })
                .max(500000, { message: "预算需 ≤ 50万" }),
            },
            {
              key: "needCustomIntegration",
              label: "集成方式",
              control: "radio",
              controlProps: {
                options: [
                  { label: "标准API", value: "standard" },
                  { label: "无集成", value: "none" },
                  { label: "定制集成", value: "custom" },
                ],
              },
              defaultValue: "standard",
              validate: z.enum(["standard", "none", "custom"], {
                message: "请选择集成方式",
              }),
            },
            {
              key: "integrationNotes",
              label: "集成说明",
              control: "input",
              controlProps: {
                placeholder: "说明接口协议、联系人等",
              },
              initialVisible: false,
              validate: z.string().optional(),
            },
          ],
        },
        {
          key: "deployment",
          isArray: false,
          LayoutComponent: HighlightLayout,
          childrenFields: [
            {
              key: "startDate",
              label: "准备开始",
              control: "input",
              controlProps: { type: "date" },
              validate: z.string().min(1, { message: "请选择开始日期" }),
            },
            {
              key: "endDate",
              label: "上线日期",
              control: "input",
              controlProps: { type: "date" },
              validate: z.string().min(1, { message: "请选择上线日期" }),
            },
            {
              key: "deploymentEnv",
              label: "部署环境",
              control: "select",
              controlProps: {
                options: [
                  { label: "生产集群", value: "prod" },
                  { label: "灰度集群", value: "staging" },
                  { label: "混合", value: "hybrid" },
                ],
              },
              validate: z.enum(["prod", "staging", "hybrid"], {
                message: "请选择部署环境",
              }),
            },
            {
              key: "minCapacity",
              label: "最小实例",
              control: "input",
              controlProps: { type: "number", min: 1 },
              defaultValue: 2,
              validate: z.coerce.number().min(1, { message: "至少1个实例" }),
            },
            {
              key: "enableAutoScaling",
              label: "自动扩缩",
              control: BooleanSwitch,
              defaultValue: false,
              validate: z.boolean().optional(),
            },
            {
              key: "autoScalingMax",
              label: "实例上限",
              control: "input",
              controlProps: { type: "number", min: 1 },
              initialVisible: false,
              validate: z.coerce.number().optional(),
            },
            {
              key: "riskLevel",
              label: "风险等级",
              control: RiskLevelSelector,
              defaultValue: "medium",
              validate: z.enum(["low", "medium", "high"], {
                message: "请选择风险等级",
              }),
            },
          ],
        },
        {
          key: "compliance",
          isArray: false,
          LayoutComponent: SectionCardLayout,
          childrenFields: [
            {
              key: "billingCountry",
              label: "开票国家",
              control: "select",
              controlProps: {
                options: [
                  { label: "中国", value: "cn" },
                  { label: "德国", value: "de" },
                  { label: "法国", value: "fr" },
                  { label: "英国", value: "uk" },
                  { label: "美国", value: "us" },
                ],
              },
              defaultValue: "cn",
              validate: z.enum(["cn", "de", "fr", "uk", "us"], {
                message: "请选择国家",
              }),
            },
            {
              key: "vatNumber",
              label: "VAT编号",
              control: "input",
              controlProps: { placeholder: "仅欧盟地区需要" },
              initialVisible: false,
              validate: z.string().optional(),
            },
            {
              key: "dataResidency",
              label: "数据驻留",
              control: "select",
              controlProps: {
                options: [
                  { label: "本地集群", value: "local" },
                  { label: "跨区双活", value: "multi" },
                  { label: "云上", value: "cloud" },
                ],
              },
              validate: z.enum(["local", "multi", "cloud"], {
                message: "请选择数据驻留策略",
              }),
            },
            {
              key: "securityReviewer",
              label: "安全审核人",
              control: "input",
              validate: z.string().min(2, { message: "请输入审核人" }),
            },
          ],
        },
        {
          key: "approvals",
          isArray: false,
          LayoutComponent: ChecklistLayout,
          childrenFields: [
            {
              key: "needsLegalReview",
              label: "是否法务评审",
              control: "radio",
              controlProps: {
                options: [
                  { label: "是", value: "yes" },
                  { label: "否", value: "no" },
                ],
              },
              defaultValue: "no",
              validate: z.enum(["yes", "no"], {
                message: "请选择是否需要法务",
              }),
            },
            {
              key: "legalContact",
              label: "法务联系人邮箱",
              control: "input",
              controlProps: { type: "email" },
              initialVisible: false,
              validate: z.string().optional(),
            },
            {
              key: "launchChecklist",
              label: "上线准备度",
              control: "radio",
              controlProps: {
                options: [
                  { label: "未开始", value: "todo" },
                  { label: "进行中", value: "doing" },
                  { label: "已完成", value: "done" },
                ],
              },
              defaultValue: "todo",
              validate: z.enum(["todo", "doing", "done"], {
                message: "请选择上线准备度",
              }),
            },
            {
              key: "riskMitigationNote",
              label: "高风险缓解计划",
              control: "input",
              controlProps: {
                placeholder: "仅高风险需要填写",
              },
              initialVisible: false,
              validate: z.string().optional(),
            },
          ],
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  const steps = useMemo(
    () => [
      {
        title: "基础信息",
        description: "项目元数据",
        fieldPaths: [["basicInfo"] as FieldPath],
      },
      {
        title: "方案配置",
        description: "团队与预算",
        fieldPaths: [["planning"] as FieldPath],
      },
      {
        title: "部署计划",
        description: "时间与风险",
        fieldPaths: [["deployment"] as FieldPath],
      },
      {
        title: "合规与审批",
        description: "收尾",
        fieldPaths: [["compliance"] as FieldPath, ["approvals"] as FieldPath],
      },
    ],
    []
  );

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const disposers: Array<() => void> = [];

    disposers.push(
      model.registerRule((ctx) => {
        const planType = ctx.track(["planning", "planType"]);
        const validator =
          planType === "enterprise"
            ? z.coerce.number().min(10, { message: "企业方案至少 10 人" })
            : z.coerce.number().min(2, { message: "团队至少 2 人" }).optional();
        ctx.setValidation(["planning", "teamSize"], validator);
      })
    );

    disposers.push(
      model.registerRule((ctx) => {
        const mode = ctx.track(["planning", "needCustomIntegration"]);
        const needDetail = mode === "custom";
        ctx.setVisible(["planning", "integrationNotes"], needDetail);
        ctx.setValidation(
          ["planning", "integrationNotes"],
          needDetail
            ? z.string().min(10, { message: "请描述定制集成需求" })
            : z.string().optional()
        );
      })
    );

    disposers.push(
      model.registerRule((ctx) => {
        const enabled = ctx.track(["deployment", "enableAutoScaling"]);
        const min = Number(ctx.track(["deployment", "minCapacity"])) || 1;
        ctx.setVisible(["deployment", "autoScalingMax"], !!enabled);
        ctx.setValidation(
          ["deployment", "autoScalingMax"],
          enabled
            ? z.coerce.number().min(min + 1, { message: "上限需大于最小实例" })
            : z.coerce.number().optional()
        );
      })
    );

    disposers.push(
      model.registerRule((ctx) => {
        const country = ctx.track(["compliance", "billingCountry"]);
        const requireVat = ["de", "fr", "uk"].includes(country);
        ctx.setVisible(["compliance", "vatNumber"], requireVat);
        ctx.setValidation(
          ["compliance", "vatNumber"],
          requireVat
            ? z.string().min(5, { message: "请输入合法 VAT 编号" })
            : z.string().optional()
        );
      })
    );

    disposers.push(
      model.registerRule((ctx) => {
        const needsLegal = ctx.track(["approvals", "needsLegalReview"]);
        const visible = needsLegal === "yes";
        ctx.setVisible(["approvals", "legalContact"], visible);
        ctx.setValidation(
          ["approvals", "legalContact"],
          visible
            ? z.string().email({ message: "请输入法务联系人邮箱" })
            : z.string().optional()
        );
      })
    );

    disposers.push(
      model.registerRule((ctx) => {
        const risk = ctx.track(["deployment", "riskLevel"]);
        const showNote = risk === "high";
        ctx.setVisible(["approvals", "riskMitigationNote"], showNote);
        ctx.setValidation(
          ["approvals", "riskMitigationNote"],
          showNote
            ? z.string().min(10, { message: "请填写风险缓解计划" })
            : z.string().optional()
        );
      })
    );

    model.setRefiner([], (base) =>
      base.superRefine((values, refinementCtx) => {
        const data = values as Record<string, any>;
        const start = data?.deployment?.startDate;
        const end = data?.deployment?.endDate;
        if (start && end) {
          const startTime = new Date(start).getTime();
          const endTime = new Date(end).getTime();
          if (!Number.isNaN(startTime) && !Number.isNaN(endTime)) {
            if (endTime <= startTime) {
              refinementCtx.addIssue({
                code: "custom",
                path: ["deployment", "endDate"],
                message: "上线日期必须晚于准备开始",
              });
            }
          }
        }

        const budget = data?.planning?.estimatedBudget;
        if (
          data?.planning?.planType === "enterprise" &&
          typeof budget === "number" &&
          budget < 200000
        ) {
          refinementCtx.addIssue({
            code: "custom",
            path: ["planning", "estimatedBudget"],
            message: "企业方案预算建议≥20万",
          });
        }
      })
    );

    model.initial();

    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }, [model]);

  const currentStepConfig = steps[currentStep];

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = async () => {
    try {
      debugger;
      await form.validateFields(currentStepConfig.fieldPaths);
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      message.success("当前分页校验通过");
    } catch (err) {
      message.error("请先修复当前分页的校验错误");
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = await form.submit();
      message.success("全部校验通过，数据已打印到控制台");
      // eslint-disable-next-line no-console
      console.log("demo-showcase submit", payload);
    } catch (err) {
      message.error("提交失败，请检查校验信息");
    }
  };

  const handlePreviewAll = () => {
    // eslint-disable-next-line no-console
    console.log("current form snapshot", model.getJSONData());
    message.info("当前数据已输出到控制台");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          表单生成器综合示例
        </Typography.Title>
        <Typography.Paragraph>
          此路由涵盖自定义布局、自定义控件、分页表单、联动显示、动态校验与跨字段校验，
          方便一次性验证表单运行时能力。
        </Typography.Paragraph>
        <Space wrap>
          <Tag color="blue">自定义布局</Tag>
          <Tag color="gold">自定义组件</Tag>
          <Tag color="purple">分页流程</Tag>
          <Tag color="green">联动校验</Tag>
          <Tag color="red">动态可见性</Tag>
        </Space>
      </Card>

      <Card>
        <Steps
          responsive
          size="small"
          current={currentStep}
          items={steps.map((step) => ({
            title: step.title,
            description: step.description,
          }))}
        />
        <Divider />
        <Generator
          model={model}
          displayFields={currentStepConfig.fieldPaths}
          displayOption={{ showDebug: false }}
        />
        <Divider />
        <Space>
          {currentStep > 0 && <Button onClick={handlePrev}>上一步</Button>}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={handleNext}>
              下一步并校验
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button type="primary" onClick={handleSubmit}>
              提交全表单
            </Button>
          )}
          <Button onClick={handlePreviewAll}>打印当前数据</Button>
        </Space>
      </Card>
    </div>
  );
}
