import {
  ConfigProvider,
  Divider,
  Alert,
  Col,
  Radio,
  Row,
  Input,
  Select,
  Tooltip,
  Flex,
} from "antd";
import React, { useSyncExternalStore, useMemo, useCallback } from "react";
import { FieldPath, FieldValue, FormModel } from "./structures";
import { InfoCircleOutlined } from "@ant-design/icons";
import { ImmutableFormState } from "./type";
import { findNodeByPath } from "./helper";

/** 将内部对象 + 布局（二维数组）渲染为多步骤表单 */

/** 自定义表单生成器的hook */
interface DynamicFormHook {
  submit: () => Promise<any>;
  getFieldValue: (path: FieldPath) => any;
  setFieldValue: (path: FieldPath, value: FieldValue) => void;
  setFieldsValue: (value: any) => void;
  resetFields: (path?: FieldPath) => void;
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
        model.setValue(path, value, { invokeOnChange: true }, true);
      },
      setFieldsValue: (values: any) => {
        model.setValues([], values, undefined, true);
      },
      resetFields: (path?: FieldPath) => {
        model.resetFields(path);
      },
      /**
       * 校验指定字段，无论是否显示都校验，使用多步骤动态表单优先使用这个函数
       * @param paths 要校验的字段路径数组
       */
      validateFields: (paths: FieldPath[]) => {
        return model.validateFields(
          paths.filter((path) => model.get(path, "visible")),
          true
        );
      },
    };

    return hook;
  }, []);
};

/**
 * 字段组件 - 渲染单个表单字段的完整布局（包括标签、控件、错误信息等）
 */
export const DefaultFieldDisplay = React.memo(
  ({
    displayOption,
    state,
    onChange,
  }: {
    displayOption?: {
      labelSpan?: number;
      fieldSpan?: number;
      fontSize?: number;
      lineHeight?: number;
    };
    state: ImmutableFormState;
    onChange: (value: FieldValue, path: FieldPath) => void;
  }) => {
    const labelSpan = displayOption?.labelSpan ?? 4;
    const fieldSpan = displayOption?.fieldSpan ?? 20;
    const fontSize = displayOption?.fontSize ?? 14;
    const lineHeight = displayOption?.lineHeight ?? 32;

    if (state.type !== "field") {
      throw new Error("Field component requires a field-type state");
    }
    const path = state.path.slice(1); // 去掉 dummy 根节点的路径部分

    // 从 state 中解构所有需要的属性
    const {
      control: Control,
      value,
      controlProps,
      errorMessage,
      label,
      required: isRequired,
      toolTip,
      alertTip,
      visible,
    } = state.prop;

    // 如果不可见，不渲染
    if (!visible) return null;

    let FormFieldRenderer: React.ReactElement | undefined = undefined;

    if (Control === undefined) {
      return null;
    } else if (typeof Control !== "string") {
      FormFieldRenderer = (
        <Control
          id={path.join("/")}
          value={value}
          status={errorMessage && "error"}
          {...controlProps}
          onChange={(value) => onChange(value, path)}
        />
      );
    } else if (Control === "input") {
      FormFieldRenderer = (
        <Input
          id={path.join("/")}
          value={value}
          status={errorMessage && "error"}
          {...controlProps}
          onChange={(e) => onChange(e.target.value, path)}
        />
      );
    } else if (Control === "select") {
      FormFieldRenderer = (
        <Select
          id={path.join("/")}
          value={value}
          className="!w-full"
          status={errorMessage && "error"}
          {...controlProps}
          onChange={(value) => onChange(value, path)}
        />
      );
    } else if (Control === "radio") {
      FormFieldRenderer = (
        <Radio.Group
          id={path.join("/")}
          value={value}
          {...controlProps}
          onChange={(value) => onChange(value.target.value, path)}
        />
      );
    } else {
      throw new Error(`Unsupported control type: ${Control}`);
    }

    return (
      <React.Fragment key={path.join("/")}>
        {/* 自定义表单项布局 */}
        <Row>
          <Col span={24}>
            <Row style={{ marginBottom: 5 }}>
              <Col offset={labelSpan} span={fieldSpan}>
                {/* Alert提示框 */}
                {alertTip && (
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
                    <Alert message={alertTip} type="warning" />
                  </ConfigProvider>
                )}
              </Col>
            </Row>
            <Row>
              <Col
                span={labelSpan}
                style={{
                  textAlign: "right",
                  paddingRight: "8px",
                  lineHeight: `${lineHeight}px`,
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
                    fontSize: fontSize,
                  }}
                >
                  <span>:</span>
                  <>
                    {toolTip ? (
                      <>
                        <Tooltip title={toolTip}>
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
                      <span
                        style={{
                          color: "#ff4d4f",
                          marginRight: 4,
                          fontSize: fontSize,
                          fontFamily: "SimSun,sans-serif",
                        }}
                      >
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
                <div style={{ flex: 1 }}>{FormFieldRenderer}</div>
              </Col>
            </Row>
            {/* 校验错误信息 */}
            <Row>
              <Col offset={labelSpan} span={fieldSpan}>
                {errorMessage && (
                  <div
                    style={{
                      color: "#ff4d4f",
                      fontSize: fontSize - 1,
                    }}
                  >
                    {errorMessage}
                  </div>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
      </React.Fragment>
    );
  }
);

DefaultFieldDisplay.displayName = "DefaultFieldDisplay";

/**
 * HOC - 创建具有更宽标签的字段展示组件
 */
export const withWiderLabel = (
  labelSpan: number = 6,
  fontSize?: number,
  lineHeight?: number
) => {
  const WiderLabelFieldDisplay = React.memo(
    ({
      displayOption,
      state,
      onChange,
    }: {
      displayOption?: {
        labelSpan?: number;
        fieldSpan?: number;
        fontSize?: number;
        lineHeight?: number;
      };
      state: ImmutableFormState;
      onChange: (value: FieldValue, path: FieldPath) => void;
    }) => {
      // 覆盖 labelSpan，相应调整 fieldSpan
      const adjustedDisplayOption = {
        ...displayOption,
        labelSpan: labelSpan,
        fieldSpan: 24 - labelSpan, // 确保总和为24
        ...(fontSize !== undefined && { fontSize }), // 如果提供了 fontSize，则覆盖
        ...(lineHeight !== undefined && { lineHeight }), // 如果提供了 lineHeight，则覆盖
      };

      return (
        <DefaultFieldDisplay
          displayOption={adjustedDisplayOption}
          state={state}
          onChange={onChange}
        />
      );
    }
  );

  WiderLabelFieldDisplay.displayName = `WiderLabelFieldDisplay(${labelSpan})`;

  return WiderLabelFieldDisplay;
};

/**
 * 预设的宽标签字段展示组件
 */
export const WideFieldDisplay = withWiderLabel(6);
export const ExtraWideFieldDisplay = withWiderLabel(8);

const Generator = ({
  model,
  displayFields,
  displayOption,
}: {
  model: FormModel;
  displayFields: FieldPath[];
  displayOption?: {
    showDebug?: boolean;
  };
  inlineMaxPerRow?: number;
}) => {
  const showDebug = displayOption?.showDebug ?? false;

  // 获取不可变快照，利用useSES更新
  const state = useSyncExternalStore(
    model.subscribe.bind(model),
    model.getSnapshot.bind(model),
    model.getSnapshot.bind(model)
  );
  // 处理字段值变化的回调
  const handleChange = (value: FieldValue, path: FieldPath) => {
    model.setValue(path, value, { invokeOnChange: true }, true);
    // 可选：实时验证
    model.validateField(path, true).catch(() => {
      // 验证失败时错误信息已经通过 validateField 内部逻辑设置到 errorMessage
    });
  };
  const changeCallback = useCallback((value: FieldValue, path: FieldPath) => {
    handleChange(value, path);
  }, []);

  // 递归渲染字段的函数
  const renderField = (state: ImmutableFormState): React.ReactNode => {
    const path = state.path.slice(1); // 去掉 dummy 根节点的路径部分

    // 如果有子节点，那么当前节点并无内容，仅渲染子节点
    if (state.type !== "field") {
      if (state.children.length > 0 && state.prop.visible) {
        // 渲染所有子节点
        const childrenNodes = state.children.map((child) => renderField(child));

        // 如果有自定义布局组件，使用它来包裹子节点
        if (state.LayoutComponent) {
          return (
            <state.LayoutComponent key={path.join(".")} state={state}>
              {childrenNodes}
            </state.LayoutComponent>
          );
        }

        // 否则使用默认的 Fragment 包裹
        return (
          <React.Fragment key={path.join(".")}>{childrenNodes}</React.Fragment>
        );
      } else {
        return null;
      }
    }

    // 直接返回 Field 组件，它会处理所有的布局和可见性逻辑
    return !state.FieldDisplayComponent ? (
      <DefaultFieldDisplay
        key={path.join("/")}
        state={state}
        onChange={changeCallback}
      />
    ) : (
      <state.FieldDisplayComponent
        key={path.join("/")}
        state={state}
        onChange={changeCallback}
      />
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
          {
            <Flex gap={24} vertical style={{ width: "100%" }}>
              {displayFields.map((path) => {
                const node = findNodeByPath(state, path);
                if (!node) {
                  console.warn(`Node not found for path: ${path.join("/")}`);
                  return null;
                }
                return renderField(node);
              })}
            </Flex>
          }
        </div>
      </ConfigProvider>
      {/* 开发调试用 */}
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
