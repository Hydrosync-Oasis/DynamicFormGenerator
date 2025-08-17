import { ConfigProvider, Divider, Alert, Card, Col, Radio, Row, Space, Input } from "antd";
import React, { useState, useEffect, ComponentType } from "react";
import { FieldPath, FieldSchema, FieldValue, FormModel, FormSchema } from "./structures";

/** 将内部对象 + 布局（二维数组）渲染为多步骤表单 */
interface GeneratorProps {
  model: FormModel;
  displayFields: FieldPath[];
}

/** 自定义表单生成器的hook */
interface DynamicFormHook {
  submit: () => Promise<any>;
  getFieldValue: (path: FieldPath) => any;
  setFieldValue: (path: FieldPath, value: FieldValue) => void;
  setFieldsValue: (value: any) => void;
  validateField: (path: FieldPath) => Promise<any>;
  validateFields: (paths: FieldPath[]) => Promise<any>;
  validateAllFields: (paths: FieldPath[]) => Promise<any>;
}

const useDynamicForm2 = (model: FormModel) => {
  const [, force] = useState({});
  useEffect(() => {
    model.subscribe(() => {
      force({}); // 响应式的最终触发方式
    });
  }, [model]);

  const hook: DynamicFormHook = {
    validateAllFields: () => {
      return model.validateAllFields();
    },
    validateField: (path: FieldPath) => {
      return model.validateField(path);
    },
    submit: async () => {
      return await model.validateAllFields();
    },
    getFieldValue: (path: FieldPath) => {
      return model.get(path, 'value');
    },
    setFieldValue: (path: FieldPath, value: FieldValue) => {
      model.set(path, 'value', value);
    },
    setFieldsValue: (values: any) => {
      // 递归设置多个字段的值
      const setNestedValues = (obj: Record<string, any>, currentPath: FieldPath = []) => {
        Object.entries(obj).forEach(([key, value]) => {
          const path = [...currentPath, key];
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            setNestedValues(value, path);
          } else {
            model.set(path, 'value', value);
          }
        });
      };
      setNestedValues(values);
    },
    /** 只校验显示的字段 */
    validateFields: (paths: FieldPath[]) => {
      return model.validateFields(paths.filter(
        (path) => {
          return model.get(path, 'visible')
        }
      ));
    },
  };

  return hook;
};

const Generator: React.FC<GeneratorProps> = ({ model, displayFields }) => {
  // 响应式更新
  const [, force] = useState({});
  useEffect(() => {
    model.subscribe(() => {
      force({});
    });
  }, [model]);
  
  // 递归渲染字段
  const renderField = (path: FieldPath): React.ReactNode => {
    const node = model.findNodeByPath(path);
    if (!node) return null;
    if (!node.state) return null;
    
    const visible = node.state.visible;
    if (!visible) return null;
    
    // 如果有子节点，则不渲染当前节点，只渲染子节点
    if (node.children.length > 0) {
      return (
        <React.Fragment key={path.join('.')}>
          {node.children.map(child => renderField([...path, child.key]))}
        </React.Fragment>
      );
    }
    
    // 叶子节点才渲染UI
    const { label, control, options, itemProps } = node.schemaData!;
    
    let CustomComponent: ComponentType<{
      value: FieldValue,
      onChange: (value: FieldValue) => void,
      options?: FieldSchema['options']
    } & Record<string, any>> | undefined = undefined;
    
    if (typeof control !== 'string') {
      CustomComponent = control;
    }
    if (!node.state) {
      throw new Error('non-leaf node')
    }

    // 处理字段值变化的回调
    const handleChange = (value: FieldValue) => {
      model.set(path, 'value', value);
      // 可选：实时验证
      model.validateField(path).catch(() => {
        // 验证失败时错误信息已经通过 validateField 内部逻辑设置到 errorMessage
      });
    };
    
    return (
      <React.Fragment key={path.join('/')}>
        <Row>
          <Col offset={4} span={20}>
            {node.state.alertTip && <Alert message={node.state.alertTip} type='warning' />}
          </Col>
        </Row>
        {/* 自定义表单项布局 */}
        <div style={{ marginBottom: '0px' }}>
          <Row align="middle">
            <Col span={4} style={{ textAlign: 'right', paddingRight: '8px', lineHeight: '32px' }}>
              <label htmlFor={path.join('/')} style={{ color: '#000000d9' }}>{label}:</label>
            </Col>
            <Col span={20}>
              {/* 三选一逻辑：自定义组件 > 控件类型(input/radio) */}
              <div id={path.join('/')}>
                {CustomComponent ? (
                  <CustomComponent
                    value={node.state.value}
                    onChange={handleChange}
                    options={node.state.options || options}
                    {...itemProps}
                  />
                ) : control === "input" ? (
                  <Input
                    {...itemProps}
                    value={node.state.value}
                    onChange={(e) => handleChange(e.target.value)}
                  />
                ) : control === "radio" ? (
                  <Radio.Group
                    value={node.state.value}
                    options={node.state.options || options}
                    onChange={(e) => handleChange(e.target.value)}
                  />
                ) : null}

              </div>
            </Col>
          </Row>
        </div>
        {/* 错误信息显示区域 */}
        { node.state.errorMessage &&
          <Row>
            <Col offset={4} span={20}>
              <div style={{ color: '#ff4d4f', fontSize: '13px'}}>
                {node.state.errorMessage}
              </div>
            </Col>
          </Row>}
      </React.Fragment>
    );
  };

  return (
    <Card className="max-w-5xl mx-auto mt-6">
      <Divider />
      <ConfigProvider 
        theme={{
          components: {
            Alert: {
              defaultPadding: '2px 7px' 
            }
          },
          token: { borderRadiusLG: 3, borderRadius: 2 }
        }}
      >
        <div style={{ padding: '24px 0' }}>
          <Space size="small" direction="vertical" style={{ width: "100%" }}>
            {displayFields.map(path => renderField(Array.isArray(path) ? path : [path]))}
          </Space>
          
          <Divider />
        </div>
      </ConfigProvider>
      <Divider />
      <Alert
        type="info"
        message="调试：内部对象快照"
        description={
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              model.getJSONData(),
              null,
              2
            )}
          </pre>
        }
      />
    </Card>
  );
};

export {
  useDynamicForm2 as useDynamicForm,
  Generator,
}

export type {
  GeneratorProps
}
