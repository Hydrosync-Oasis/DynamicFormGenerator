"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Space, message } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import { Generator, useDynamicForm } from "../../utils/generator";
import type { FieldPath, FieldSchema } from "../../utils/structures";

export default function TestPreInitArrayObjectPage() {
  const ItemsLayout = React.memo(
    ({
      render,
      state,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
    }) => {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 12,
          }}
        >
          {state.children.map((child: any) => render(child))}
        </div>
      );
    },
  );

  ItemsLayout.displayName = "ItemsLayout";

  const ItemCardLayout = React.memo(
    ({
      render,
      state,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
    }) => {
      const itemKey = state.path[state.path.length - 1];

      return (
        <Card
          size="small"
          title={`商品项 - ${itemKey}`}
          style={{ border: "1px solid #d9d9d9" }}
          bodyStyle={{ padding: "12px" }}
        >
          {state.children.map((child: any) => render(child))}
        </Card>
      );
    },
  );

  ItemCardLayout.displayName = "ItemCardLayout";

  const ShippingLayout = React.memo(
    ({
      render,
      state,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
    }) => {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px dashed #91caff",
            borderRadius: 6,
            backgroundColor: "#f5f9ff",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>收货信息</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.children.map((child: any) => render(child))}
          </div>
        </div>
      );
    },
  );

  ShippingLayout.displayName = "ShippingLayout";

  const AddressLayout = React.memo(
    ({
      render,
      state,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
    }) => {
      return (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px dashed #b7eb8f",
            borderRadius: 6,
            backgroundColor: "#f6ffed",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>地址对象</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.children.map((child: any) => render(child))}
          </div>
        </div>
      );
    },
  );

  AddressLayout.displayName = "AddressLayout";

  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "orderTitle",
          label: "订单标题",
          control: "input",
          controlProps: {
            placeholder: "请输入订单标题",
          },
          validate: z.string().min(1, { message: "请输入订单标题" }),
        },
        {
          key: "lineItems",
          isArray: true,
          LayoutComponent: ItemsLayout,
          arraySchema: {
            isArray: false,
            LayoutComponent: ItemCardLayout,
            childrenFields: [
              {
                key: "productName",
                label: "商品名",
                control: "input",
                controlProps: {
                  placeholder: "请输入商品名",
                },
                validate: z.string().min(1, { message: "请输入商品名" }),
              },
              {
                key: "quantity",
                label: "数量",
                control: "input",
                controlProps: {
                  type: "number",
                  placeholder: "请输入数量",
                },
                validate: z
                  .string()
                  .min(1, { message: "请输入数量" })
                  .refine((value) => Number(value) > 0, {
                    message: "数量必须大于 0",
                  }),
              },
              {
                key: "shipping",
                isArray: false,
                LayoutComponent: ShippingLayout,
                childrenFields: [
                  {
                    key: "receiver",
                    label: "收货人",
                    control: "input",
                    controlProps: {
                      placeholder: "请输入收货人",
                    },
                    validate: z.string().min(1, { message: "请输入收货人" }),
                  },
                  {
                    key: "address",
                    isArray: false,
                    LayoutComponent: AddressLayout,
                    childrenFields: [
                      {
                        key: "city",
                        label: "城市",
                        control: "input",
                        controlProps: {
                          placeholder: "请输入城市",
                        },
                        validate: z.string().min(1, { message: "请输入城市" }),
                      },
                      {
                        key: "street",
                        label: "街道",
                        control: "input",
                        controlProps: {
                          placeholder: "请输入街道",
                        },
                        validate: z.string().min(1, { message: "请输入街道" }),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  useEffect(() => {
    // 在调用 model.initial 之前，先写入初始值
    form.setFieldsValue({
      orderTitle: "预设订单（初始化前注入）",
      lineItems: {
        ITEM_001: {
          productName: "机械键盘",
          quantity: "2",
          shipping: {
            receiver: "张三",
            address: {
              city: "上海",
              street: "浦东新区世纪大道 1 号",
            },
          },
        },
        ITEM_002: {
          productName: "显示器",
          quantity: "1",
          shipping: {
            receiver: "李四",
            address: {
              city: "杭州",
              street: "西湖区文三路 99 号",
            },
          },
        },
      },
    });

    model.initial();
  }, [form, model]);

  const displayFields: FieldPath[] = useMemo(
    () => [["orderTitle"], ["lineItems"]],
    [],
  );

  const onAddItem = () => {
    const itemKey = `ITEM_${Date.now()}`;
    model.insertIntoArray(
      ["lineItems"],
      {
        [itemKey]: {
          productName: "新商品",
          quantity: "1",
          shipping: {
            receiver: "",
            address: {
              city: "",
              street: "",
            },
          },
        },
      },
      "after",
      undefined,
      true,
    );
    message.success("已添加新的商品项");
  };

  const onSubmit = async () => {
    try {
      const values = await form.submit();
      message.success("提交成功，请查看控制台");
      console.log("[test-pre-init-array-object] submit:", values);
    } catch (error) {
      message.error("提交失败，请检查校验错误");
      console.error(error);
    }
  };

  const onReset = () => {
    form.resetFields();
    message.info("表单已重置");
  };

  return (
    <div className="p-6">
      <Card
        title="测试路由：数组嵌套对象字段（初始化前设置初始值）"
        extra={
          <Button type="primary" onClick={onAddItem}>
            添加商品项
          </Button>
        }
      >
        <div className="mb-4 p-4 bg-blue-50 rounded">
          本页示例包含数组字段 lineItems，数组项中嵌套 shipping 对象，shipping
          内再嵌套 address 对象。并且先 setFieldsValue，再调用 model.initial。
        </div>

        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ showDebug: false }}
        />

        <Divider />

        <Space>
          <Button type="primary" onClick={onSubmit}>
            提交
          </Button>
          <Button onClick={onReset}>重置</Button>
        </Space>
      </Card>
    </div>
  );
}
