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
      initialVisible: true,
      removeWhenNoChildren: true,
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
          initialVisible: true,
          defaultValue: "test3_value",
          validate: z.string().min(1, "最少1个字符"),
        },
        {
          key: "nested",
          isArray: false,
          initialVisible: true,
          removeWhenNoChildren: false,
          childrenFields: [
            {
              key: "nested1",
              label: "嵌套字段1 (nested: removeWhenNoChildren=false)",
              control: "input",
              initialVisible: true,
              defaultValue: "nested1_value",
              validate: z.string().min(1, "最少1个字符"),
            },
            {
              key: "nested2",
              label: "嵌套字段2 (nested: removeWhenNoChildren=false)",
              control: "input",
              initialVisible: true,
              defaultValue: "nested2_value",
              validate: z.string().min(1, "最少1个字符"),
            },
            {
              key: "deepNested",
              isArray: false,
              initialVisible: true,
              removeWhenNoChildren: true,
              childrenFields: [
                {
                  key: "deep1",
                  label: "深层字段1 (deepNested: removeWhenNoChildren=true)",
                  control: "input",
                  initialVisible: true,
                  defaultValue: "deep1_value",
                  validate: z.string().min(1, "最少1个字符"),
                },
                {
                  key: "deep2",
                  label: "深层字段2 (deepNested: removeWhenNoChildren=true)",
                  control: "input",
                  initialVisible: true,
                  defaultValue: "deep2_value",
                  validate: z.string().min(1, "最少1个字符"),
                },
              ],
            },
          ],
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
        title="测试 setVisible 和 setInclude API (更新版本)"
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
                  model.current.setVisible(["obj", "test1"], true, true, true);
                  message.info("已显示 test1");
                }}
              >
                显示 test1
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true, true);
                  message.info("已隐藏 test1");
                }}
              >
                隐藏 test1
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test2"], true, true, true);
                  message.info("已显示 test2");
                }}
              >
                显示 test2
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test2"], false, true, true);
                  message.info("已隐藏 test2");
                }}
              >
                隐藏 test2
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test3"], true, true, true);
                  message.info("已显示 test3");
                }}
              >
                显示 test3
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test3"], false, true, true);
                  message.info("已隐藏 test3");
                }}
              >
                隐藏 test3
              </Button>
            </Space>
          </Card>

          <Card title="setInclude 测试" size="small">
            <Space wrap>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test1"], true);
                  message.info("test1 设为 include=true");
                }}
              >
                test1 → include (true)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test1"], false);
                  message.info("test1 设为 include=false");
                }}
              >
                test1 → exclude (false)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test2"], true);
                  message.info("test2 设为 include=true");
                }}
              >
                test2 → include (true)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test2"], false);
                  message.info("test2 设为 include=false");
                }}
              >
                test2 → exclude (false)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test3"], true);
                  message.info("test3 设为 include=true");
                }}
              >
                test3 → include (true)
              </Button>
              <Button
                onClick={() => {
                  model.current.setInclude(["obj", "test3"], false);
                  message.info("test3 设为 include=false");
                }}
              >
                test3 → exclude (false)
              </Button>
            </Space>
          </Card>

          <Card title="组合测试 (include + visible)" size="small">
            <Space wrap>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true);
                  model.current.setInclude(["obj", "test1"], true);
                  message.info("test1: 隐藏 + include=true (应包含在提交中)");
                }}
                type="dashed"
              >
                test1: 隐藏 + include
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], false, true);
                  model.current.setInclude(["obj", "test1"], false);
                  message.info("test1: 隐藏 + include=false (不应包含)");
                }}
                type="dashed"
              >
                test1: 隐藏 + exclude
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], true, true);
                  model.current.setInclude(["obj", "test1"], false);
                  message.info("test1: 显示 + include=false (不应包含)");
                }}
                type="dashed"
              >
                test1: 显示 + exclude
              </Button>
              <Button
                onClick={() => {
                  model.current.setVisible(["obj", "test1"], true);
                  model.current.setVisible(["obj", "test2"], true);
                  model.current.setVisible(["obj", "test3"], true, true);
                  model.current.setInclude(["obj", "test1"], true);
                  model.current.setInclude(["obj", "test2"], true);
                  model.current.setInclude(["obj", "test3"], true);
                  message.info("重置: 全部显示 + include=true");
                }}
                type="primary"
              >
                重置全部
              </Button>
            </Space>
          </Card>

          <Card title="removeWhenNoChildren 基础测试" size="small" type="inner">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ color: "#666", fontSize: "12px" }}>
                obj节点配置了 removeWhenNoChildren=true，
                当所有子节点都被exclude时，obj也会被自动exclude
              </div>
              <Space wrap>
                <Button
                  onClick={() => {
                    model.current.setInclude(["obj", "test1"], false);
                    model.current.setInclude(["obj", "test2"], false);
                    model.current.setInclude(["obj", "test3"], false);
                    model.current.setInclude(["obj", "nested"], false);
                    message.warning(
                      "所有子节点已exclude，检查提交数据应该没有obj字段",
                    );
                  }}
                  danger
                >
                  Exclude 所有子节点
                </Button>
                <Button
                  onClick={() => {
                    model.current.setInclude(["obj", "test1"], false);
                    model.current.setInclude(["obj", "test2"], false);
                    model.current.setInclude(["obj", "test3"], true);
                    message.info("仅保留 test3，提交数据应包含 obj.test3");
                  }}
                >
                  只保留 test3
                </Button>
                <Button
                  onClick={() => {
                    model.current.setInclude(["obj", "test3"], true);
                    message.info("恢复 test3 为 include，obj应被自动恢复");
                  }}
                  type="primary"
                >
                  恢复任意子节点 (test3)
                </Button>
              </Space>
            </Space>
          </Card>

          <Card title="removeWhenNoChildren 混合测试" size="small" type="inner">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{ color: "#666", fontSize: "12px", marginBottom: "8px" }}
              >
                测试混合配置: obj (removeWhenNoChildren=<strong>true</strong>) →
                nested (removeWhenNoChildren=<strong>false</strong>) →
                deepNested (removeWhenNoChildren=<strong>true</strong>)
              </div>
              <Space wrap>
                <Button
                  onClick={() => {
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep2"],
                      false,
                    );
                    message.warning(
                      "Exclude deepNested所有子节点，deepNested应被自动exclude (removeWhenNoChildren=true)",
                    );
                  }}
                  danger
                >
                  Exclude deepNested所有子节点
                </Button>
                <Button
                  onClick={() => {
                    model.current.setInclude(
                      ["obj", "nested", "nested1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "nested2"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep2"],
                      false,
                    );
                    message.warning(
                      "Exclude nested所有子节点，nested不应被自动exclude (removeWhenNoChildren=false)",
                    );
                  }}
                  danger
                >
                  Exclude nested所有子节点 (测试false)
                </Button>
                <Button
                  onClick={() => {
                    model.current.setInclude(["obj", "test1"], false);
                    model.current.setInclude(["obj", "test2"], false);
                    model.current.setInclude(["obj", "test3"], false);
                    model.current.setInclude(
                      ["obj", "nested", "nested1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "nested2"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep2"],
                      false,
                    );
                    message.error(
                      "Exclude所有节点，deepNested自动exclude，但nested不会(false)，obj也不会被exclude",
                    );
                  }}
                  danger
                  type="primary"
                >
                  级联测试 (混合配置)
                </Button>
              </Space>
              <Space wrap style={{ marginTop: "8px" }}>
                <Button
                  onClick={() => {
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      true,
                    );
                    message.success(
                      "恢复deep1，应该级联恢复 deepNested→nested→obj",
                    );
                  }}
                  type="primary"
                >
                  恢复deep1 (测试级联恢复)
                </Button>
                <Button
                  onClick={() => {
                    model.current.setInclude(["obj", "test1"], false);
                    model.current.setInclude(["obj", "test2"], false);
                    model.current.setInclude(["obj", "test3"], false);
                    model.current.setInclude(
                      ["obj", "nested", "nested1"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "nested2"],
                      false,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      true,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep2"],
                      false,
                    );
                    message.info(
                      "只保留deep1，应有obj.nested.deepNested.deep1",
                    );
                  }}
                >
                  只保留deep1 (其他全exclude)
                </Button>
                <Button
                  onClick={() => {
                    // model.current.resetFields(undefined, true);
                    model.current.setInclude(["obj", "test1"], true);
                    model.current.setInclude(["obj", "test2"], true);
                    model.current.setInclude(["obj", "test3"], true);
                    model.current.setInclude(
                      ["obj", "nested", "nested1"],
                      true,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "nested2"],
                      true,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep1"],
                      true,
                    );
                    model.current.setInclude(
                      ["obj", "nested", "deepNested", "deep2"],
                      true,
                    );
                    message.success("所有字段已恢复");
                  }}
                  type="default"
                >
                  全部恢复
                </Button>
              </Space>
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
