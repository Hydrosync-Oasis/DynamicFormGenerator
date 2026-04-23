"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Divider, Space, Tag, Typography } from "antd";
import { z } from "zod";
import { Generator } from "@/utils/generator";
import { FieldPath, FieldSchema, FormModel } from "@/utils/structures";

type ListenerType = "value" | "dirty";
type ScenarioKey = "target" | "layer3" | "layer2";

type NotifyLog = {
  ts: number;
  listener: ListenerType;
  path: string;
  payload: unknown;
};

const ROOT_PATH: FieldPath = [];
const L1_PATH: FieldPath = ["layer1"];
const L2_PATH: FieldPath = ["layer1", "layer2"];
const L3_PATH: FieldPath = ["layer1", "layer2", "layer3"];
const TARGET_PATH: FieldPath = ["layer1", "layer2", "layer3", "target"];
const L2_SIBLING_PATH: FieldPath = ["layer1", "layer2", "l2Sibling"];
const L1_SIBLING_PATH: FieldPath = ["layer1", "l1Sibling"];
const PEER_PATH: FieldPath = ["peer"];

const watchedPaths: { path: FieldPath; label: string }[] = [
  { path: ROOT_PATH, label: "(root)" },
  { path: L1_PATH, label: "layer1" },
  { path: L2_PATH, label: "layer1.layer2" },
  { path: L3_PATH, label: "layer1.layer2.layer3" },
  { path: TARGET_PATH, label: "layer1.layer2.layer3.target" },
  { path: L2_SIBLING_PATH, label: "layer1.layer2.l2Sibling" },
  { path: L1_SIBLING_PATH, label: "layer1.l1Sibling" },
  { path: PEER_PATH, label: "peer" },
];

const pathToKey = (path: FieldPath) =>
  path.length === 0 ? "(root)" : path.join(".");

const getHasValue = (payload: unknown): boolean | null => {
  if (
    payload &&
    typeof payload === "object" &&
    "hasValue" in payload &&
    typeof (payload as { hasValue?: unknown }).hasValue === "boolean"
  ) {
    return (payload as { hasValue: boolean }).hasValue;
  }
  return null;
};

const getBooleanPayload = (payload: unknown): boolean | null => {
  return typeof payload === "boolean" ? payload : null;
};

export default function TestIncludePolicyPage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "layer1",
          isArray: false,
          childrenFields: [
            {
              key: "layer2",
              isArray: false,
              childrenFields: [
                {
                  key: "layer3",
                  isArray: false,
                  childrenFields: [
                    {
                      key: "target",
                      label: "四层目标字段",
                      control: "input",
                      defaultValue: "L4-Init",
                      validate: z.string().min(1, "target 不能为空"),
                    },
                  ],
                },
                {
                  key: "l2Sibling",
                  label: "二层同级字段",
                  control: "input",
                  defaultValue: "L2-Sibling",
                  validate: z.string().min(1),
                },
              ],
            },
            {
              key: "l1Sibling",
              label: "一层同级字段",
              control: "input",
              defaultValue: "L1-Sibling",
              validate: z.string().min(1),
            },
          ],
        },
        {
          key: "peer",
          label: "根层同级字段",
          control: "input",
          defaultValue: "Peer",
          validate: z.string().min(1),
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  const [model] = useState(() => new FormModel(schema));
  const [logs, setLogs] = useState<NotifyLog[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("target");

  useEffect(() => {
    model.initial();

    const unsubs: Array<() => void> = [];

    const appendLog = (
      listener: ListenerType,
      path: FieldPath,
      payload: unknown,
    ) => {
      setLogs((prev) =>
        [
          {
            ts: Date.now(),
            listener,
            path: pathToKey(path),
            payload,
          },
          ...prev,
        ].slice(0, 200),
      );
    };

    for (const item of watchedPaths) {
      unsubs.push(
        model.onValueChange(item.path, (value) => {
          appendLog("value", item.path, value);
        }),
      );

      unsubs.push(
        model.onDirtyChange(item.path, (dirty) => {
          appendLog("dirty", item.path, dirty);
        }),
      );
    }

    console.log(model);

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [model]);

  const flushIncludeNotifications = () => {
    // setInclude 内部会写入订阅队列，这里用一次“无变更 setValue”触发队列消费。
    model.setValue([], {}, { invokeEffect: false }, "merge", false);
  };

  const setNodeInclude = (path: FieldPath, include: boolean) => {
    model.setInclude(path, include);
    flushIncludeNotifications();
  };

  const runTargetScenario = () => {
    setActiveScenario("target");
    model.resetField(undefined, true);
    setLogs([]);

    setNodeInclude(TARGET_PATH, false);
    setNodeInclude(TARGET_PATH, true);
  };

  const runLayer3Scenario = () => {
    setActiveScenario("layer3");
    model.resetField(undefined, true);

    // 预置：先让 target=false，确保 layer3 可以单独切换 false/true。
    setNodeInclude(TARGET_PATH, false);
    setNodeInclude(L3_PATH, true);

    // 将当前状态作为初始基线，便于观察 layer3 切换带来的 dirty 通知。
    model.setCurrentAsInitialValue([], false);
    setLogs([]);

    setNodeInclude(L3_PATH, false);
    setNodeInclude(L3_PATH, true);
  };

  const runLayer2Scenario = () => {
    setActiveScenario("layer2");
    model.resetField(undefined, true);

    // 预置：先将 layer2 的子节点都置为 false，再测试 layer2 的 include 切换。
    setNodeInclude(TARGET_PATH, false);
    setNodeInclude(L2_SIBLING_PATH, false);
    setNodeInclude(L2_PATH, true);

    // 将当前状态作为初始基线，便于观察 layer2 切换带来的 dirty 通知。
    model.setCurrentAsInitialValue([], false);
    setLogs([]);

    setNodeInclude(L2_PATH, false);
    setNodeInclude(L2_PATH, true);
  };

  const counter = useMemo(() => {
    return logs.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.listener}:${item.path}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [logs]);

  const getCount = (listener: ListenerType, path: FieldPath) => {
    return counter[`${listener}:${pathToKey(path)}`] ?? 0;
  };

  const countExpectationsByScenario: Record<
    ScenarioKey,
    Array<{
      path: FieldPath;
      pathLabel: string;
      expectedValueCount?: number;
      expectedDirtyCount: number;
    }>
  > = {
    target: [
      {
        path: ROOT_PATH,
        pathLabel: "(root)",
        expectedValueCount: 2,
        expectedDirtyCount: 2,
      },
      {
        path: L1_PATH,
        pathLabel: "layer1",
        expectedValueCount: 2,
        expectedDirtyCount: 2,
      },
      {
        path: L2_PATH,
        pathLabel: "layer1.layer2",
        expectedValueCount: 2,
        expectedDirtyCount: 2,
      },
      {
        path: L3_PATH,
        pathLabel: "layer1.layer2.layer3",
        expectedValueCount: 2,
        expectedDirtyCount: 2,
      },
      {
        path: TARGET_PATH,
        pathLabel: "layer1.layer2.layer3.target",
        expectedValueCount: 2,
        expectedDirtyCount: 2,
      },
      {
        path: L2_SIBLING_PATH,
        pathLabel: "layer1.layer2.l2Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: L1_SIBLING_PATH,
        pathLabel: "layer1.l1Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: PEER_PATH,
        pathLabel: "peer",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
    ],
    layer3: [
      {
        path: ROOT_PATH,
        pathLabel: "(root)",
        expectedDirtyCount: 2,
      },
      {
        path: L1_PATH,
        pathLabel: "layer1",
        expectedDirtyCount: 2,
      },
      {
        path: L2_PATH,
        pathLabel: "layer1.layer2",
        expectedDirtyCount: 2,
      },
      {
        path: L3_PATH,
        pathLabel: "layer1.layer2.layer3",
        expectedDirtyCount: 2,
      },
      {
        path: TARGET_PATH,
        pathLabel: "layer1.layer2.layer3.target",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: L2_SIBLING_PATH,
        pathLabel: "layer1.layer2.l2Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: L1_SIBLING_PATH,
        pathLabel: "layer1.l1Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: PEER_PATH,
        pathLabel: "peer",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
    ],
    layer2: [
      {
        path: ROOT_PATH,
        pathLabel: "(root)",
        expectedDirtyCount: 2,
      },
      {
        path: L1_PATH,
        pathLabel: "layer1",
        expectedDirtyCount: 2,
      },
      {
        path: L2_PATH,
        pathLabel: "layer1.layer2",
        expectedDirtyCount: 2,
      },
      {
        path: L3_PATH,
        pathLabel: "layer1.layer2.layer3",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: TARGET_PATH,
        pathLabel: "layer1.layer2.layer3.target",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: L2_SIBLING_PATH,
        pathLabel: "layer1.layer2.l2Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: L1_SIBLING_PATH,
        pathLabel: "layer1.l1Sibling",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
      {
        path: PEER_PATH,
        pathLabel: "peer",
        expectedValueCount: 0,
        expectedDirtyCount: 0,
      },
    ],
  };

  const countExpectations = countExpectationsByScenario[activeScenario];

  const chronoLogs = useMemo(() => [...logs].reverse(), [logs]);

  const scenarioPath: FieldPath =
    activeScenario === "target"
      ? TARGET_PATH
      : activeScenario === "layer3"
        ? L3_PATH
        : L2_PATH;

  const targetValueSequence = chronoLogs
    .filter((x) => x.listener === "value" && x.path === pathToKey(TARGET_PATH))
    .map((x) => getHasValue(x.payload));

  const scenarioDirtySequence = chronoLogs
    .filter((x) => x.listener === "dirty" && x.path === pathToKey(scenarioPath))
    .map((x) => getBooleanPayload(x.payload));

  const valueSeqExpected = [false, true];
  const dirtySeqExpected = [true, false];

  const countCheckPassed = countExpectations.every((item) => {
    const actualValueCount = getCount("value", item.path);
    const actualDirtyCount = getCount("dirty", item.path);
    const valueMatched =
      item.expectedValueCount === undefined ||
      actualValueCount === item.expectedValueCount;
    return valueMatched && actualDirtyCount === item.expectedDirtyCount;
  });

  const valueSeqPassed =
    targetValueSequence.length === valueSeqExpected.length &&
    targetValueSequence.every((x, i) => x === valueSeqExpected[i]);

  const dirtySeqPassed =
    scenarioDirtySequence.length === dirtySeqExpected.length &&
    scenarioDirtySequence.every((x, i) => x === dirtySeqExpected[i]);

  const overallPassed =
    countCheckPassed &&
    dirtySeqPassed &&
    (activeScenario === "target" ? valueSeqPassed : true);

  const targetNode = model.findNodeByPath(TARGET_PATH);
  const l3Node = model.findNodeByPath(L3_PATH);
  const l2SiblingNode = model.findNodeByPath(L2_SIBLING_PATH);

  return (
    <div className="p-6">
      <Card title="Include 策略测试：四层树的通知联动">
        <Space direction="vertical" size={12} className="w-full">
          <Alert
            type="info"
            showIcon
            message="测试目标"
            description="分别在 target、layer3、layer2 这三个嵌套节点上切换 include，验证它们是否按预期触发其他字段的 dirty/value 通知。"
          />

          <Alert
            type="warning"
            showIcon
            message="推荐操作"
            description="先执行目标场景，再执行 layer3、layer2 场景。每个场景都验证：目标链路 dirty 是否 2 次（false 再 true），无关字段是否保持 0 次通知。"
          />

          <Space wrap>
            <Button type="primary" onClick={runTargetScenario}>
              一键执行用例（target include: true → false → true）
            </Button>
            <Button onClick={runLayer3Scenario}>
              一键执行用例（layer3 include: true → false → true）
            </Button>
            <Button onClick={runLayer2Scenario}>
              一键执行用例（layer2 include: true → false → true）
            </Button>
            <Button onClick={() => setNodeInclude(TARGET_PATH, false)}>
              单步：target include=false
            </Button>
            <Button onClick={() => setNodeInclude(TARGET_PATH, true)}>
              单步：target include=true
            </Button>
            <Button onClick={() => setNodeInclude(L3_PATH, false)}>
              单步：layer3 include=false
            </Button>
            <Button onClick={() => setNodeInclude(L3_PATH, true)}>
              单步：layer3 include=true
            </Button>
            <Button onClick={() => setNodeInclude(L2_PATH, false)}>
              单步：layer2 include=false
            </Button>
            <Button onClick={() => setNodeInclude(L2_PATH, true)}>
              单步：layer2 include=true
            </Button>
            <Button onClick={() => model.resetField(undefined, true)}>
              resetField 全量重置
            </Button>
            <Button onClick={() => setLogs([])}>清空日志</Button>
          </Space>

          <Space wrap>
            <Tag color={targetNode?.dynamicProp.include ? "blue" : "default"}>
              target include:{" "}
              {targetNode?.dynamicProp.include ? "true" : "false"}
            </Tag>
            <Tag color={l3Node?.dynamicProp.include ? "blue" : "default"}>
              layer3 include: {l3Node?.dynamicProp.include ? "true" : "false"}
            </Tag>
            <Tag
              color={l2SiblingNode?.dynamicProp.include ? "blue" : "default"}
            >
              l2Sibling include:{" "}
              {l2SiblingNode?.dynamicProp.include ? "true" : "false"}
            </Tag>
            <Tag color={overallPassed ? "green" : "red"}>
              用例判定: {overallPassed ? "PASS" : "CHECK"}
            </Tag>
            <Tag>当前场景: {activeScenario}</Tag>
            <Tag>日志总数: {logs.length}</Tag>
          </Space>

          <Divider />

          <Typography.Text strong>计数断言（期望 vs 实际）</Typography.Text>
          <Space wrap>
            {countExpectations.map((item) => {
              const actualValueCount = getCount("value", item.path);
              const actualDirtyCount = getCount("dirty", item.path);
              const pass =
                (item.expectedValueCount === undefined ||
                  actualValueCount === item.expectedValueCount) &&
                actualDirtyCount === item.expectedDirtyCount;
              return (
                <Tag key={item.pathLabel} color={pass ? "green" : "red"}>
                  {item.pathLabel} | value {actualValueCount}/
                  {item.expectedValueCount ?? "-"} | dirty {actualDirtyCount}/
                  {item.expectedDirtyCount}
                </Tag>
              );
            })}
          </Space>

          <Typography.Text strong>关键序列断言（按时间先后）</Typography.Text>
          <Space wrap>
            <Tag color={valueSeqPassed ? "green" : "red"}>
              target value.hasValue: {JSON.stringify(targetValueSequence)} /
              期望
              {JSON.stringify(valueSeqExpected)}
            </Tag>
            <Tag color={dirtySeqPassed ? "green" : "red"}>
              {pathToKey(scenarioPath)} dirty:{" "}
              {JSON.stringify(scenarioDirtySequence)}/ 期望
              {JSON.stringify(dirtySeqExpected)}
            </Tag>
          </Space>

          <Divider />

          <Generator
            model={model}
            displayFields={[
              TARGET_PATH,
              L2_SIBLING_PATH,
              L1_SIBLING_PATH,
              PEER_PATH,
            ]}
            displayOption={{ showDebug: true }}
          />

          <Divider />

          <Typography.Text strong>当前提交数据</Typography.Text>
          <pre className="rounded bg-gray-100 p-3 text-xs leading-5">
            {JSON.stringify(model.getJSONData(), null, 2)}
          </pre>

          <Typography.Text strong>通知日志（最新在前）</Typography.Text>
          <pre className="rounded bg-gray-100 p-3 text-xs leading-5">
            {JSON.stringify(
              logs.map((item) => ({
                at: new Date(item.ts).toLocaleTimeString(),
                listener: item.listener,
                path: item.path,
                payload: item.payload,
              })),
              null,
              2,
            )}
          </pre>
        </Space>
      </Card>
    </div>
  );
}
