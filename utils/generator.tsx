import {
  ConfigProvider,
  Divider,
  Alert,
  Card,
  Col,
  Radio,
  Row,
  Space,
  Input,
  Select,
  Tooltip,
  Flex,
} from "antd";
import React, { useState, useEffect, ComponentType } from "react";
import { FieldPath, FieldSchema, FieldValue, FormModel } from "./structures";
import { ZodType } from "zod";
import { InfoCircleOutlined } from "@ant-design/icons";

/** 将内部对象 + 布局（二维数组）渲染为多步骤表单 */
interface GeneratorProps {
  model: FormModel;
  displayFields: FieldPath[];
  showDebug?: boolean;
  size?: "small" | "normal";
}

/** 自定义表单生成器的hook */
interface DynamicFormHook {
  submit: () => Promise<any>;
  getFieldValue: (path: FieldPath) => any;
  setFieldValue: (path: FieldPath, value: FieldValue) => void;
  setFieldsValue: (value: any) => void;
  validateField: (path: FieldPath) => Promise<any>;
  validateFields: (paths: FieldPath[]) => Promise<any>;
  validateAllFields: (enhancer?: (schema: ZodType) => ZodType) => Promise<any>;
}

const useDynamicForm2 = (model: FormModel) => {
  const hook: DynamicFormHook = {
    validateAllFields: (enhancer?: (schema: ZodType) => ZodType) => {
      return model.validateAllFields(enhancer);
    },
    validateField: (path: FieldPath) => {
      return model.validateField(path);
    },
    submit: async () => {
      await model.validateAllFields();
      return model.getJSONData(true);
    },
    getFieldValue: (path: FieldPath) => {
      return model.get(path, "value");
    },
    setFieldValue: (path: FieldPath, value: FieldValue) => {
      model.set(path, "value", value);
    },
    setFieldsValue: (values: any) => {
      // 递归设置多个字段的值
      const setNestedValues = (
        obj: Record<string, any>,
        currentPath: FieldPath = []
      ) => {
        Object.entries(obj).forEach(([key, value]) => {
          const path = [...currentPath, key];
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            setNestedValues(value, path);
          } else {
            try {
              model.set(path, "value", value);
            } catch {
              // 说明有多余字段
            }
          }
        });
      };
      setNestedValues(values);
    },
    /**
     * 校验指定字段，无论是否显示都校验，使用多步骤动态表单优先使用这个函数
     * @param paths 要校验的字段路径数组
     */
    validateFields: (paths: FieldPath[]) => {
      return model.validateFieldsWithEnhancer(
        paths.filter((path) => model.get(path, "visible"))
      );
    },
  };

  return hook;
};

const Generator: React.FC<GeneratorProps> = ({
  model,
  displayFields,
  showDebug,
  size,
}) => {
  // 响应式更新
  const [, force] = useState({});
  useEffect(() => {
    return model.subscribe(() => {
      force({});
    });
  }, [model]);

  // 递归渲染字段
  const renderField = (path: FieldPath): React.ReactNode => {
    const node = model.findNodeByPath(path);
    if (!node) return null;
    console.log(node);

    // 如果有子节点，那么当前节点并无内容，仅渲染子节点
    if (!node.schemaData) {
      // schemaData只有叶子结点有
      if (node.children.length > 0) {
        return (
          <React.Fragment key={path.join(".")}>
            {node.children.map((child) => renderField([...path, child.key]))}
          </React.Fragment>
        );
      } else {
        return <React.Fragment key={path.join(".")}></React.Fragment>;
      }
    }

    // 叶子节点才渲染UI
    if (!node.state) return null;

    const visible = node.state.visible;
    if (!visible) return null;

    const { label, control, options, itemProps } = node.schemaData!;

    const zodSchema = node.state?.validation;
    const isRequired = zodSchema ? !zodSchema.isOptional() : false;

    let CustomComponent:
      | ComponentType<
          {
            value?: FieldValue;
            onChange?: (value: FieldValue) => void;
            options?: FieldSchema["options"];
          } & Record<string, any>
        >
      | undefined = undefined;

    if (typeof control !== "string") {
      CustomComponent = control;
    }
    if (!node.state) {
      throw new Error("non-leaf node");
    }

    // 处理字段值变化的回调
    const handleChange = (value: FieldValue) => {
      model.updateValue(path, value, true);
      // 可选：实时验证
      model.validateField(path).catch(() => {
        // 验证失败时错误信息已经通过 validateField 内部逻辑设置到 errorMessage
      });
    };

    return (
      <React.Fragment key={path.join("/")}>
        {/* 自定义表单项布局 */}
        <Row>
          <Col span={24}>
            <Row>
              <Col offset={4} span={20}>
                {/* Alert提示框 */}
                {node.state.alertTip && (
                  <ConfigProvider
                    theme={{
                      token: {
                        fontSize: 12,
                      },
                      components: {
                        Alert: {
                          defaultPadding: "3px 6px",
                        },
                      },
                    }}
                  >
                    <Alert message={node.state.alertTip} type="warning" />
                  </ConfigProvider>
                )}
              </Col>
            </Row>
            <Row align="middle">
              <Col
                span={4}
                style={{
                  textAlign: "right",
                  paddingRight: "8px",
                  lineHeight: "32px",
                }}
              >
                <label
                  htmlFor={path.join("/")}
                  style={{
                    display: "flex",
                    flexDirection: "row-reverse",
                    gap: "4px",
                    color: "#000000",
                  }}
                >
                  <span>:</span>
                  <>
                    {node.schemaData?.helpTip && (
                      <>
                        <Tooltip title={node.schemaData.helpTip}>
                          <InfoCircleOutlined
                            twoToneColor="#8C8C8C"
                            style={{ opacity: 0.48 }}
                          />
                        </Tooltip>
                      </>
                    )}
                  </>
                  <span>{label}</span>
                  <span>
                    {isRequired && (
                      <span style={{ color: "#ff4d4f", marginRight: 4 }}>
                        *
                      </span>
                    )}
                  </span>
                </label>
              </Col>
              <Col span={20}>
                {/* 三选一逻辑：自定义组件 > 控件类型(input/radio) */}
                <div>
                  {CustomComponent ? (
                    <CustomComponent
                      value={node.state.value}
                      onChange={handleChange}
                      options={node.state.options || options}
                      status={node.state.errorMessage ? "error" : undefined}
                      disabled={node.state.disabled}
                      {...itemProps}
                      id={path.join("/")}
                    />
                  ) : control === "input" ? (
                    <Input
                      {...itemProps}
                      value={node.state.value}
                      onChange={(e) => handleChange(e.target.value)}
                      status={node.state.errorMessage ? "error" : undefined}
                      disabled={node.state.disabled}
                      id={path.join("/")}
                    />
                  ) : control === "radio" ? (
                    <Radio.Group
                      value={node.state.value}
                      options={node.state.options || options}
                      onChange={(e) => handleChange(e.target.value)}
                      disabled={node.state.disabled}
                      id={path.join("/")}
                    />
                  ) : control === "select" ? (
                    <Select
                      style={{ width: "100%" }}
                      value={node.state.value}
                      options={node.state.options || options}
                      onChange={(value) => handleChange(value)}
                      placeholder="请选择"
                      status={node.state.errorMessage ? "error" : undefined}
                      disabled={node.state.disabled}
                      id={path.join("/")}
                      {...itemProps}
                    />
                  ) : null}
                </div>
                {node.state.errorMessage && (
                  <div style={{ color: "#ff4d4f", fontSize: "13px" }}>
                    {node.state.errorMessage}
                  </div>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
      </React.Fragment>
    );
  };

  return (
    <>
      <ConfigProvider
        theme={{
          components: {
            Alert: {
              defaultPadding: "2px 7px",
            },
          },
          token: { borderRadiusLG: 3, borderRadius: 2 },
        }}
      >
        <div>
          <Flex gap={24} vertical={true} style={{ width: "100%" }}>
            {displayFields.map((path) =>
              renderField(Array.isArray(path) ? path : [path])
            )}
          </Flex>

          <Divider />
        </div>
      </ConfigProvider>
      {showDebug && (
        <Alert
          type="info"
          message="调试：内部对象快照"
          description={
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(model.getJSONData(true), null, 2)}
            </pre>
          }
        />
      )}
    </>
  );
};

export { useDynamicForm2 as useDynamicForm, Generator };

export type { GeneratorProps };
