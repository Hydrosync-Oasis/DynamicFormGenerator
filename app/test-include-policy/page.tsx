"use client";

import { Generator, useDynamicForm } from "@/utils/generator";
import { FormModel, FormSchema } from "@/utils/structures";
import { Button, Card, message, Space } from "antd";
import { useEffect, useRef } from "react";
import z from "zod";

const schema: FormSchema = {
  fields: [
    {
      key: "obj",
      isArray: false,
      includePolicy: "always",
      initialVisible: true,
      childrenFields: [
        {
          key: "test1",
          label: "测试字段1",
          control: "input",
          initialVisible: true,
          defaultValue: "3",
          validate: z.string().min(1, "最少1个字符"),
        },
        {
          key: "test2",
          label: "测试字段2",
          control: "input",
          initialVisible: true,
          defaultValue: "1",
          validate: z.string().min(1, "最少1个字符"),
        },
        {
          key: "test3",
          label: "测试字段3",
          control: "input",
          initialVisible: false,
          // includePolicy: "when-visible",
          validate: z.string().min(1, "最少1个字符"),
        },
      ],
    },
  ],
};

export default function Page() {
  const model = useRef(new FormModel(schema));
  useEffect(() => {
    model.current.initial();
  }, []);
  const form = useDynamicForm(model.current);

  return (
    <>
      <Card
        className="!mx-auto !mt-3 w-5/6"
        title="测试 setVisible 和 setIncludePolicy API"
        extra={
          <Space>
            <Button
              onClick={() => {
                console.log(model.current);
              }}
            >
              查看Model
            </Button>
            <Button
              onClick={async () => {
                try {
                  const data = await form.submit();
                  message.success("提交成功");
                  console.log("提交的数据:", data);
                } catch (e) {
                  console.error(e);
                  message.error("提交失败");
                }
              }}
              type="primary"
            >
              提交表单
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* 控制按钮区域 */}
          <Card title="setVisible 测试" size="small">
            <Space wrap>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], true, true);
                  message.info("已显示 test1");
                }}
              >
                显示 test1
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true);
                  message.info("已隐藏 test1");
                }}
              >
                隐藏 test1
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test2"], true, true);
                  message.info("已显示 test2");
                }}
              >
                显示 test2
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test2"], false, true);
                  message.info("已隐藏 test2");
                }}
              >
                隐藏 test2
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test3"], true, true);
                  message.info("已显示 test3");
                }}
              >
                显示 test3
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test3"], false, true);
                  message.info("已隐藏 test3");
                }}
              >
                隐藏 test3
              </Button>
            </Space>
          </Card>

          <Card title="setIncludePolicy 测试" size="small">
            <Space wrap>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(["obj", "test1"], "always");
                  message.info("test1 策略已设为 always");
                }}
              >
                test1 → always
              </Button>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(
                    ["obj", "test1"],
                    "when-visible"
                  );
                  message.info("test1 策略已设为 when-visible");
                }}
              >
                test1 → when-visible
              </Button>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(["obj", "test1"], "never");
                  message.info("test1 策略已设为 never");
                }}
              >
                test1 → never
              </Button>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(["obj", "test2"], "always");
                  message.info("test2 策略已设为 always");
                }}
              >
                test2 → always
              </Button>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(
                    ["obj", "test2"],
                    "when-visible"
                  );
                  message.info("test2 策略已设为 when-visible");
                }}
              >
                test2 → when-visible
              </Button>
              <Button
                onClick={() => {
                  model.current.setIncludePolicy(["obj", "test2"], "never");
                  message.info("test2 策略已设为 never");
                }}
              >
                test2 → never
              </Button>
            </Space>
          </Card>

          <Card title="组合测试" size="small">
            <Space wrap>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true);
                  model.current.setIncludePolicy(
                    ["obj", "test1"],
                    "when-visible"
                  );
                  message.info("test1: 隐藏 + when-visible (不应包含在提交中)");
                }}
                type="dashed"
              >
                test1: 隐藏 + when-visible
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true);
                  model.current.setIncludePolicy(["obj", "test1"], "always");
                  message.info("test1: 隐藏 + always (应包含在提交中)");
                }}
                type="dashed"
              >
                test1: 隐藏 + always
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], true, true);
                  model.current.setIncludePolicy(["obj", "test1"], "never");
                  message.info("test1: 显示 + never (不应包含在提交中)");
                }}
                type="dashed"
              >
                test1: 显示 + never
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], true);
                  model.current.setVisible(["obj", "test2"], true);
                  model.current.setVisible(["obj", "test3"], true, true);
                  model.current.setIncludePolicy(["obj", "test1"], "always");
                  model.current.setIncludePolicy(["obj", "test2"], "always");
                  model.current.setIncludePolicy(["obj", "test3"], "always");
                  message.info("重置: 全部显示 + always");
                }}
                type="primary"
              >
                重置全部
              </Button>
            </Space>
          </Card>

          {/* 表单渲染区域 */}
          <Card title="表单区域" size="small">
            <Generator
              model={model.current}
              displayFields={[[]]}
              displayOption={{ showDebug: true }}
            />
          </Card>
        </Space>
      </Card>
    </>
  );
}
