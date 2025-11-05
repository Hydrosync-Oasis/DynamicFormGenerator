"use client";

import { useEffect, useMemo, useState } from "react";
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

type ModuleSpec = {
  key: string;
  label: string;
};

const sanitizeKey = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "");

const parseModuleInput = (raw: string | undefined | null): ModuleSpec[] => {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: ModuleSpec[] = [];
  const fragments = raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  fragments.forEach((label, index) => {
    const base = sanitizeKey(label);
    let key = base.length > 0 ? base : `module-${index + 1}`;
    let dedupe = 1;
    while (seen.has(key)) {
      key = `${base || `module-${index + 1}`}-${dedupe++}`;
    }
    seen.add(key);
    result.push({ key, label });
  });

  return result;
};

const moduleChildrenSchema = (modules: ModuleSpec[]): FieldSchema[] => {
  return modules.map(({ key, label }) => ({
    key,
    label: `模块：${label}`,
    childrenFields: [
      {
        key: "moduleName",
        label: "模块标识",
        control: "input",
        defaultValue: label,
        itemProps: { disabled: true },
      },
      {
        key: "replicas",
        label: "实例数",
        control: "input",
        defaultValue: "1",
        validate: z
          .string()
          .min(1, "请填写实例数")
          .regex(/^[0-9]+$/, "实例数仅支持数字"),
        itemProps: { placeholder: "例如：2" },
      },
      {
        key: "exposure",
        label: "对外暴露",
        control: "radio",
        options: [
          { label: "不暴露", value: "none" },
          { label: "平台网关", value: "gateway" },
          { label: "自定义端口", value: "custom" },
        ],
        defaultValue: "none",
      },
      {
        key: "exposurePort",
        label: "暴露端口",
        control: "input",
        initialVisible: false,
        validate: z.string().optional(),
        itemProps: { placeholder: "选择自定义端口时填写，如：8080" },
      },
      {
        key: "notes",
        label: "模块备注",
        control: "input",
        validate: z.string().optional(),
        itemProps: { placeholder: "可选，记录模块说明" },
      },
    ],
  }));
};

const paginatedSchema = {
  fields: [
    {
      key: "projectName",
      label: "项目名称",
      control: "input",
      validate: z.string().min(1, "请填写项目名称"),
      controlProps: { placeholder: "例如：动态表单生成平台" },
    },
    {
      key: "ownerEmail",
      label: "负责人邮箱",
      control: "input",
      validate: z
        .string()
        .min(1, "请填写负责人邮箱")
        .email("请输入有效的邮箱地址"),
      controlProps: { placeholder: "如：owner@example.com" },
    },
    {
      key: "environment",
      label: "部署环境",
      control: "select",
      options: [
        { label: "开发", value: "dev" },
        { label: "预发", value: "staging" },
        { label: "生产", value: "production" },
      ],
      defaultValue: "dev",
    },
    {
      key: "productionContact",
      label: "生产值班人手机",
      control: "input",
      validate: z.string().optional(),
      controlProps: { placeholder: "仅生产环境需填写" },
      initialVisible: false,
    },
    {
      key: "enableAdvanced",
      label: "启用高级配置",
      control: "radio",
      options: [
        { label: "关闭", value: "off" },
        { label: "开启", value: "on" },
      ],
      defaultValue: "off",
    },
    {
      key: "advancedNote",
      label: "高级配置说明",
      control: "input",
      validate: z.string().optional(),
      controlProps: { placeholder: "开启高级配置后填写" },
      initialVisible: false,
    },
    {
      key: "moduleNames",
      label: "服务模块列表",
      control: "input",
      validate: z
        .string()
        .min(1, "请至少录入一个模块")
        .superRefine((value, ctx) => {
          const modules = parseModuleInput(value);
          if (modules.length === 0) {
            ctx.addIssue({ code: "custom", message: "请至少录入一个模块" });
          }
        }),
      helpTip: (
        <Text type="secondary">
          使用逗号或换行分隔模块名称，例如：api、web、worker
        </Text>
      ),
      controlProps: {
        placeholder: "例如：api, web, worker",
      },
    },
    {
      key: "moduleConfigs",
      label: "模块配置",
      isArray: true,
      childrenFields: [],
    },
    {
      key: "slaLevel",
      label: "服务等级",
      control: "select",
      options: [
        { label: "铜牌 (工作时间响应)", value: "bronze" },
        { label: "银牌 (7x12 小时)", value: "silver" },
        { label: "金牌 (7x24 小时)", value: "gold" },
      ],
      defaultValue: "silver",
    },
    {
      key: "requiresApproval",
      label: "上线审批方式",
      control: "radio",
      options: [
        { label: "自动审批", value: "auto" },
        { label: "人工审批", value: "manual" },
      ],
      defaultValue: "auto",
    },
    {
      key: "approverEmail",
      label: "审批人邮箱",
      control: "input",
      validate: z.string().optional(),
      controlProps: { placeholder: "选择人工审批时必填" },
      initialVisible: false,
    },
    {
      key: "summary",
      label: "配置摘要",
      control: "input",
      validate: z.string().optional(),
      controlProps: { disabled: true },
    },
  ],
} satisfies { fields: FieldSchema[] };

const paginatedModel = new FormModel(paginatedSchema);

export default function PaginatedDemoPage() {
  const form = useDynamicForm(paginatedModel);
  const [pageIndex, setPageIndex] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewData, setPreviewData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const pageFieldPaths = useMemo<FieldPath[][]>(
    () => [
      [
        ["projectName"],
        ["ownerEmail"],
        ["environment"],
        ["productionContact"],
        ["enableAdvanced"],
        ["advancedNote"],
      ],
      [["moduleNames"], ["moduleConfigs"]],
      [["slaLevel"], ["requiresApproval"], ["approverEmail"], ["summary"]],
    ],
    []
  );

  useEffect(() => {
    const effect: ReactiveEffect = (
      ctx: ReactiveEffectContext,
      cause: EffectInvokeReason,
      info?: { changedPath?: FieldPath }
    ) => {
      let environment = "";
      try {
        environment = ctx.get(["environment"]);
      } catch {}

      const visible = environment === "production";
      ctx.setVisible(["productionContact"], visible);
      const validator = visible
        ? z
            .string()
            .min(1, "生产环境需填写值班人手机")
            .regex(/^[0-9\-+]{5,20}$/, "请填写正确的手机号或分机号")
        : z.string().optional();
      ctx.setValidation(["productionContact"], validator as any);
      if (
        cause === "value-changed" &&
        info?.changedPath?.join(".") === "environment"
      ) {
        paginatedModel.validateField(["productionContact"]).catch(() => {});
      }
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    const effect: ReactiveEffect = (
      ctx: ReactiveEffectContext,
      cause: EffectInvokeReason,
      info?: { changedPath?: FieldPath }
    ) => {
      let flag = "off";
      try {
        flag = ctx.get(["enableAdvanced"]);
      } catch {}

      const visible = flag === "on";
      ctx.setVisible(["advancedNote"], visible);
      const validator = visible
        ? z.string().min(1, "开启高级配置后需补充说明")
        : z.string().optional();
      ctx.setValidation(["advancedNote"], validator as any);
      if (
        cause === "value-changed" &&
        info?.changedPath?.join(".") === "enableAdvanced"
      ) {
        paginatedModel.validateField(["advancedNote"]).catch(() => {});
      }
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    const effect: ReactiveEffect = (ctx: ReactiveEffectContext) => {
      let rawModules = "";
      rawModules = ctx.get(["moduleNames"]) ?? "";

      const modules = parseModuleInput(rawModules);
      ctx.updateChildren(["moduleConfigs"], moduleChildrenSchema(modules), {
        keepPreviousData: true,
      });
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    const effect: ReactiveEffect = (
      ctx: ReactiveEffectContext,
      cause: EffectInvokeReason,
      info?: { changedPath?: FieldPath }
    ) => {
      ctx.get(["moduleConfigs"]);

      let rawModules = "";
      rawModules = ctx.get(["moduleNames"]) ?? "";
      const modules = parseModuleInput(rawModules);

      modules.forEach(({ key }) => {
        const base: FieldPath = ["moduleConfigs", key];
        let exposure: string | undefined;
        try {
          exposure = ctx.get([...base, "exposure"]);
        } catch {
          return;
        }

        const shouldShowPort = exposure === "custom";
        ctx.setVisible([...base, "exposurePort"], shouldShowPort);
        const validator = shouldShowPort
          ? z
              .string()
              .min(1, "自定义端口时必填")
              .regex(/^[0-9]{1,5}$/, "请输入 0-65535 之间的端口")
          : z.string().optional();
        ctx.setValidation([...base, "exposurePort"], validator as any);
        const changed = info?.changedPath;
        if (
          cause === "value-changed" &&
          changed &&
          changed.length === [...base, "exposure"].length &&
          changed.every((v, i) => v === [...base, "exposure"][i])
        ) {
          paginatedModel
            .validateField([...base, "exposurePort"])
            .catch(() => {});
        }
      });
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    const effect: ReactiveEffect = (
      ctx: ReactiveEffectContext,
      cause: EffectInvokeReason,
      info?: { changedPath?: FieldPath }
    ) => {
      let mode = "auto";
      mode = ctx.get(["requiresApproval"]);

      const visible = mode === "manual";
      ctx.setVisible(["approverEmail"], visible);
      const validator = visible
        ? z
            .string()
            .min(1, "人工审批时需填写审批人邮箱")
            .email("请输入正确的邮箱")
        : z.string().optional();
      ctx.setValidation(["approverEmail"], validator as any);
      if (
        cause === "value-changed" &&
        info?.changedPath?.join(".") === "requiresApproval"
      ) {
        paginatedModel.validateField(["approverEmail"]).catch(() => {});
      }
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    const effect: ReactiveEffect = (ctx: ReactiveEffectContext) => {
      let projectName = "";
      let environment = "";
      let rawModules = "";
      try {
        projectName = ctx.get(["projectName"]) ?? "";
      } catch {}
      try {
        environment = ctx.get(["environment"]) ?? "";
      } catch {}
      try {
        rawModules = ctx.get(["moduleNames"]) ?? "";
      } catch {}

      const modules = parseModuleInput(rawModules);
      const summaryPieces = [
        projectName ? `项目：${projectName}` : "",
        environment ? `环境：${environment}` : "",
        modules.length > 0 ? `模块数：${modules.length}` : "",
      ].filter(Boolean);
      const summary = summaryPieces.join(" / ");
      const current = ((): string => {
        try {
          return paginatedModel.get(["summary"], "value") ?? "";
        } catch {
          return "";
        }
      })();

      if (summary !== current) {
        ctx.setValue(["summary"], summary, { invokeOnChange: false });
      }
    };

    const dispose = paginatedModel.registerRule(effect);
    return dispose;
  }, []);

  useEffect(() => {
    paginatedModel.runAllRules();
  }, []);

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
            分页动态表单综合示例
          </Title>
          <Paragraph style={{ marginBottom: 0 }}>
            本示例将数组字段、条件展示、跨字段校验与自动摘要等功能聚合在同一张表单中，
            通过 Ant Design 的 <Text code>Pagination</Text>{" "}
            组件在多个分页之间切换。
          </Paragraph>
        </div>

        <Card>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Generator
              model={paginatedModel}
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
