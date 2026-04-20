"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, Button, Card, Divider, Space, Tag } from "antd";
import { Generator } from "@/utils/generator";
import { FieldPath, FieldSchema, FormModel } from "@/utils/structures";

type EffectLog = {
  ts: number;
  effect: "effect-1" | "effect-2";
  reason: string;
  from: number;
  to: number;
};

const FIRST_PATH: FieldPath = ["first"];
const SECOND_PATH: FieldPath = ["second"];
const THIRD_PATH: FieldPath = ["third"];

function toSafeNumber(input: unknown): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : 0;
}

export default function MultiEffectTestPage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "first",
          label: "字段1",
          control: "input",
          controlProps: { type: "number" },
          defaultValue: 1,
        },
        {
          key: "second",
          label: "字段2（应为 字段1 + 1）",
          control: "input",
          controlProps: { type: "number" },
          defaultValue: 2,
        },
        {
          key: "third",
          label: "字段3（应为 字段2 + 1）",
          control: "input",
          controlProps: { type: "number" },
          defaultValue: 3,
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));
  const [logs, setLogs] = useState<EffectLog[]>([]);

  const currentData = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getJSONData.bind(model),
    model.getJSONData.bind(model),
  );

  useEffect(() => {
    const unsubEffect1 = model.effect((value, commands, reason) => {
      const first = toSafeNumber(value.first());
      if (reason === "dependencies-collecting") {
        return;
      }

      const nextSecond = first + 1;
      setLogs((prev) =>
        [
          {
            ts: Date.now(),
            effect: "effect-1",
            reason,
            from: first,
            to: nextSecond,
          },
          ...prev,
        ].slice(0, 30),
      );

      commands.setValue(
        ["second"],
        nextSecond,
        { invokeEffect: true },
        "merge",
      );
    });

    const unsubEffect2 = model.effect((value, commands, reason) => {
      const second = toSafeNumber(value.second());
      if (reason === "dependencies-collecting") {
        return;
      }

      const nextThird = second + 1;
      setLogs((prev) =>
        [
          {
            ts: Date.now(),
            effect: "effect-2",
            reason,
            from: second,
            to: nextThird,
          },
          ...prev,
        ].slice(0, 30),
      );

      commands.setValue(["third"], nextThird, { invokeEffect: true }, "merge");
    });

    model.initial();

    return () => {
      unsubEffect1();
      unsubEffect2();
    };
  }, [model]);

  const setFirst = (value: number) => {
    model.setValue([], { first: value }, { invokeEffect: true }, "merge", true);
  };

  return (
    <div className="p-6">
      <Card title="多 Effect 联动测试页">
        <Space direction="vertical" size={12} className="w-full">
          <Alert
            type="info"
            showIcon
            message="测试目标"
            description="设置字段1后，effect-1 会把字段2设置为字段1+1；随后 effect-2 会把字段3设置为字段2+1。"
          />

          <Generator
            model={model}
            displayFields={[FIRST_PATH, SECOND_PATH, THIRD_PATH]}
            displayOption={{ showDebug: true }}
          />

          <Divider />

          <Space wrap>
            <Button onClick={() => setFirst(5)}>set 字段1 = 5</Button>
            <Button onClick={() => setFirst(10)}>set 字段1 = 10</Button>
            <Button onClick={() => setFirst(Math.floor(Math.random() * 20))}>
              set 字段1 = 随机数
            </Button>
            <Button onClick={() => model.resetField(undefined, true)}>
              resetField
            </Button>
            <Button onClick={() => setLogs([])}>清空 effect 日志</Button>
          </Space>

          <Space wrap>
            <Tag>effect 日志条数: {logs.length}</Tag>
            <Tag>当前 first: {String((currentData as any)?.first ?? "-")}</Tag>
            <Tag>
              当前 second: {String((currentData as any)?.second ?? "-")}
            </Tag>
            <Tag>当前 third: {String((currentData as any)?.third ?? "-")}</Tag>
          </Space>

          <Alert
            type="warning"
            message="effect 执行日志（最新在前）"
            description={
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(
                  logs.map((item) => ({
                    at: new Date(item.ts).toLocaleTimeString(),
                    effect: item.effect,
                    reason: item.reason,
                    from: item.from,
                    to: item.to,
                  })),
                  null,
                  2,
                )}
              </pre>
            }
          />

          <Alert
            type="success"
            message="当前表单值"
            description={
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(currentData, null, 2)}
              </pre>
            }
          />
        </Space>
      </Card>
    </div>
  );
}
