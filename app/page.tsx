"use client";

import React from 'react';
import { Button, Select, Switch, Card, Tag, Space, Divider } from 'antd';
import { FormModel, FormSchema, FieldValue } from '../utils/structures';
import { Generator, useDynamicForm } from '../utils/generator';
import type { RuleItem } from 'async-validator';

// 自定义组件示例：带标签的选择器
const TagSelector: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  options?: Array<{ label: string; value: string }>;
}> = ({ value = [], onChange, options = [] }) => {
  return (
    <div>
      <Select
        mode="multiple"
        placeholder="选择标签"
        value={value}
        onChange={onChange}
        style={{ width: '100%' }}
        options={options}
      />
      <div style={{ marginTop: 8 }}>
        {value.map(tag => (
          <Tag key={tag} color="blue" style={{ margin: '2px' }}>
            {options.find(opt => opt.value === tag)?.label || tag}
          </Tag>
        ))}
      </div>
    </div>
  );
};

// 自定义组件：开关选择器
const SwitchSelector: React.FC<{
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}> = ({ value, onChange, label }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Switch checked={value} onChange={onChange} />
      <span>{label || '启用/禁用'}</span>
    </div>
  );
};

// 定义表单Schema，展示嵌套结构
const formSchema: FormSchema = {
  fields: [
    {
      key: 'userInfo',
      label: '用户信息',
      childrenFields: [
        {
          key: 'name',
          label: '姓名',
          control: 'input',
          rules: [{ required: true, message: '请输入姓名' }],
          itemProps: { placeholder: '请输入您的姓名' }
        },
        {
          key: 'userType',
          label: '用户类型',
          control: 'radio',
          options: [
            { label: '个人用户', value: 'personal' },
            { label: '企业用户', value: 'business' },
            { label: 'VIP用户', value: 'vip' }
          ],
          rules: [{ required: true, message: '请选择用户类型' }]
        }
      ]
    },
    {
      key: 'preferences',
      label: '偏好设置',
      childrenFields: [
        {
          key: 'interests',
          label: '兴趣标签',
          control: TagSelector,
          options: [
            { label: '技术', value: 'tech' },
            { label: '设计', value: 'design' },
            { label: '产品', value: 'product' },
            { label: '市场', value: 'marketing' },
            { label: '运营', value: 'operation' }
          ]
        },
        {
          key: 'notifications',
          label: '接收通知',
          control: SwitchSelector,
          itemProps: { label: '启用邮件通知' }
        }
      ]
    },
    {
      key: 'businessInfo',
      label: '企业信息',
      initialVisible: false, // 默认不显示
      childrenFields: [
        {
          key: 'companyName',
          label: '公司名称',
          control: 'input',
          rules: [{ required: true, message: '请输入公司名称' }],
          itemProps: { placeholder: '请输入公司名称' }
        },
        {
          key: 'industry',
          label: '所属行业',
          control: 'radio',
          options: [
            { label: '互联网', value: 'internet' },
            { label: '金融', value: 'finance' },
            { label: '教育', value: 'education' },
            { label: '制造业', value: 'manufacturing' },
            { label: '其他', value: 'other' }
          ]
        }
      ]
    },
    {
      key: 'vipInfo',
      label: 'VIP信息',
      initialVisible: false,
      childrenFields: [
        {
          key: 'vipLevel',
          label: 'VIP等级',
          control: 'radio',
          options: [
            { label: '银卡', value: 'silver' },
            { label: '金卡', value: 'gold' },
            { label: '钻石', value: 'diamond' }
          ]
        },
        {
          key: 'privileges',
          label: '特权选择',
          control: TagSelector,
          options: [
            { label: '优先客服', value: 'priority_support' },
            { label: '专属折扣', value: 'exclusive_discount' },
            { label: '生日礼品', value: 'birthday_gift' },
            { label: '免费升级', value: 'free_upgrade' }
          ]
        }
      ]
    },
    {
      key: 'additionalInfo',
      label: '附加信息',
      childrenFields: [
        {
          key: 'comments',
          label: '备注',
          control: 'input',
          itemProps: {
            placeholder: '请输入备注信息',
            type: 'textarea',
            rows: 3
          }
        }
      ]
    }
  ]
};
const model = new FormModel(formSchema);

// 注册响应式规则：根据用户类型显示不同的信息区块
model.registerRule(({ get, set }) => {
  const userType = get(['userInfo', 'userType']);

  // 当选择企业用户时，显示企业信息区块
  if (userType === 'business') {
    set(['businessInfo'], 'visible', true);
    set(['vipInfo'], 'visible', false);
    // 设置警告提示
    set(['businessInfo', 'companyName'], 'alertTip', '企业用户需要填写公司信息');
  }
  // 当选择VIP用户时，显示VIP信息区块
  else if (userType === 'vip') {
    set(['vipInfo'], 'visible', true);
    set(['businessInfo'], 'visible', false);
    // 设置提示信息
    set(['vipInfo', 'vipLevel'], 'alertTip', 'VIP用户享有专属特权');
  }
  // 个人用户隐藏企业和VIP信息
  else {
    set(['businessInfo'], 'visible', false);
    set(['vipInfo'], 'visible', false);
  }
});

// 注册另一个规则：根据VIP等级动态更新特权选项
model.registerRule(({ get, set }) => {
  const vipLevel = get(['vipInfo', 'vipLevel']);

  if (vipLevel === 'silver') {
    set(['vipInfo', 'privileges'], 'options', [
      { label: '优先客服', value: 'priority_support' },
      { label: '专属折扣', value: 'exclusive_discount' }
    ]);
  } else if (vipLevel === 'gold') {
    set(['vipInfo', 'privileges'], 'options', [
      { label: '优先客服', value: 'priority_support' },
      { label: '专属折扣', value: 'exclusive_discount' },
      { label: '生日礼品', value: 'birthday_gift' }
    ]);
  } else if (vipLevel === 'diamond') {
    set(['vipInfo', 'privileges'], 'options', [
      { label: '优先客服', value: 'priority_support' },
      { label: '专属折扣', value: 'exclusive_discount' },
      { label: '生日礼品', value: 'birthday_gift' },
      { label: '免费升级', value: 'free_upgrade' }
    ]);
  }
});

// 注册规则：当启用通知时，设置兴趣标签为必填
model.registerRule(({ get, set }) => {
  const notifications = get(['preferences', 'notifications']);

  if (notifications) {
    set(['preferences', 'interests'], 'alertTip', '启用通知后，请选择您的兴趣标签以获得精准推送');
  } else {
    set(['preferences', 'interests'], 'alertTip', undefined);
  }
});

// 初始化执行所有规则
model.runAllRules();
export default function DynamicFormDemo() {
  // 创建表单模型
  const [form] = useDynamicForm(model);

  // 获取要显示的字段路径（所有叶子节点）
  const displayFields = model.getAllLeafPaths();

  const handleFinish = (values: Record<string, FieldValue>) => {
    console.log('表单提交值:', values);
    console.log('内部模型数据:', model.getJSONData());

    // 这里可以处理表单提交逻辑
    alert('表单提交成功！请查看控制台输出。');
  };

  const handleReset = () => {
    form.resetFields();
    // 重置模型状态
    const allLeafPaths = model.getAllLeafPaths();
    allLeafPaths.forEach(path => {
      model.set(path, 'value', undefined);
    });
  };

  // 演示批量设置功能的按钮
  const handleBatchOperations = () => {
    // 批量隐藏偏好设置下的所有字段
    model.set(['preferences'], 'visible', false);

    setTimeout(() => {
      // 2秒后重新显示
      model.set(['preferences'], 'visible', true);
      alert('批量操作演示完成！偏好设置区块已重新显示');
    }, 2000);

    alert('批量隐藏偏好设置区块，2秒后将重新显示');
  };

  const handleBatchSetAlertTips = () => {
    // 批量为企业信息下的所有字段设置警告提示
    model.set(['businessInfo'], 'alertTip', '这是批量设置的警告提示信息');
    alert('已为企业信息下的所有字段批量设置警告提示');
  };

  const handleClearBatchAlertTips = () => {
    // 批量清除企业信息下的所有字段的警告提示
    model.set(['businessInfo'], 'alertTip', undefined);
    alert('已批量清除企业信息下的所有字段的警告提示');
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Card title="动态表单生成器演示 - 支持批量设置非叶子节点" style={{ marginBottom: '20px' }}>
        <h3>功能特点：</h3>
        <ul>
          <li><strong>嵌套数据结构：</strong>支持多层嵌套的表单字段，只有叶子节点才渲染表单控件</li>
          <li><strong>响应式规则：</strong>字段值变化时自动触发相关规则，动态显示/隐藏字段</li>
          <li><strong>自定义组件：</strong>支持自定义React组件作为表单控件</li>
          <li><strong>动态选项：</strong>支持根据其他字段值动态更新选项列表</li>
          <li><strong>批量设置：</strong>支持对非叶子节点进行批量设置，自动应用到所有子叶子节点</li>
          <li><strong>警告提示：</strong>支持动态显示字段相关的提示信息</li>
        </ul>

        <div style={{ marginTop: '16px' }}>
          <strong>操作说明：</strong>
          <ol>
            <li>选择不同的"用户类型"观察字段的动态显示/隐藏</li>
            <li>在VIP用户模式下，选择不同的VIP等级观察特权选项的变化</li>
            <li>切换"接收通知"开关观察提示信息的变化</li>
            <li>使用下方的批量操作按钮测试非叶子节点的批量设置功能</li>
            <li>所有表单数据实时同步，支持嵌套结构</li>
          </ol>
        </div>

        <Divider />

        <div style={{ marginBottom: '16px' }}>
          <strong>批量操作演示：</strong>
          <div style={{ marginTop: '8px' }}>
            <Space wrap>
              <Button type="dashed" onClick={handleBatchOperations}>
                批量隐藏/显示偏好设置
              </Button>
              <Button type="dashed" onClick={handleBatchSetAlertTips}>
                批量设置企业信息警告提示
              </Button>
              <Button type="dashed" onClick={handleClearBatchAlertTips}>
                批量清除企业信息警告提示
              </Button>
              <Button
                type="dashed"
                onClick={() => {
                  // 先显示企业信息区块
                  model.set(['businessInfo'], 'visible', true);
                  // 然后批量设置企业信息下所有字段的选项
                  model.set(['businessInfo'], 'options', [
                    { label: '新选项1', value: 'new1' },
                    { label: '新选项2', value: 'new2' }
                  ]);
                  alert('已批量更新企业信息下所有字段的选项（如果适用）');
                }}
              >
                批量更新选项
              </Button>
            </Space>
          </div>
        </div>
      </Card>

      <Generator
        model={model}
        schema={formSchema}
        displayFields={displayFields}
        form={form}
        onFinish={handleFinish}
      />

      <Card style={{ marginTop: '20px' }}>
        <div style={{ textAlign: 'center', gap: '12px', display: 'flex', justifyContent: 'center' }}>
          <Button type="primary" onClick={() => {
            model.validateAllField().then((message) => {
              console.log(message);
            })
          }}>
            提交表单
          </Button>
          <Button onClick={handleReset}>
            重置表单
          </Button>
          <Button
            type="dashed"
            onClick={() => {
              console.log('当前表单模型快照:', model.getSnapshot());
              console.log('当前表单JSON数据:', model.getJSONData());
            }}
          >
            打印调试信息
          </Button>
        </div>
      </Card>
    </div>
  );
}