import { Form, ConfigProvider, Divider, Alert, Card, Col, Radio, Row, Space, Input, FormInstance } from "antd";
import React, { useState, useEffect, ComponentType } from "react";
import { FieldPath, FieldSchema, FieldValue, FormModel, FormSchema, FieldWithStateSchema } from "./structures";
import { Rule } from "async-validator";
import type { ValidateError } from 'async-validator';

/** 将内部对象 + 布局（二维数组）渲染为多步骤表单 */
interface GeneratorProps {
  model: FormModel;
  schema: FormSchema;
  // stepsLayout: Array<{ title: string; fieldKeys: FieldKey[] }>; // 多步骤的二维布局（这里按步来）
  displayFields: FieldPath[];
  form: FormInstance<any>;
  onFinish: (values: Record<string, FieldValue>) => void;
}

/** 自定义表单生成器的hook */
interface DynamicFormHook {
  submit: () => any;
  getFieldValue: (path: FieldPath) => any;
  setFieldValue: (path: FieldPath, value: FieldValue) => void;
  setFieldsValue: (value: any) => void;
  validateFieldValue: (path: FieldPath) => ValidateError;
  validate: () => ValidateError;
}

const useDynamicForm2 = (model: FormModel) => {
  const [, force] = useState({});
  useEffect(() => {
    model.subscribe(() => {
      force({});
    }
    )
  });
}

// 即将更换成完全自定义的hook，不使用AntD的数据管理
const useDynamicForm = (model: FormModel) => {
  // hook的意义：触发更新
  const [, force] = useState({});
  const [form] = Form.useForm();
  useEffect(() => {
    model.subscribe(() => {
      force({});
      
      // 将 FormModel 的值同步到 AntD Form
      const values = model.getJSONData();
      form.setFieldsValue(values);
    });
  }, [model]);

  return [form];
}

const Generator: React.FC<GeneratorProps> = ({ form, model, schema, displayFields, onFinish }) => {
  // 将内部值灌进 AntD，以保持受控（演示用，每次渲染同步一次）
  const snapshot = model.getSnapshot();
  
  // 递归获取所有字段的值
  const getAllFieldValues = (nodes: FieldWithStateSchema[]): Record<string, any> => {
    let values: Record<string, any> = {};
    
    nodes.forEach(node => {
      // 只处理叶子节点的值
      if (node.children.length === 0) {
        // 使用完整路径作为键
        const pathKey = node.path.join('.');
        values[pathKey] = node.state!.value;
      } else {
        // 递归处理子节点
        const childValues = getAllFieldValues(node.children);
        values = { ...values, ...childValues };
      }
    });
    
    return values;
  };
  
  React.useEffect(() => {
    const values = getAllFieldValues(snapshot);
    form.setFieldsValue(values);
  }, [form, snapshot]);
  
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
    const { label, control, options, itemProps, rules } = node.schemaData!;
    
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
    
    return (
      <React.Fragment key={path.join('/')}>
        <Row>
          <Col offset={4} span={20}>
            {node.state.alertTip && <Alert message={node.state.alertTip} type='warning' />}
          </Col>
        </Row>
        <Form.Item 
          name={path} 
          label={label} 
          // rules={rules ? [rules] : [{ required: true, message: "必填" }] as Rule[]}
        >
          {/* 三选一逻辑：自定义组件 > 控件类型(input/radio) */}
          {CustomComponent ? (
            // @ts-ignore
            <CustomComponent 
              value={node.state.value}
              options={node.state.options || options} 
              {...itemProps} 
            />
          ) : control === "input" ? (
            <Input {...itemProps} value={node.state.value}/>
          ) : control === "radio" ? (
            <Radio.Group value={node.state.value} options={node.state.options || options} />
          ) : null}
        </Form.Item>
      </React.Fragment>
    );
  };

  // 获取所有叶子节点路径
  const allLeafPaths = model.getAllLeafPaths();
  return (
    <Card className="max-w-5xl mx-auto mt-6">
      <Divider />
      <ConfigProvider 
        theme={{
          components: {
            Alert: {
              defaultPadding: '2px 7px' 
            },
            Form: {
              itemMarginBottom: 3
            }
          },
          token: { borderRadiusLG: 3, borderRadius: 2 }
        }}
      >
        <Form
          form={form}
          // layout="vertical"
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
          onValuesChange={(changed) => {
            // 递归遍历changed对象
            const processChangedValues = (changedObj: Record<string, any>, currentPath: FieldPath = []) => {
              Object.entries(changedObj).forEach(([key, value]) => {
                // 构建当前路径
                const path = [...currentPath, key];
                
                // 检查当前路径是否在叶子节点路径列表中
                const isLeafPath = allLeafPaths.some(leafPath =>
                  leafPath.length === path.length &&
                  leafPath.every((segment, i) => segment === path[i])
                );

                // 如果是叶子节点路径，则更新该字段
                if (isLeafPath) {
                  model.set(path, 'value', value as FieldValue);
                } else {
                  processChangedValues(value, path);
                }
              });
            };
            
            // 处理changed对象
            processChangedValues(changed);
          }}
          onFinish={onFinish}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            {displayFields.map(path => renderField(Array.isArray(path) ? path : [path]))}
          </Space>
          <Divider />
        </Form>
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
  useDynamicForm,
  Generator,
}

export type {
  GeneratorProps
}
