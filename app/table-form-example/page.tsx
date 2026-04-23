"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, message } from "antd";
import { z } from "zod";
import {
  FormModel,
  type FieldPath,
  type FieldSchema,
} from "@/utils/structures";
import { Generator, useDynamicForm } from "@/utils/generator";
import type {
  ImmutableFormState,
  FormCommands,
  FieldValue,
} from "@/utils/type";

/** 表格单元格渲染：去掉默认 label，保留校验 */
const TableCellField = React.memo(
  ({
    state,
    onChange,
    formCommands,
  }: {
    state: ImmutableFormState;
    onChange: (value: FieldValue, path: FieldPath) => void;
    formCommands: FormCommands;
  }) => {
    if (state.type !== "field" || !state.prop.visible) {
      return null;
    }

    const path = state.path.slice(1);
    const firstError = state.prop.errorMessage
      ? Object.values(state.prop.errorMessage).flat()[0]
      : undefined;

    const readOnly = String(state.key) === "amount";

    return (
      <div>
        <Input
          size="small"
          value={state.prop.value}
          disabled={readOnly || !!state.prop.controlProps?.disabled}
          status={firstError ? "error" : undefined}
          {...state.prop.controlProps}
          onChange={(e) => {
            onChange(e.target.value, path);
            formCommands.validateField(path, true, "onChange");
          }}
          onBlur={() => formCommands.validateField(path, true, "onBlur")}
        />
        {firstError ? (
          <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}>
            {String(firstError)}
          </div>
        ) : null}
      </div>
    );
  },
);

TableCellField.displayName = "TableCellField";

/** 单行布局：按列渲染 + 删除按钮 */
const ItemRowLayout = React.memo(
  ({
    render,
    state,
    formCommands,
  }: {
    render: (state: ImmutableFormState) => React.ReactNode;
    state: ImmutableFormState;
    formCommands: FormCommands;
  }) => {
    if (state.type === "field") {
      return null;
    }

    const rowKey = String(state.key);
    const arrayPath: FieldPath = state.path.slice(1, -1);

    const findChild = (key: string) =>
      state.children.find((child) => String(child.key) === key);

    const removeRow = () => {
      const current = (formCommands.getValue(arrayPath) || {}) as Record<
        string,
        any
      >;
      if (!Object.prototype.hasOwnProperty.call(current, rowKey)) {
        return;
      }

      const next = { ...current };
      delete next[rowKey];
      formCommands.setValue(arrayPath, next, { invokeEffect: true }, "replace");
    };

    return (
      <div className="grid grid-cols-[2.2fr_1fr_1fr_1.2fr_auto] gap-2 border-b border-[#f0f0f0] px-2 py-2">
        <div>
          {findChild("productName") ? render(findChild("productName")!) : null}
        </div>
        <div>{findChild("qty") ? render(findChild("qty")!) : null}</div>
        <div>
          {findChild("unitPrice") ? render(findChild("unitPrice")!) : null}
        </div>
        <div>{findChild("amount") ? render(findChild("amount")!) : null}</div>
        <div className="flex items-start pt-1">
          <Button size="small" danger onClick={removeRow}>
            删除
          </Button>
        </div>
      </div>
    );
  },
);

ItemRowLayout.displayName = "ItemRowLayout";

/** 数组布局：表头 + 所有行 */
const ItemsTableLayout = React.memo(
  ({
    render,
    state,
  }: {
    render: (state: ImmutableFormState) => React.ReactNode;
    state: ImmutableFormState;
  }) => {
    if (state.type === "field") {
      return null;
    }

    return (
      <div className="mt-2 overflow-x-auto rounded border border-[#d9d9d9]">
        <div className="grid grid-cols-[2.2fr_1fr_1fr_1.2fr_auto] bg-[#fafafa] px-2 py-2 text-[12px] font-semibold text-[#444]">
          <div>商品名</div>
          <div>数量</div>
          <div>单价</div>
          <div>金额</div>
          <div>操作</div>
        </div>
        <div>{state.children.map((child) => render(child))}</div>
      </div>
    );
  },
);

ItemsTableLayout.displayName = "ItemsTableLayout";

const toNumber = (value: any, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toMoney = (value: number): string => value.toFixed(2);

export default function TableFormExamplePage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "orderNo",
          label: "订单号",
          control: "input",
          validate: z.string().min(1, { message: "请输入订单号" }),
          controlProps: { placeholder: "例如 SO-20260422-001" },
        },
        {
          key: "buyer",
          label: "采购方",
          control: "input",
          validate: z.string().min(1, { message: "请输入采购方" }),
          controlProps: { placeholder: "请输入采购方名称" },
        },
        {
          key: "customerLevel",
          label: "客户等级",
          control: "radio",
          defaultValue: "normal",
          validate: z.enum(["normal", "vip"]),
          controlProps: {
            options: [
              { label: "普通", value: "normal" },
              { label: "VIP", value: "vip" },
            ],
          },
        },
        {
          key: "couponCode",
          label: "优惠码",
          control: "input",
          validate: z.string().optional(),
          controlProps: { placeholder: "可选: VIP20 / SAVE10" },
        },
        {
          key: "taxMode",
          label: "税费模式",
          control: "radio",
          defaultValue: "exclude",
          validate: z.enum(["exclude", "include"]),
          controlProps: {
            options: [
              { label: "税外", value: "exclude" },
              { label: "税内", value: "include" },
            ],
          },
        },
        {
          key: "taxRate",
          label: "税率",
          control: "input",
          defaultValue: "0.13",
          validate: z.string().refine((v) => {
            const n = Number(v);
            return !Number.isNaN(n) && n >= 0 && n <= 1;
          }, "税率请输入 0~1 之间的小数，例如 0.13"),
          controlProps: {
            placeholder: "0.13",
          },
          helpTip: "仅税外模式生效",
        },
        {
          key: "shippingFee",
          label: "运费",
          control: "input",
          defaultValue: "20.00",
          validate: z
            .string()
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
              message: "运费必须大于等于 0",
            }),
          controlProps: {
            type: "number",
            min: 0,
            step: "0.01",
            placeholder: "20.00",
          },
        },
        {
          key: "items",
          isArray: true,
          LayoutComponent: ItemsTableLayout,
          arraySchema: {
            isArray: false,
            LayoutComponent: ItemRowLayout,
            childrenFields: [
              {
                key: "productName",
                label: "商品名",
                control: "input",
                validate: z.string().min(1, { message: "请输入商品名" }),
                controlProps: { placeholder: "例如 机械键盘" },
                FieldDisplayComponent: TableCellField,
              },
              {
                key: "qty",
                label: "数量",
                control: "input",
                validate: z
                  .string()
                  .min(1, { message: "请输入数量" })
                  .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
                    message: "数量必须大于 0",
                  }),
                controlProps: { type: "number", min: 1, placeholder: "1" },
                FieldDisplayComponent: TableCellField,
              },
              {
                key: "unitPrice",
                label: "单价",
                control: "input",
                validate: z
                  .string()
                  .min(1, { message: "请输入单价" })
                  .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
                    message: "单价必须大于等于 0",
                  }),
                controlProps: {
                  type: "number",
                  min: 0,
                  step: "0.01",
                  placeholder: "0.00",
                },
                FieldDisplayComponent: TableCellField,
              },
              {
                key: "amount",
                label: "金额",
                control: "input",
                validate: z.string().optional(),
                controlProps: { disabled: true },
                defaultValue: "0.00",
                FieldDisplayComponent: TableCellField,
              },
            ],
          },
        },
        {
          key: "subtotal",
          label: "商品小计",
          control: "input",
          validate: z.string().optional(),
          defaultValue: "0.00",
          controlProps: { disabled: true },
        },
        {
          key: "discountAmount",
          label: "折扣金额",
          control: "input",
          validate: z.string().optional(),
          defaultValue: "0.00",
          controlProps: { disabled: true },
        },
        {
          key: "taxAmount",
          label: "税额",
          control: "input",
          validate: z.string().optional(),
          defaultValue: "0.00",
          controlProps: { disabled: true },
        },
        {
          key: "totalAmount",
          label: "应付总额",
          control: "input",
          validate: z.string().optional(),
          defaultValue: "0.00",
          controlProps: { disabled: true },
        },
        {
          key: "remark",
          label: "备注",
          control: "input",
          validate: z.string().optional(),
          controlProps: { placeholder: "可选" },
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  useEffect(() => {
    // 联动规则1：计算行金额与小计；服务类商品强制数量为1
    const stopLineAmount = model.effect((value, commands) => {
      const items = (value.items() || {}) as Record<string, any>;
      const patch: Record<string, any> = {};
      let subtotal = 0;

      Object.entries(items).forEach(([k, row]) => {
        const rowData = row as any;
        const name = String(rowData?.productName ?? "").trim();
        const isServiceItem = name.includes("服务");
        const unitPrice = toNumber(rowData?.unitPrice, 0);
        const qty = isServiceItem ? 1 : Math.max(toNumber(rowData?.qty, 0), 0);

        if (isServiceItem && String(rowData?.qty ?? "") !== "1") {
          patch[k] = {
            ...(patch[k] ?? {}),
            qty: "1",
          };
        }

        commands.setControlProp(["items", k, "qty"], "disabled", isServiceItem);
        commands.setAlertTip(
          ["items", k, "qty"],
          isServiceItem ? "服务类商品数量固定为 1" : undefined,
        );

        const amount =
          Number.isFinite(unitPrice) && Number.isFinite(qty)
            ? qty * unitPrice
            : 0;
        subtotal += amount;
        patch[k] = {
          ...(patch[k] ?? {}),
          amount: toMoney(amount),
        };
      });

      commands.setValue(["items"], patch, { invokeEffect: true }, "merge");
      commands.setValue(
        ["subtotal"],
        toMoney(subtotal),
        { invokeEffect: true },
        "merge",
      );
    });

    // 联动规则2：客户等级 + 优惠码影响折扣；高折扣时备注必填
    const stopDiscount = model.effect((value, commands) => {
      const subtotal = toNumber(value.subtotal(), 0);
      const customerLevel = String(value.customerLevel() ?? "normal");
      const couponCode = String(value.couponCode() ?? "")
        .trim()
        .toUpperCase();

      let discountRate = customerLevel === "vip" ? 0.05 : 0;
      if (couponCode === "VIP20") {
        discountRate = Math.max(discountRate, 0.2);
      } else if (couponCode === "SAVE10") {
        discountRate = Math.max(discountRate, 0.1);
      }

      const hasCoupon = couponCode.length > 0;
      const validCoupon = couponCode === "VIP20" || couponCode === "SAVE10";
      commands.setAlertTip(
        ["couponCode"],
        hasCoupon && !validCoupon
          ? "优惠码无效，可用: VIP20 / SAVE10"
          : undefined,
      );

      const discountAmount = subtotal * discountRate;
      commands.setValue(
        ["discountAmount"],
        toMoney(discountAmount),
        { invokeEffect: true },
        "merge",
      );

      if (discountRate >= 0.15) {
        commands.setAlertTip(["remark"], "当前折扣较高，请填写备注说明");
        commands.setValidation(
          ["remark"],
          z.string().min(5, { message: "高折扣订单请至少填写 5 个字备注" }),
        );
      } else {
        commands.setAlertTip(["remark"], undefined);
        commands.setValidation(["remark"], z.string().optional());
      }
    });

    // 联动规则3：税费模式 + 运费策略共同决定应付总额
    const stopSummary = model.effect((value, commands) => {
      const subtotal = toNumber(value.subtotal(), 0);
      const discountAmount = toNumber(value.discountAmount(), 0);
      const taxMode = String(value.taxMode() ?? "exclude");
      const taxRate = toNumber(value.taxRate({ raw: true }), 0);
      const currentShippingFee = toNumber(value.shippingFee(), 0);

      const freeShipping = subtotal >= 500;
      commands.setControlProp(["shippingFee"], "disabled", freeShipping);
      commands.setAlertTip(
        ["shippingFee"],
        freeShipping ? "满 500 免运费" : undefined,
      );
      if (freeShipping && currentShippingFee !== 0) {
        commands.setValue(
          ["shippingFee"],
          "0.00",
          { invokeEffect: true },
          "merge",
        );
      }

      const isTaxExclude = taxMode === "exclude";
      commands.setVisible(["taxRate"], isTaxExclude);
      if (isTaxExclude) {
        commands.setValidation(
          ["taxRate"],
          z.string().refine((v) => {
            const n = Number(v);
            return !Number.isNaN(n) && n >= 0 && n <= 1;
          }, "税率请输入 0~1 之间的小数，例如 0.13"),
        );
      } else {
        commands.setValidation(["taxRate"], z.string().optional());
      }

      const shippingFee = freeShipping ? 0 : currentShippingFee;
      const taxableBase = Math.max(subtotal - discountAmount, 0);
      const taxAmount = isTaxExclude ? taxableBase * taxRate : 0;
      const totalAmount = taxableBase + taxAmount + shippingFee;

      commands.setValue(
        ["taxAmount"],
        toMoney(taxAmount),
        { invokeEffect: true },
        "merge",
      );
      commands.setValue(
        ["totalAmount"],
        toMoney(totalAmount),
        { invokeEffect: true },
        "merge",
      );
    });

    form.setFieldsValue({
      orderNo: `SO-${Date.now()}`,
      buyer: "",
      customerLevel: "normal",
      couponCode: "",
      taxMode: "exclude",
      taxRate: "0.13",
      shippingFee: "20.00",
      items: {
        ROW_001: {
          productName: "",
          qty: "1",
          unitPrice: "0.00",
          amount: "0.00",
        },
      },
      subtotal: "0.00",
      discountAmount: "0.00",
      taxAmount: "0.00",
      totalAmount: "0.00",
      remark: "",
    });

    model.initial();

    return () => {
      stopLineAmount();
      stopDiscount();
      stopSummary();
    };
  }, [form, model]);

  const displayFields: FieldPath[] = useMemo(
    () => [
      ["orderNo"],
      ["buyer"],
      ["customerLevel"],
      ["couponCode"],
      ["taxMode"],
      ["taxRate"],
      ["shippingFee"],
      ["items"],
      ["subtotal"],
      ["discountAmount"],
      ["taxAmount"],
      ["totalAmount"],
      ["remark"],
    ],
    [],
  );

  const addRow = () => {
    const key = `ROW_${Date.now()}`;
    model.insertIntoArray(
      ["items"],
      {
        [key]: {
          productName: "",
          qty: "1",
          unitPrice: "0.00",
          amount: "0.00",
        },
      },
      "after",
      undefined,
      true,
    );
  };

  const removeLast = () => {
    const items = (model.get(["items"], "rawValue") || {}) as Record<
      string,
      any
    >;
    const keys = Object.keys(items);

    if (keys.length === 0) {
      message.warning("没有可删除的行");
      return;
    }

    const lastKey = keys[keys.length - 1];
    model.setItemOfArray(["items"], lastKey, undefined, true, true);
  };

  const onReset = () => {
    form.resetFields();
    message.success("已重置到初始状态");
  };

  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，请查看控制台");
      // eslint-disable-next-line no-console
      console.log("table form submit:", data);
    } catch (_e) {
      message.error("请检查校验错误");
    }
  };

  return (
    <div className="p-6">
      <Card title="表格表单示例（订单明细）">
        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ showDebug: true }}
        />

        <div className="mt-4">
          <Space>
            <Button onClick={addRow}>新增行</Button>
            <Button onClick={removeLast}>删除最后一行</Button>
            <Button onClick={onReset}>重置</Button>
            <Button type="primary" onClick={onSubmit}>
              提交
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
