"use client";
import { useMemo, useState } from "react";
import { Button, Card, Pagination, Space, Typography, message } from "antd";
import { z } from "zod";

import { Generator, useDynamicForm } from "@/utils/generator";
import {
  EffectInvokeReason,
  FieldPath,
  FieldSchema,
  FormModel,
  ReactiveEffect,
  ReactiveEffectContext,
} from "@/utils/structures";

const { Title, Paragraph, Text } = Typography;

type ExperienceSpec = {
  key: string;
  label: string;
};

const sanitizeKey = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "");

const parseExperienceInput = (
  raw: string | undefined | null
): ExperienceSpec[] => {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: ExperienceSpec[] = [];
  const fragments = raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  fragments.forEach((label, index) => {
    const base = sanitizeKey(label);
    let key = base.length > 0 ? base : `experience-${index + 1}`;
    let dedupe = 1;
    while (seen.has(key)) {
      key = `${base || `experience-${index + 1}`}-${dedupe++}`;
    }
    seen.add(key);
    result.push({ key, label });
  });

  return result;
};

const experienceChildrenSchema = (items: ExperienceSpec[]): FieldSchema[] => {
  return items.map(({ key, label }) => ({
    key,
    label: `工作经历：${label}`,
    childrenFields: [
      {
        key: "company",
        label: "公司名称",
        control: "input",
        defaultValue: label,
        itemProps: { placeholder: "公司名称", disabled: true },
      },
      {
        key: "position",
        label: "职位名称",
        control: "input",
        validate: z.string().min(1, "请填写职位名称"),
        itemProps: { placeholder: "如：前端工程师" },
      },
      {
        key: "startDate",
        label: "开始日期",
        control: "input",
        validate: z
          .string()
          .min(1, "请填写开始日期")
          .regex(/^[0-9]{4}-[0-9]{2}$/g, "格式为 YYYY-MM"),
        itemProps: { placeholder: "例如：2021-06" },
      },
      {
        key: "currentlyWorking",
        label: "是否在职",
        control: "radio",
        options: [
          { label: "否", value: "no" },
          { label: "是", value: "yes" },
        ],
        defaultValue: "no",
      },
      {
        key: "endDate",
        label: "结束日期",
        control: "input",
        validate: z.string().optional(),
        itemProps: { placeholder: "如：2023-08；在职可不填" },
      },
      {
        key: "description",
        label: "工作内容",
        control: "input",
        validate: z.string().optional(),
        itemProps: { placeholder: "可选，简单描述主要工作与成绩" },
      },
    ],
  }));
};

const applicantSchema = {
  fields: [
    {
      key: "fullName",
      label: "姓名",
      control: "input",
      validate: z.string().min(1, "请填写姓名"),
      itemProps: { placeholder: "如：张三" },
    },
    {
      key: "gender",
      label: "性别",
      control: "radio",
      options: [
        { label: "男", value: "male" },
        { label: "女", value: "female" },
        { label: "不透露", value: "na" },
      ],
      defaultValue: "na",
    },
    {
      key: "email",
      label: "邮箱",
      control: "input",
      validate: z.string().min(1, "请填写邮箱").email("请输入有效的邮箱地址"),
      itemProps: { placeholder: "如：name@example.com" },
    },
    {
      key: "phone",
      label: "手机号",
      control: "input",
      validate: z
        .string()
        .min(1, "请填写手机号")
        .regex(/^[0-9\-+]{5,20}$/, "请填写正确的手机号"),
      itemProps: { placeholder: "支持 +、-、数字" },
    },
    {
      key: "highestEducation",
      label: "最高学历",
      control: "select",
      options: [
        { label: "专科", value: "college" },
        { label: "本科", value: "bachelor" },
        { label: "硕士", value: "master" },
        { label: "博士", value: "phd" },
      ],
      defaultValue: "bachelor",
    },
    {
      key: "thesisTitle",
      label: "论文/课题名",
      control: "input",
      validate: z.string().optional(),
      initialVisible: false,
      itemProps: { placeholder: "硕士/博士可填写" },
    },
    {
      key: "status",
      label: "当前状态",
      control: "radio",
      options: [
        { label: "在职-考虑机会", value: "employed" },
        { label: "已离职-可随时到岗", value: "unemployed" },
        { label: "在读/应届", value: "student" },
      ],
      defaultValue: "employed",
    },
    {
      key: "currentCompany",
      label: "当前公司",
      control: "input",
      validate: z.string().optional(),
      initialVisible: false,
      itemProps: { placeholder: "仅在职需要填写" },
    },
    {
      key: "currentPosition",
      label: "当前职位",
      control: "input",
      validate: z.string().optional(),
      initialVisible: false,
      itemProps: { placeholder: "仅在职需要填写" },
    },
    {
      key: "experienceNames",
      label: "工作经历列表",
      control: "input",
      validate: z
        .string()
        .min(1, "请至少录入一段经历")
        .superRefine((value, ctx) => {
          const list = parseExperienceInput(value);
          if (list.length === 0) {
            ctx.addIssue({ code: "custom", message: "请至少录入一段经历" });
          }
        }),
      helpTip: <Text type="secondary">使用逗号或换行分隔公司或经历简称</Text>,
      itemProps: { placeholder: "示例：A 公司, B 公司, 自主创业" },
    },
    {
      key: "workExperiences",
      label: "经历详情",
      isArray: true,
      childrenFields: [],
    },
    {
      key: "expectedSalary",
      label: "期望薪资(税前/月)",
      control: "input",
      validate: z
        .string()
        .min(1, "请填写期望薪资")
        .regex(/^[0-9]{2,6}$/g, "请输入数字，单位：元/月"),
      itemProps: { placeholder: "例如：20000" },
    },
    {
      key: "availability",
      label: "可到岗时间",
      control: "select",
      options: [
        { label: "一周内", value: "1w" },
        { label: "两周内", value: "2w" },
        { label: "一个月内", value: "1m" },
        { label: "待定", value: "tbd" },
      ],
      defaultValue: "2w",
    },
    {
      key: "summary",
      label: "信息摘要",
      control: "input",
      validate: z.string().optional(),
      itemProps: { disabled: true },
    },
  ],
} satisfies { fields: FieldSchema[] };

const applicantModel = new FormModel(applicantSchema);

// ---------------- 注册所有规则：移出组件与 useEffect ----------------
// 规则：硕士/博士 -> 需要课题名
{
  const effect: ReactiveEffect = (
    ctx: ReactiveEffectContext,
    cause: EffectInvokeReason,
    info?: { changedPath?: FieldPath }
  ) => {
    let edu = "";
    edu = ctx.get(["highestEducation"]);

    const visible = edu === "master" || edu === "phd";
    ctx.setVisible(["thesisTitle"], visible);
    const validator = visible
      ? z.string().min(1, "请填写论文/课题名")
      : z.string().optional();
    ctx.setValidation(["thesisTitle"], validator as any);
  };
  applicantModel.registerRule(effect);
}

// 规则：在职才显示当前公司/职位
{
  const effect: ReactiveEffect = (
    ctx: ReactiveEffectContext,
    cause: EffectInvokeReason,
    info?: { changedPath?: FieldPath }
  ) => {
    let status = "";
    status = ctx.get(["status"]);

    const employed = status === "employed";
    ctx.setVisible(["currentCompany"], employed);
    ctx.setVisible(["currentPosition"], employed);
    const rule = employed
      ? z.string().min(1, "在职需填写")
      : z.string().optional();
    ctx.setValidation(["currentCompany"], rule as any);
    ctx.setValidation(["currentPosition"], rule as any);
    if (
      cause === "value-changed" &&
      info?.changedPath?.join(".") === "status"
    ) {
      // applicantModel.validateField(["currentCompany"]).catch(() => {});
      // applicantModel.validateField(["currentPosition"]).catch(() => {});
    }
  };
  applicantModel.registerRule(effect);
}

// 规则：输入经历列表 -> 动态生成经历子表单（保留已填值）
{
  const effect: ReactiveEffect = (ctx: ReactiveEffectContext) => {
    let raw = "";
    raw = ctx.get(["experienceNames"]) ?? "";

    const items = parseExperienceInput(raw);
    ctx.updateChildren(["workExperiences"], experienceChildrenSchema(items), {
      keepPreviousData: true,
    });
  };
  applicantModel.registerRule(effect);
}

// 规则：每段经历：在职 -> endDate 可选且隐藏/禁用，离职 -> 必填且显示
{
  const effect: ReactiveEffect = (
    ctx: ReactiveEffectContext,
    cause: EffectInvokeReason,
    info?: { changedPath?: FieldPath }
  ) => {
    ctx.get(["workExperiences"]);

    let raw = "";
    raw = ctx.get(["experienceNames"]) ?? "";
    const items = parseExperienceInput(raw);

    items.forEach(({ key }) => {
      const base: FieldPath = ["workExperiences", key];
      let cur: string | undefined;
      cur = ctx.get([...base, "currentlyWorking"]);

      const shouldShowEnd = cur !== "yes";
      ctx.setVisible([...base, "endDate"], shouldShowEnd);
      const validator = shouldShowEnd
        ? z
            .string()
            .min(1, "请填写结束日期")
            .regex(/^[0-9]{4}-[0-9]{2}$/g, "格式为 YYYY-MM")
        : z.string().optional();
      ctx.setValidation([...base, "endDate"], validator as any);
      const changed = info?.changedPath;
      if (
        cause === "value-changed" &&
        changed &&
        changed.length === [...base, "currentlyWorking"].length &&
        changed.every((v, i) => v === [...base, "currentlyWorking"][i])
      ) {
        applicantModel.validateField([...base, "endDate"]).catch(() => {});
      }
    });
  };
  applicantModel.registerRule(effect);
}

// 规则：自动摘要
{
  const effect: ReactiveEffect = (
    ctx: ReactiveEffectContext,
    _cause: EffectInvokeReason
  ) => {
    let fullName = "";
    let status = "";
    let raw = "";
    fullName = ctx.get(["fullName"]) ?? "";
    status = ctx.get(["status"]) ?? "";
    raw = ctx.get(["experienceNames"]) ?? "";

    const experiences = parseExperienceInput(raw);
    const pieces = [
      fullName ? `候选人：${fullName}` : "",
      status ? `状态：${status}` : "",
      experiences.length > 0 ? `经历数：${experiences.length}` : "",
    ].filter(Boolean);
    const summary = pieces.join(" / ");
    const current = ((): string => {
      try {
        return applicantModel.get(["summary"], "value") ?? "";
      } catch {
        return "";
      }
    })();

    if (summary !== current) {
      ctx.setValue(["summary"], summary, { invokeOnChange: false });
    }
  };
  applicantModel.registerRule(effect);
}

// 初始执行一次所有规则
applicantModel.runAllRules();

export default function AppPage() {
  const form = useDynamicForm(applicantModel);
  const [pageIndex, setPageIndex] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewData, setPreviewData] = useState<Record<
    string,
    unknown
  > | null>(null);

  // 一键填充示例数据：演示 setFieldsValue 的批量赋值能力
  const handleFillDemo = () => {
    const demoExperienceNames = "A 公司, B 公司, 自主创业";

    // 先填充基础字段与经历名称（触发动态子表单生成）
    form.setFieldsValue({
      fullName: "李雷",
      gender: "male",
      email: "lilei@example.com",
      phone: "13800138000",
      highestEducation: "master",
      thesisTitle: "智能推荐系统研究",
      status: "employed",
      currentCompany: "星辰科技",
      currentPosition: "前端工程师",
      experienceNames: demoExperienceNames,
      expectedSalary: "25000",
      availability: "2w",
    });

    // 运行规则以基于 experienceNames 生成 workExperiences 子项
    applicantModel.runAllRules();

    // 依据相同的解析逻辑拿到每段经历的 key，便于给子表单赋值
    const specs = parseExperienceInput(demoExperienceNames);
    const experienceValues: Record<string, any> = {};
    specs.forEach((s, idx) => {
      if (idx === 0) {
        experienceValues[s.key] = {
          position: "前端工程师",
          startDate: "2021-06",
          currentlyWorking: "no",
          endDate: "2023-08",
          description: "负责公司官网与管理后台的前端开发",
        };
      } else if (idx === 1) {
        experienceValues[s.key] = {
          position: "高级前端工程师",
          startDate: "2023-09",
          currentlyWorking: "yes",
          description: "主导组件库与表单引擎开发",
        };
      } else {
        experienceValues[s.key] = {
          position: "全栈开发",
          startDate: "2020-01",
          currentlyWorking: "no",
          endDate: "2021-05",
          description: "个人项目与技术接单",
        };
      }
    });

    // 给动态生成的子表单批量赋值
    form.setFieldsValue({
      workExperiences: experienceValues,
    });

    // 再跑一遍规则，让依赖项（如摘要/显示隐藏/动态校验）即时生效
    applicantModel.runAllRules();

    // messageApi.success("已填充示例数据（用于测试）");
  };

  useMemo(() => {
    handleFillDemo();
  }, []);

  const pageFieldPaths = useMemo<FieldPath[][]>(
    () => [
      [
        ["fullName"],
        ["gender"],
        ["email"],
        ["phone"],
        ["highestEducation"],
        ["thesisTitle"],
        ["status"],
        ["currentCompany"],
        ["currentPosition"],
      ],
      [["experienceNames"], ["workExperiences"]],
      [["expectedSalary"], ["availability"], ["summary"]],
    ],
    []
  );

  const handleSubmit = async () => {
    try {
      const data = await form.submit();
      setPreviewData(data);
      messageApi.success("表单提交成功，已在下方展示最新数据");
    } catch (error) {
      messageApi.error("请检查各分页下的校验提示后再试");
    }
  };

  const handleSwitchPage = (page: number) => {
    setPageIndex(page);
    const paths = pageFieldPaths[page - 1] ?? [];
    if (paths.length > 0) {
      form.validateFields(paths).catch(() => {});
    }
  };

  const flattenFields = pageFieldPaths[pageIndex - 1] ?? [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      {contextHolder}
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            求职者信息分页表单
          </Title>
          <Paragraph style={{ marginBottom: 0 }}>
            本示例展示：动态字段（使用 updateChildren
            生成工作经历）、条件显示与动态校验，以及分页切换校验。
          </Paragraph>
        </div>

        <Card>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Generator
              model={applicantModel}
              displayFields={flattenFields as any}
              displayOption={{ labelSpan: 6, fieldSpan: 18 }}
            />
            <Space
              align="center"
              style={{ justifyContent: "space-between", width: "100%" }}
            >
              <Pagination
                current={pageIndex}
                pageSize={1}
                total={pageFieldPaths.length}
                showSizeChanger={false}
                onChange={handleSwitchPage}
              />
              <Space>
                <Button
                  onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
                  disabled={pageIndex === 1}
                >
                  上一页
                </Button>
                <Button
                  onClick={() =>
                    setPageIndex((prev) =>
                      Math.min(pageFieldPaths.length, prev + 1)
                    )
                  }
                  disabled={pageIndex === pageFieldPaths.length}
                >
                  下一页
                </Button>
                <Button onClick={handleFillDemo}>填充示例数据</Button>
                <Button type="primary" onClick={handleSubmit}>
                  提交表单
                </Button>
              </Space>
            </Space>
          </Space>
        </Card>

        {previewData && (
          <Card title="提交结果预览">
            <pre style={{ margin: 0 }}>
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </Card>
        )}
      </Space>
    </div>
  );
}
