"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Divider, Space, Tag, Typography } from "antd";
import { z } from "zod";
import { Generator } from "@/utils/generator";
import { FieldPath, FieldSchema, FormModel } from "@/utils/structures";

type ChangeLog = {
  ts: number;
  from: string;
  value: any;
};

const NAME_PATH: FieldPath = ["name"];
const USERS_PATH: FieldPath = ["users"];
const ARRAY_NICKNAME_PATH: FieldPath = ["users", "u1", "nickname"];
const ARRAY_DEEP_ALIAS_PATH: FieldPath = [
  "users",
  "u1",
  "profile",
  "contact",
  "alias",
];

export default function OnValueChangeTestPage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "name",
          label: "姓名",
          control: "input",
          defaultValue: "init",
          validate: z.string().min(1, "请输入姓名"),
        },
        {
          key: "users",
          isArray: true,
          arraySchema: {
            isArray: false,
            childrenFields: [
              {
                key: "nickname",
                label: "昵称",
                control: "input",
                validate: z.string().min(1, "请输入昵称"),
              },
              {
                key: "profile",
                isArray: false,
                childrenFields: [
                  {
                    key: "contact",
                    isArray: false,
                    childrenFields: [
                      {
                        key: "alias",
                        label: "深层别名",
                        control: "input",
                        validate: z.string().min(1, "请输入深层别名"),
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
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [subscribeResultType, setSubscribeResultType] = useState<string[]>([]);
  const [unsubscribeFn, setUnsubscribeFn] = useState<
    undefined | (() => void)
  >();

  useEffect(() => {
    model.initial();

    const logChange = (from: string, value: any) => {
      setLogs((prev) =>
        [{ ts: Date.now(), from, value }, ...prev].slice(0, 20),
      );
    };

    const unsubName = model.onValueChange(NAME_PATH, (value) => {
      logChange("name", value);
    });
    const unsubArrayNode = model.onValueChange(ARRAY_NICKNAME_PATH, (value) => {
      logChange("users.u1.nickname", value);
    });
    const unsubArrayDeepNode = model.onValueChange(
      ARRAY_DEEP_ALIAS_PATH,
      (value) => {
        logChange("users.u1.profile.contact.alias", value);
      },
    );

    setSubscribeResultType([
      typeof unsubName,
      typeof unsubArrayNode,
      typeof unsubArrayDeepNode,
    ]);

    const mergedUnsub = () => {
      unsubName();
      unsubArrayNode();
      unsubArrayDeepNode();
    };

    setUnsubscribeFn(() => mergedUnsub);
    console.log(model);

    return mergedUnsub;
  }, [model]);

  const callbackCount = logs.length;
  const lastLog = logs[0];
  const counterMap = logs.reduce<Record<string, number>>((acc, item) => {
    acc[item.from] = (acc[item.from] ?? 0) + 1;
    return acc;
  }, {});

  const triggerByApi = (value: string) => {
    model.setValue(
      [],
      { name: value },
      { invokeEffect: true },
      undefined,
      true,
    );
  };

  const triggerArrayCreateAndSetByApi = (nickname: string, alias: string) => {
    model.setValue(
      [],
      {
        users: {
          u1: {
            nickname,
            profile: {
              contact: {
                alias,
              },
            },
          },
        },
      },
      { invokeEffect: true },
      undefined,
      true,
    );
  };

  const triggerArrayNicknameSetByApi = (value: string) => {
    model.setValue(
      [],
      {
        users: {
          u1: {
            nickname: value,
          },
        },
      },
      { invokeEffect: true },
      undefined,
      true,
    );
  };

  const triggerArrayDeepSetByItemPath = (value: string) => {
    model.setValue(
      ["users", "u1"],
      {
        profile: {
          contact: {
            alias: value,
          },
        },
      },
      { invokeEffect: true },
      undefined,
      true,
    );
  };

  const triggerArrayDeepSetByLeafParentPath = (value: string) => {
    model.setValue(
      ["users", "u1", "profile", "contact"],
      {
        alias: value,
      },
      { invokeEffect: true },
      undefined,
      true,
    );
  };

  const triggerArraySetEmptyByApi = () => {
    model.setValue(
      [],
      {
        users: [],
      },
      { invokeEffect: true },
      "replace",
      true,
    );
  };

  return (
    <div className="p-6">
      <Card title="onValueChange 函数测试页">
        <Space direction="vertical" size={12} className="w-full">
          <Alert
            type="info"
            showIcon
            message="测试说明"
            description="页面初始化时会订阅 name、users.u1.nickname 和 users.u1.profile.contact.alias。先点击“创建数组项并设置深层字段”，再点击两个 alias 更新按钮和“设置 users 为空数组”，确认数组深层字段在创建、更新和清空时都能正常触发订阅通知。"
          />

          <Space wrap>
            <Tag color="blue">
              注册返回值类型: {subscribeResultType.join(" / ") || "-"}
            </Tag>
            <Tag color={callbackCount > 0 ? "green" : "red"}>
              总回调次数: {callbackCount}
            </Tag>
            <Tag>name: {counterMap["name"] ?? 0}</Tag>
            <Tag>users.u1.nickname: {counterMap["users.u1.nickname"] ?? 0}</Tag>
            <Tag>
              users.u1.profile.contact.alias:{" "}
              {counterMap["users.u1.profile.contact.alias"] ?? 0}
            </Tag>
            <Tag>最后一次来源: {lastLog?.from ?? "-"}</Tag>
            <Tag>最后一次值: {JSON.stringify(lastLog?.value)}</Tag>
          </Space>

          <Space wrap>
            <Button onClick={() => triggerByApi("Alice")}>
              API 设置 name=Alice
            </Button>
            <Button onClick={() => triggerByApi("Bob")}>
              API 设置 name=Bob
            </Button>
            <Button
              onClick={() =>
                triggerArrayCreateAndSetByApi("Tom", "tom-contact")
              }
            >
              创建数组项并设置深层字段
            </Button>
            <Button onClick={() => triggerArrayNicknameSetByApi("Jerry")}>
              更新数组项 nickname=Jerry
            </Button>
            <Button onClick={() => triggerArrayDeepSetByItemPath("spike-item")}>
              通过数组项路径设置 alias
            </Button>
            <Button
              onClick={() => triggerArrayDeepSetByLeafParentPath("spike-leaf")}
            >
              通过深层父路径设置 alias
            </Button>
            <Button onClick={triggerArraySetEmptyByApi}>
              设置 users 为空数组
            </Button>
            <Button onClick={() => setLogs([])}>清空日志</Button>
            <Button
              danger
              onClick={() => {
                if (unsubscribeFn) {
                  unsubscribeFn();
                }
              }}
            >
              尝试取消订阅
            </Button>
          </Space>

          <Divider />

          <Generator model={model} displayFields={[NAME_PATH, USERS_PATH]} />

          <Divider />

          <Typography.Text strong>最近回调日志（最多 20 条）</Typography.Text>
          <pre className="rounded bg-gray-100 p-3 text-xs leading-5">
            {JSON.stringify(logs, null, 2)}
          </pre>
        </Space>
      </Card>
    </div>
  );
}
