"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, Button, Card, Divider, Space, Tag } from "antd";
import { z } from "zod";
import { Generator } from "@/utils/generator";
import { FieldPath, FieldSchema, FormModel } from "@/utils/structures";

const dirtyTargets: FieldPath[] = [
  ["profile", "name"],
  ["profile", "age"],
  ["settings", "theme"],
  ["settings", "newsletter"],
];

export default function TestDirtyApiPage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "profile",
          isArray: false,
          childrenFields: [
            {
              key: "name",
              label: "姓名",
              control: "input",
              defaultValue: "Alice",
              validate: z.string().min(1, "请输入姓名"),
            },
            {
              key: "age",
              label: "年龄",
              control: "input",
              controlProps: { type: "number" },
              defaultValue: 20,
              validate: z
                .union([z.number(), z.string()])
                .transform((v) => (typeof v === "string" ? Number(v) : v))
                .pipe(z.number().min(0, "年龄不能小于0")),
            },
          ],
        },
        {
          key: "settings",
          isArray: false,
          childrenFields: [
            {
              key: "theme",
              label: "主题",
              control: "select",
              controlProps: {
                options: [
                  { label: "浅色", value: "light" },
                  { label: "深色", value: "dark" },
                ],
              },
              defaultValue: "light",
              validate: z.enum(["light", "dark"]),
            },
            {
              key: "newsletter",
              label: "订阅状态",
              control: "radio",
              controlProps: {
                options: [
                  { label: "开启", value: true },
                  { label: "关闭", value: false },
                ],
              },
              defaultValue: true,
              validate: z.boolean(),
            },
          ],
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));

  useEffect(() => {
    model.initial();
    console.log(model);
  }, [model]);

  const snapshot = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getSnapshot.bind(model),
    model.getSnapshot.bind(model),
  );

  const dirtyMap = useMemo(() => {
    return dirtyTargets.reduce<Record<string, boolean>>((acc, path) => {
      const node = model.findNodeByPath(path);
      acc[path.join(".")] = !!node?.cache.selfDirty;
      return acc;
    }, {});
  }, [model, snapshot]);

  return (
    <div className="p-6">
      <Card title="Dirty 系统测试页（setInitialValue / resetField）">
        <Generator
          model={model}
          displayFields={dirtyTargets}
          displayOption={{ showDebug: true }}
        />

        <Divider />

        <Space wrap>
          <Button
            onClick={() => {
              model.setValue(
                [],
                {
                  profile: { name: "Bob", age: 28 },
                  settings: { theme: "dark", newsletter: false },
                },
                { invokeEffect: true, invokeOnChange: true },
                true,
              );
            }}
          >
            1) 用户修改值（应变 dirty）
          </Button>

          <Button
            onClick={() => {
              model.setCurrentAsInitialValue([], true);
            }}
          >
            2) 设当前值为初始值
          </Button>

          <Button
            onClick={() => {
              model.setInitialValueByValue(
                [],
                {
                  profile: { name: "Preset", age: 30 },
                  settings: { theme: "light", newsletter: true },
                },
                true,
              );
            }}
          >
            3) 显式设置初始值
          </Button>

          <Button
            onClick={() => {
              model.resetField(undefined, true);
            }}
          >
            4) 重置全部字段
          </Button>

          <Button
            onClick={() => {
              model.resetField(["profile", "name"], true);
            }}
          >
            5) 仅重置 profile.name
          </Button>
        </Space>

        <Divider />

        <Alert
          type="info"
          message="Dirty 状态"
          description={
            <Space wrap>
              {Object.entries(dirtyMap).map(([path, dirty]) => (
                <Tag key={path} color={dirty ? "red" : "green"}>
                  {path}: {dirty ? "dirty" : "clean"}
                </Tag>
              ))}
            </Space>
          }
        />

        <Divider />

        <Alert
          type="warning"
          message="当前提交数据"
          description={
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(model.getJSONData(), null, 2)}
            </pre>
          }
        />
      </Card>
    </div>
  );
}
