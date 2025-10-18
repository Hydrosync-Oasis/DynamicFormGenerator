"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, DatePicker, Divider, Space, message } from "antd";
import { z } from "zod";

import { Generator, useDynamicForm } from "../utils/generator";
import { FormModel } from "../utils/structures";
import type { FieldSchema, FieldPath } from "../utils/structures";

// AntD RangePicker as a custom control
const RangeControl: React.FC<{
  value?: [any, any] | null;
  onChange?: (val: [any, any] | null) => void;
  disabled?: boolean;
  status?: "error" | undefined;
  size?: "small" | undefined;
  id?: string;
}> = ({ value, onChange, disabled, status, size, id }) => {
  return (
    <DatePicker.RangePicker
      id={id}
      style={{ width: "100%" }}
      value={value as any}
      onChange={(v) => onChange?.((v as any) ?? null)}
      disabled={disabled}
      status={status}
      size={size}
      placeholder={["开始日期", "结束日期"]}
      allowClear
    />
  );
};

// Define top-level schema with an array-type field "members"
const schema = {
  fields: [
    {
      key: "members",
      isArray: true,
      // childrenFields are managed via updateChildren; start empty
      childrenFields: [],
    },
  ],
};
const model = new FormModel(schema as any);
export default function Page() {
  // Maintain list of group keys, managed locally, and always update model via updateChildren
  const [groupKeys, setGroupKeys] = useState<string[]>(["0"]);
  const seqRef = useRef(1); // next id seed

  // Build children schemas from group keys
  const buildChildren = (keys: string[]): FieldSchema[] => {
    return keys.map((k) => ({
      key: k,
      // container of one group's fields
      childrenFields: [
        {
          key: "name",
          label: "英文名",
          control: "input",
          validate: z.string().min(1, "请填写英文名"),
          itemProps: { placeholder: "如: John" },
        },
        {
          key: "period",
          label: "开始-结束日期",
          control: RangeControl,
          // 基本形状校验（非空、两个日期），重叠校验由规则动态覆盖
          validate: z
            .any()
            .refine((v) => Array.isArray(v) && v[0] && v[1], "请选择日期区间"),
        },
      ],
    }));
  };

  const form = useDynamicForm(model);

  // Keep latest groupKeys for rule closure
  const groupKeysRef = useRef(groupKeys);
  useEffect(() => {
    groupKeysRef.current = groupKeys;
  }, [groupKeys]);

  // Ensure model's members children are in sync on mount and when keys change
  useEffect(() => {
    model.updateChildren(
      ["members"],
      buildChildren(groupKeys),
      {
        keepPreviousData: true,
      },
      false
    );
  }, [groupKeys, model]);

  // Register rule on the array root to prevent overlapping periods for same name
  useEffect(() => {
    const effect = (ctx: {
      get: (p: FieldPath) => any;
      set: (p: FieldPath, prop: "validation" | any, v: any) => void;
    }) => {
      // Attach to the array root; during dependency collection this records the dep,
      // at runtime this non-leaf get would throw so wrap it.
      try {
        ctx.get(["members"]);
      } catch {}

      const keys = groupKeysRef.current;

      // Collect current values per group
      type Range = { start?: number; end?: number };
      const nameByKey = new Map<string, string | undefined>();
      const rangeByKey = new Map<string, Range>();

      for (const k of keys) {
        let nm: string | undefined;
        try {
          nm = ctx.get(["members", k, "name"]);
        } catch {}
        nameByKey.set(k, nm);

        // maintain period range cache for overlap checks
        try {
          const prd = ctx.get(["members", k, "period"]) as [any, any] | null;
          const start = prd?.[0] ? (prd[0] as any).valueOf?.() : undefined;
          const end = prd?.[1] ? (prd[1] as any).valueOf?.() : undefined;
          rangeByKey.set(k, { start, end });
        } catch {
          rangeByKey.set(k, {});
        }
      }

      // For each group, set a validation that checks overlap against others with same name
      for (const k of keys) {
        const myName = nameByKey.get(k);
        const others = keys.filter(
          (x) => x !== k && nameByKey.get(x) === myName
        );

        const validator = z
          .any()
          .refine((v) => Array.isArray(v) && v[0] && v[1], "请选择日期区间")
          .superRefine((v, ctxZ) => {
            if (!myName || !Array.isArray(v) || !v[0] || !v[1]) return;
            const s = (v[0] as any).valueOf?.();
            const e = (v[1] as any).valueOf?.();
            if (typeof s !== "number" || typeof e !== "number") return;

            for (const o of others) {
              const r = rangeByKey.get(o);

              if (!r?.start || !r?.end) continue;
              const overlap = s <= r.end! && r.start! <= e; // inclusive overlap
              if (overlap) {
                ctxZ.addIssue({
                  code: "custom",
                  message: "同一英文名的时间段不能重叠",
                });
                return; // one issue is enough
              }
            }
          });

        try {
          ctx.set(["members", k, "period"], "validation", validator as any);
          model.validateField(["members", k, "period"]);
        } catch {}
      }
    };

    const callback = model.registerRule(effect as any);
    // Run once to initialize
    model.runAllRules();
    return callback;
  }, [model]);

  const addGroup = () => {
    const next = String(seqRef.current++);
    setGroupKeys((prev) => [...prev, next]);
  };

  const handleSubmit = async () => {
    try {
      await form.validateAllFields();
      const data = model.getJSONData(true);
      // Show a quick success and log
      message.open({
        content: "校验通过，已在控制台打印数据",
        type: "success",
      });
      console.log("提交数据:", data);
    } catch (err) {
      message.error("请检查表单错误");
    }
  };

  console.log(model.getSnapshot());

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 12 }}>数组型嵌套字段 Demo</h2>
      <Generator
        model={model}
        displayFields={[["members"]] as any}
        showInline
        size="normal"
        showDebug
        labelSpan={8}
        fieldSpan={16}
      />

      <Divider />
      <Space>
        <Button type="dashed" onClick={addGroup}>
          + 添加一组
        </Button>
        <Button type="primary" onClick={handleSubmit}>
          提交
        </Button>
      </Space>
    </div>
  );
}
