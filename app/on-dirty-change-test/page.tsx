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

type DirtyLog = {
  ts: number;
  path: string;
  dirty: boolean;
};

const NAME_PATH: FieldPath = ["profile", "name"];
const PROFILE_PATH: FieldPath = ["profile"];

export default function OnDirtyChangeTestPage() {
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
              defaultValue: "18",
              validate: z.string().min(1, "请输入年龄"),
            },
          ],
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));
  const [logs, setLogs] = useState<DirtyLog[]>([]);

  const snapshot = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getSnapshot.bind(model),
    model.getSnapshot.bind(model),
  );

  useEffect(() => {
    model.initial();

    const onNameDirty = (dirty: boolean) => {
      setLogs((prev) =>
        [{ ts: Date.now(), path: "profile.name", dirty }, ...prev].slice(0, 20),
      );
    };

    const onProfileDirty = (dirty: boolean) => {
      setLogs((prev) =>
        [{ ts: Date.now(), path: "profile", dirty }, ...prev].slice(0, 20),
      );
    };

    const unsubName = model.onDirtyChange(NAME_PATH, onNameDirty);
    const unsubProfile = model.onDirtyChange(PROFILE_PATH, onProfileDirty);

    return () => {
      unsubName();
      unsubProfile();
    };
  }, [model]);

  const nameNodeDirty = !!model.findNodeByPath(NAME_PATH)?.cache.selfDirty;
  const profileNodeDirty =
    !!model.findNodeByPath(PROFILE_PATH)?.cache.selfDirty;

  const countByPath = logs.reduce<Record<string, number>>((acc, item) => {
    acc[item.path] = (acc[item.path] ?? 0) + 1;
    return acc;
  }, {});

  const setName = (name: string) => {
    model.setValue(
      [],
      {
        profile: {
          name,
        },
      },
      { invokeEffect: true },
      "merge",
      true,
    );
  };

  return (
    <div className="p-6">
      <Card title="onDirtyChange 函数测试页">
        <Alert
          type="info"
          showIcon
          message="测试目标"
          description="通过 onDirtyChange 监听 profile.name 与 profile 的 dirty 值，然后调用 setValue，验证 dirty 监听回调是否按预期触发。"
        />

        <Divider />

        <Generator
          model={model}
          displayFields={[NAME_PATH, ["profile", "age"]]}
          displayOption={{ showDebug: true }}
        />

        <Divider />

        <Space wrap>
          <Button onClick={() => setName("Bob")}>
            1) setValue name=Bob（应触发 dirty=true）
          </Button>
          <Button onClick={() => setName("Bob")}>
            2) 再次 setValue name=Bob（应不触发）
          </Button>
          <Button onClick={() => setName("Alice")}>
            3) setValue name=Alice（应触发 dirty=false）
          </Button>
          <Button onClick={() => model.resetField(undefined, true)}>
            4) resetField 全量重置
          </Button>
          <Button onClick={() => setLogs([])}>5) 清空日志</Button>
        </Space>

        <Divider />

        <Space wrap>
          <Tag color={nameNodeDirty ? "red" : "green"}>
            当前 cache.selfDirty（profile.name）:{" "}
            {nameNodeDirty ? "true" : "false"}
          </Tag>
          <Tag color={profileNodeDirty ? "red" : "green"}>
            当前 cache.selfDirty（profile）:{" "}
            {profileNodeDirty ? "true" : "false"}
          </Tag>
          <Tag>
            dirty 回调次数（profile.name）: {countByPath["profile.name"] ?? 0}
          </Tag>
          <Tag>dirty 回调次数（profile）: {countByPath["profile"] ?? 0}</Tag>
          <Tag>总回调次数: {logs.length}</Tag>
        </Space>

        <Divider />

        <Alert
          type="warning"
          message="dirty 回调日志（最新在前）"
          description={
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(
                logs.map((item) => ({
                  at: new Date(item.ts).toLocaleTimeString(),
                  path: item.path,
                  dirty: item.dirty,
                })),
                null,
                2,
              )}
            </pre>
          }
        />

        <Divider />

        <Alert
          type="success"
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
