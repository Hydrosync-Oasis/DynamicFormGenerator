"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Divider, Space, message } from "antd";
import { z } from "zod";

import { Generator, useDynamicForm } from "../utils/generator";
import { FormModel } from "../utils/structures";
import type {
  FieldSchema,
  FieldPath,
  EffectInvokeReason,
  ReactiveEffect,
  ReactiveEffectContext,
} from "../utils/structures";

/**
 * 简单 IPv4 校验（基础校验）
 */
const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

const parseIpList = (raw: string | undefined | null): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

// 顶层 schema：包含 IP 列表 + 每 IP 对应的配置数组
const schema = {
  fields: [
    {
      key: "ipList",
      label: "IP列表",
      control: "input",
      helpTip: "以英文逗号分隔多个 IP，例如：10.0.0.1, 10.0.0.2",
      validate: z
        .string()
        .min(1, "请填写 IP 列表")
        .superRefine((val, ctx) => {
          const ips = parseIpList(val);
          if (ips.length === 0) {
            ctx.addIssue({ code: "custom", message: "请至少填写一个 IP" });
            return;
          }
          for (const ip of ips) {
            if (!ipv4Regex.test(ip)) {
              ctx.addIssue({ code: "custom", message: `IP 格式不正确：${ip}` });
            }
          }
        }),
      itemProps: { placeholder: "如：10.0.0.1, 10.0.0.2" },
    },
    {
      key: "perIP",
      label: "每IP配置",
      isArray: true,
      childrenFields: [], // 动态填充
    },
  ],
};
const model = new FormModel(schema as any);

export default function Page() {
  const form = useDynamicForm(model);

  // 根据 IP 数组构建每组的子字段 schema
  const buildChildren = (ipArr: string[]): FieldSchema[] => {
    return ipArr.map((ip, idx) => ({
      key: String(ip),
      label: ip,
      childrenFields: [
        // 在组里放一个只读的 IP 显示字段
        {
          key: "containerDataDisk",
          label: "容器数据盘",
          control: "input",
          validate: z.string().min(1, "请填写容器数据盘"),
          itemProps: { placeholder: "例如：/data/container" },
        },
        {
          key: "localVolumeStorage",
          label: "本地卷存储",
          control: "input",
          validate: z.string().min(1, "请填写本地卷存储"),
          itemProps: { placeholder: "例如：/var/lib/volumes" },
        },
        {
          key: "cspStorageDisk",
          label: "csp存储盘",
          control: "input",
          validate: z.string().min(1, "请填写 csp 存储盘"),
          itemProps: { placeholder: "例如：/data/csp" },
        },
        {
          key: "materialDiskConfig",
          label: "物料盘配置",
          control: "input",
          validate: z.string().min(1, "请填写物料盘配置"),
          itemProps: { placeholder: "例如：/data/material" },
        },
        {
          key: "mountType",
          label: "挂载位置",
          control: "radio",
          options: [
            { label: "独立磁盘", value: "dedicated" },
            { label: "根目录", value: "root" },
          ],
          defaultValue: "root",
        },
        {
          key: "mountPath",
          label: "路径",
          control: "input",
          itemProps: { placeholder: "选择独立磁盘时需填写，例如：/mnt/disk1" },
        },
      ],
    }));
  };

  // Rule A：仅监听 ipList，执行 updateChildren
  useEffect(() => {
    const effect = (ctx: ReactiveEffectContext, _cause: EffectInvokeReason) => {
      // 读取 ipList
      let rawList: string = "";
      try {
        rawList = ctx.get(["ipList"]) ?? "";
      } catch {}

      const ips = parseIpList(rawList);

      // 仅由 ipList 驱动 perIP 的 children
      ctx.updateChildren(["perIP"], buildChildren(ips), {
        keepPreviousData: true,
        shouldTriggerRule: false,
      });
    };

    const dispose = model.registerRule(effect);
    // model.runAllRules();
    return dispose;
  }, [model]);

  // Rule B：监听 perIP（其子字段变化也会触发），控制 mountPath 的显示与校验
  useEffect(() => {
    const effect: ReactiveEffect = (
      ctx: ReactiveEffectContext,
      cause: EffectInvokeReason
    ) => {
      // 依赖挂到 perIP 上（其子字段变化会触发）
      try {
        ctx.get(["perIP"]);
      } catch {}

      // 读取 ipList 以获取每组的实际 key（为 IP 字符串）
      let rawList: string = "";
      try {
        rawList = ctx.get(["ipList"]) ?? "";
      } catch {}
      const ips = parseIpList(rawList);

      // 遍历每个 IP 作为组 key，依据 mountType 控制 mountPath
      for (const ip of ips) {
        const base: FieldPath = ["perIP", ip];
        let mountType: "dedicated" | "root" | undefined;
        try {
          mountType = ctx.get([...base, "mountType"]);
        } catch {
          // 该组尚未生成或被裁剪
          continue;
        }

        const shouldShow = mountType === "dedicated";
        try {
          ctx.setVisible([...base, "mountPath"], shouldShow);
        } catch {}

        const validator = shouldShow
          ? z.string().min(1, "选择独立磁盘时需填写路径")
          : z.string().optional();

        try {
          ctx.setValidation([...base, "mountPath"], validator as any);
          if (cause === "value-changed") {
            model.validateField([...base, "mountPath"]).catch(() => {});
          }
        } catch {}
      }
    };

    const dispose = model.registerRule(effect as any);
    // model.runAllRules();
    return dispose;
  }, [model]);

  const handleSubmit = async () => {
    try {
      console.log(model.getSnapshot());
      await form.validateAllFields();
      const data = model.getJSONData(true);
      message.success("校验通过，已在控制台打印数据");
      console.log("提交数据:", data);
    } catch {
      message.error("请检查表单错误");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 12 }}>IP 列表驱动的数组型嵌套字段</h2>

      {/* 单独渲染 IP 列表 */}
      <Generator
        model={model}
        displayFields={[["ipList"]] as any}
        size="normal"
        displayOption={{
          labelSpan: 4,
          fieldSpan: 20,
          showInline: false,
        }}
      />

      <Divider />

      {/* 渲染每 IP 的配置，卡片栅格 */}
      <Generator
        model={model}
        displayFields={[["perIP"]] as any}
        size="small"
        displayOption={{
          labelSpan: 8,
          fieldSpan: 16,
          showInline: true,
          showDebug: true,
        }}
        inlineMaxPerRow={3}
      />

      <Divider />
      <Space>
        <Button type="primary" onClick={handleSubmit}>
          提交
        </Button>
      </Space>
    </div>
  );
}
