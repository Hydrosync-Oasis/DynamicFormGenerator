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
import React, {
  useState,
  useEffect,
  ComponentType,
  useSyncExternalStore,
  useMemo,
} from "react";
import { FieldPath, FieldSchema, FieldValue, FormModel } from "./structures";
import { ZodType } from "zod";
import { InfoCircleOutlined } from "@ant-design/icons";
import { ImmutableFormState } from "./type";

/** 将内部对象 + 布局（二维数组）渲染为多步骤表单 */

/** 自定义表单生成器的hook */
interface DynamicFormHook {
  submit: () => Promise<any>;
  getFieldValue: (path: FieldPath) => any;
  setFieldValue: (path: FieldPath, value: FieldValue) => void;
  setFieldsValue: (value: any) => void;
  validateField: (path: FieldPath) => Promise<any>;
  validateFields: (paths: FieldPath[]) => Promise<any>;
  validateAllFields: () => Promise<any>;
}

const useDynamicForm = (model: FormModel) => {
  return useMemo(() => {
    const hook: DynamicFormHook = {
      validateAllFields: () => {
        return model.validateAllFields();
      },
      validateField: (path: FieldPath) => {
        return model.validateField(path);
      },
      submit: async () => {
        await model.validateAllFields();
        return model.getJSONData();
      },
      getFieldValue: (path: FieldPath) => {
        return model.get(path, "value");
      },
      setFieldValue: (path: FieldPath, value: FieldValue) => {
        model.setValue(path, value);
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
                model.setValue(path, value);
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
  }, []);
};

const Generator = ({
  model,
  displayFields,
  size,
  displayOption,
  inlineMaxPerRow = 3,
}: {
  model: FormModel;
  displayFields: FieldPath[];
  size?: "normal" | "small";
  displayOption?: {
    labelSpan?: number;
    fieldSpan?: number;
    showDebug?: boolean;
    showInline?: boolean;
  };
  inlineMaxPerRow?: number;
}) => {
  const isSmall = size === "small";
  const labelSpan = displayOption?.labelSpan ?? 4;
  const fieldSpan = displayOption?.fieldSpan ?? 20;
  const showInline = displayOption?.showInline ?? false;
  const showDebug = displayOption?.showDebug ?? false;

  // 获取不可变快照，利用useSES更新
  const state = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getSnapshot.bind(model),
    model.getSnapshot.bind(model)
  );

  // 根据路径从 state 中查找节点
  const findNodeByPath = (
    node: ImmutableFormState,
    path: FieldPath
  ): ImmutableFormState | null => {
    if (path.length === 0) {
      return node;
    }

    if (node.type === "field") {
      return null;
    }

    const [first, ...rest] = path;
    const child = node.children.find((c) => c.key === first);

    if (!child) {
      return null;
    }

    if (rest.length === 0) {
      return child;
    }

    return findNodeByPath(child, rest);
  };

  // 递归渲染字段
  const renderField = (
    state: ImmutableFormState,
    statePath: FieldPath
  ): React.ReactNode => {
    const path = statePath;

    // 如果有子节点，那么当前节点并无内容，仅渲染子节点
    if (state.type !== "field") {
      if (state.children.length > 0) {
        return (
          <React.Fragment key={path.join(".")}>
            {state.children.map((child) =>
              renderField(child, path.concat(child.key.toString()))
            )}
          </React.Fragment>
        );
      } else {
        return null;
      }
    }

    const visible = state.prop.visible;
    if (!visible) return null;

    const { label, control, options, controlProps: itemProps } = state.prop!;

    const isRequired = state.prop.required;

    let CustomComponent:
      | ComponentType<
          {
            value?: FieldValue;
            onChange?: (value: FieldValue) => void;
            options?: Array<{
              label: string;
              value: string | number | boolean;
            }>;
          } & Record<string, any>
        >
      | undefined = undefined;

    if (typeof control !== "string") {
      CustomComponent = control;
    }
    if (state.type !== "field") {
      throw new Error("non-leaf node");
    }

    // 处理字段值变化的回调
    const handleChange = (value: FieldValue) => {
      model.setValue(path, value, { invokeOnChange: true });
      // 可选：实时验证
      model.validateField(path, true).catch(() => {
        // 验证失败时错误信息已经通过 validateField 内部逻辑设置到 errorMessage
      });
    };

    return (
      <React.Fragment key={path.join("/")}>
        {/* 自定义表单项布局 */}
        <Row>
          <Col span={24}>
            <Row style={{ marginBottom: 5 }}>
              <Col offset={labelSpan} span={fieldSpan}>
                {/* Alert提示框 */}
                {state.prop.alertTip && (
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
                    <Alert message={state.prop.alertTip} type="warning" />
                  </ConfigProvider>
                )}
              </Col>
            </Row>
            <Row>
              <Col
                span={labelSpan}
                style={{
                  textAlign: "right",
                  paddingRight: isSmall ? "4px" : "8px",
                  lineHeight: isSmall ? "24px" : "32px",
                }}
              >
                {/* 标签+冒号 */}
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
                    {state.prop.toolTip ? (
                      <>
                        <Tooltip title={state.prop.toolTip}>
                          <InfoCircleOutlined
                            twoToneColor="#8C8C8C"
                            style={{ opacity: 0.48 }}
                          />
                        </Tooltip>
                      </>
                    ) : (
                      <></>
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
              {/* 字段组件内容 */}
              <Col
                span={fieldSpan}
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* 三选一逻辑：自定义组件 > 控件类型(input/radio) */}
                <div style={{ flex: 1 }}>
                  {CustomComponent ? (
                    <CustomComponent
                      value={state.prop.value}
                      onChange={handleChange}
                      options={state.prop.options || options}
                      status={state.prop.errorMessage ? "error" : undefined}
                      disabled={state.prop.disabled}
                      size={size === "small" ? "small" : undefined}
                      {...itemProps}
                      id={path.join("/")}
                    />
                  ) : control === "input" ? (
                    <Input
                      {...itemProps}
                      size={size === "small" ? "small" : undefined}
                      value={state.prop.value}
                      onChange={(e) => handleChange(e.target.value)}
                      status={state.prop.errorMessage ? "error" : undefined}
                      disabled={state.prop.disabled}
                      id={path.join("/")}
                    />
                  ) : control === "radio" ? (
                    <Radio.Group
                      className="!h-fit"
                      size={size === "small" ? "small" : undefined}
                      value={state.prop.value}
                      options={state.prop.options || options}
                      onChange={(e) => handleChange(e.target.value)}
                      disabled={state.prop.disabled}
                      id={path.join("/")}
                    />
                  ) : control === "select" ? (
                    <Select
                      style={{ width: "100%" }}
                      size={size === "small" ? "small" : undefined}
                      value={state.prop.value}
                      options={state.prop.options || options}
                      onChange={(value) => handleChange(value)}
                      placeholder="请选择"
                      status={state.prop.errorMessage ? "error" : undefined}
                      disabled={state.prop.disabled}
                      id={path.join("/")}
                      {...itemProps}
                    />
                  ) : null}
                </div>
              </Col>
            </Row>
            {/* 校验错误信息 */}
            <Row>
              <Col offset={labelSpan} span={fieldSpan}>
                {state.prop.errorMessage && (
                  <div
                    style={{
                      color: "#ff4d4f",
                      fontSize: isSmall ? "12px" : "13px",
                    }}
                  >
                    {state.prop.errorMessage}
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
        componentSize={size === "small" ? "small" : undefined}
        theme={{
          components: {
            Alert: {
              defaultPadding: isSmall ? "1px 6px" : "2px 7px",
            },
          },
          token: { borderRadiusLG: 3, borderRadius: 2 },
        }}
      >
        <div>
          {
            <Flex gap={isSmall ? 12 : 24} vertical style={{ width: "100%" }}>
              {displayFields.map((path) => {
                const node = findNodeByPath(state, path);
                if (!node) {
                  console.warn(`Node not found for path: ${path.join("/")}`);
                  return null;
                }
                return renderField(node, path);
              })}
            </Flex>
          }
        </div>
      </ConfigProvider>
      {showDebug && (
        <>
          <Divider />
          <Alert
            type="info"
            message="调试：内部对象快照"
            description={
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(model.getJSONData(), null, 2)}
              </pre>
            }
          />
        </>
      )}
    </>
  );
};

export { useDynamicForm, Generator };
