"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, Button, Card, Divider, Space, Tag, Typography } from "antd";
import { z } from "zod";
import { Generator } from "@/utils/generator";
import { FieldPath, FieldSchema, FormModel } from "@/utils/structures";

type CallbackLog = {
  ts: number;
  listener: "value" | "dirty";
  path: string;
  value: unknown;
};

const FORM_TITLE_PATH: FieldPath = ["formTitle"];
const TASKS_PATH: FieldPath = ["tasks"];
const TASK_A_TITLE_PATH: FieldPath = ["tasks", "taskA", "title"];
const TASK_A_NOTE_PATH: FieldPath = ["tasks", "taskA", "detail", "note"];

export default function OnValueChangeTestPage() {
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "formTitle",
          label: "表单标题",
          control: "input",
          defaultValue: "Sprint Plan",
          validate: z.string().min(1, "请输入标题"),
        },
        {
          key: "tasks",
          isArray: true,
          arraySchema: {
            isArray: false,
            childrenFields: [
              {
                key: "title",
                label: "任务标题",
                control: "input",
                validate: z.string().min(1, "请输入任务标题"),
              },
              {
                key: "status",
                label: "状态",
                control: "input",
                validate: z.string().min(1, "请输入状态"),
              },
              {
                key: "detail",
                isArray: false,
                childrenFields: [
                  {
                    key: "note",
                    label: "备注",
                    control: "input",
                    validate: z.string().min(1, "请输入备注"),
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
  const [logs, setLogs] = useState<CallbackLog[]>([]);
  const [subscribeResultType, setSubscribeResultType] = useState<string[]>([]);
  const [unsubscribeFn, setUnsubscribeFn] = useState<
    undefined | (() => void)
  >();

  const formData = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getJSONData.bind(model),
    model.getJSONData.bind(model),
  );

  useEffect(() => {
    model.initial();

    const logChange = (
      listener: "value" | "dirty",
      path: string,
      value: unknown,
    ) => {
      setLogs((prev) =>
        [{ ts: Date.now(), listener, path, value }, ...prev].slice(0, 40),
      );
    };

    const valueUnsubs = [
      model.onValueChange(FORM_TITLE_PATH, (value) => {
        logChange("value", "formTitle", value);
      }),
      model.onValueChange(TASKS_PATH, (value) => {
        logChange("value", "tasks", value);
      }),
      model.onValueChange(TASK_A_TITLE_PATH, (value) => {
        logChange("value", "tasks.taskA.title", value);
      }),
      model.onValueChange(TASK_A_NOTE_PATH, (value) => {
        logChange("value", "tasks.taskA.detail.note", value);
      }),
    ];

    const dirtyUnsubs = [
      model.onDirtyChange(FORM_TITLE_PATH, (dirty) => {
        logChange("dirty", "formTitle", dirty);
      }),
      model.onDirtyChange(TASKS_PATH, (dirty) => {
        logChange("dirty", "tasks", dirty);
      }),
      model.onDirtyChange(TASK_A_TITLE_PATH, (dirty) => {
        logChange("dirty", "tasks.taskA.title", dirty);
      }),
      model.onDirtyChange(TASK_A_NOTE_PATH, (dirty) => {
        logChange("dirty", "tasks.taskA.detail.note", dirty);
      }),
    ];

    setSubscribeResultType([
      ...valueUnsubs.map((x) => typeof x),
      ...dirtyUnsubs.map((x) => typeof x),
    ]);

    const mergedUnsub = () => {
      [...valueUnsubs, ...dirtyUnsubs].forEach((fn) => fn());
    };

    setUnsubscribeFn(() => mergedUnsub);

    console.log(model);

    return mergedUnsub;
  }, [model]);

  const callbackCount = logs.length;
  const lastLog = logs[0];
  const counterMap = logs.reduce<Record<string, number>>((acc, item) => {
    const key = `${item.listener}:${item.path}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const setFormTitleBySetValue = (value: string) => {
    model.setValue(
      [],
      { formTitle: value },
      { invokeEffect: true },
      "merge",
      true,
    );
  };

  const insertTaskA = () => {
    model.insertIntoArray(
      TASKS_PATH,
      {
        taskA: {
          title: "task-a-v1",
          status: "todo",
          detail: {
            note: "created-by-insert",
          },
        },
      },
      "after",
      undefined,
      true,
    );
  };

  const insertTaskBBeforeTaskA = () => {
    model.insertIntoArray(
      TASKS_PATH,
      {
        taskB: {
          title: "task-b-v1",
          status: "todo",
          detail: {
            note: "insert-before-taskA",
          },
        },
      },
      "before",
      "taskA",
      true,
    );
  };

  const updateTaskABySetItem = () => {
    const suffix = Date.now().toString().slice(-4);
    model.setItemOfArray(
      TASKS_PATH,
      "taskA",
      {
        title: `task-a-v${suffix}`,
        status: "doing",
        detail: {
          note: `updated-by-setItem-${suffix}`,
        },
      },
      true,
      true,
    );
  };

  const deleteTaskABySetItem = () => {
    model.setItemOfArray(TASKS_PATH, "taskA", undefined, true, true);
  };

  const runCoordinationFlow = () => {
    setLogs([]);
    model.resetField(undefined, true);
    model.insertIntoArray(
      TASKS_PATH,
      {
        taskA: {
          title: "task-a-seq",
          status: "todo",
          detail: {
            note: "seq-step-1",
          },
        },
      },
      "after",
      undefined,
      true,
    );
    model.setItemOfArray(
      TASKS_PATH,
      "taskA",
      {
        title: "task-a-seq-updated",
        status: "doing",
        detail: {
          note: "seq-step-2",
        },
      },
      true,
      true,
    );
    model.insertIntoArray(
      TASKS_PATH,
      {
        taskB: {
          title: "task-b-seq",
          status: "todo",
          detail: {
            note: "seq-step-3",
          },
        },
      },
      "before",
      "taskA",
      true,
    );
    model.setItemOfArray(TASKS_PATH, "taskA", undefined, true, true);
  };

  const tasksDirty = !!model.findNodeByPath(TASKS_PATH)?.cache.selfDirty;
  const taskATitleDirty =
    !!model.findNodeByPath(TASK_A_TITLE_PATH)?.cache.selfDirty;

  return (
    <div className="p-6">
      <Card title="表单生成器协同测试页：数组 API + onValueChange/onDirtyChange">
        <Space direction="vertical" size={12} className="w-full">
          <Alert
            type="info"
            showIcon
            message="测试目标"
            description="验证数组 API（insertIntoArray、setItemOfArray）执行时，onValueChange 与 onDirtyChange 是否能在数组节点和数组内叶子节点上协调触发。"
          />

          <Alert
            type="warning"
            showIcon
            message="推荐验证顺序"
            description="先点击“一键运行协调流程”，再用下方按钮单步复现。重点观察 tasks、tasks.taskA.title、tasks.taskA.detail.note 的 value/dirty 回调次数和最新值。"
          />

          <Space wrap>
            <Tag color="blue">
              注册返回值类型: {subscribeResultType.join(" / ") || "-"}
            </Tag>
            <Tag color={callbackCount > 0 ? "green" : "red"}>
              总回调次数: {callbackCount}
            </Tag>
            <Tag>value:formTitle = {counterMap["value:formTitle"] ?? 0}</Tag>
            <Tag>dirty:formTitle = {counterMap["dirty:formTitle"] ?? 0}</Tag>
            <Tag>value:tasks = {counterMap["value:tasks"] ?? 0}</Tag>
            <Tag>dirty:tasks = {counterMap["dirty:tasks"] ?? 0}</Tag>
            <Tag>
              value:tasks.taskA.title ={" "}
              {counterMap["value:tasks.taskA.title"] ?? 0}
            </Tag>
            <Tag>
              dirty:tasks.taskA.title ={" "}
              {counterMap["dirty:tasks.taskA.title"] ?? 0}
            </Tag>
            <Tag>
              value:tasks.taskA.detail.note ={" "}
              {counterMap["value:tasks.taskA.detail.note"] ?? 0}
            </Tag>
            <Tag>
              dirty:tasks.taskA.detail.note ={" "}
              {counterMap["dirty:tasks.taskA.detail.note"] ?? 0}
            </Tag>
            <Tag color={tasksDirty ? "red" : "green"}>
              cache.selfDirty(tasks): {tasksDirty ? "true" : "false"}
            </Tag>
            <Tag color={taskATitleDirty ? "red" : "green"}>
              cache.selfDirty(tasks.taskA.title):{" "}
              {taskATitleDirty ? "true" : "false"}
            </Tag>
            <Tag>最后一次监听类型: {lastLog?.listener ?? "-"}</Tag>
            <Tag>最后一次来源: {lastLog?.path ?? "-"}</Tag>
            <Tag>最后一次值: {JSON.stringify(lastLog?.value)}</Tag>
          </Space>

          <Space wrap>
            <Button onClick={runCoordinationFlow}>一键运行协调流程</Button>
            <Button onClick={() => setFormTitleBySetValue("Sprint Plan")}>
              setValue 标题=初始值
            </Button>
            <Button onClick={() => setFormTitleBySetValue("Sprint Plan 2")}>
              setValue 标题=变更值
            </Button>
            <Button onClick={insertTaskA}>insertIntoArray 新增 taskA</Button>
            <Button onClick={insertTaskBBeforeTaskA}>
              insertIntoArray 在 taskA 前插入 taskB
            </Button>
            <Button onClick={updateTaskABySetItem}>
              setItemOfArray 更新 taskA
            </Button>
            <Button onClick={deleteTaskABySetItem}>
              setItemOfArray 删除 taskA
            </Button>
            <Button onClick={() => model.resetField(undefined, true)}>
              resetField 全量重置
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
              取消全部订阅
            </Button>
          </Space>

          <Divider />

          <Generator
            model={model}
            displayFields={[FORM_TITLE_PATH, TASKS_PATH]}
            displayOption={{ showDebug: true }}
          />

          <Divider />

          <Typography.Text strong>当前提交数据</Typography.Text>
          <pre className="rounded bg-gray-100 p-3 text-xs leading-5">
            {JSON.stringify(formData, null, 2)}
          </pre>

          <Typography.Text strong>监听回调日志（最多 40 条）</Typography.Text>
          <pre className="rounded bg-gray-100 p-3 text-xs leading-5">
            {JSON.stringify(logs, null, 2)}
          </pre>
        </Space>
      </Card>
    </div>
  );
}
