"use client";

import React, { useEffect, useState } from 'react';
import { Button, Card, Tag, Space, Divider, Alert } from 'antd';
import { FormModel, FormSchema, FieldValue } from '../utils/structures';
import { Generator, useDynamicForm } from '../utils/generator';
import * as z from 'zod';

// 创建响应式校验规则演示的表单Schema
const responsiveValidationSchema: FormSchema = {
  fields: [
    {
      key: 'profile',
      label: '用户档案',
      childrenFields: [
        {
          key: 'name',
          label: '姓名',
          control: 'input',
          validate: z.string().min(2, '姓名至少2个字符'),
          defaultValue: 'Tom',
          itemProps: { placeholder: '请输入姓名' }
        },
        {
          key: 'age',
          label: '年龄',
          control: 'input',
          validate: z.number().min(1, '年龄必须大于0').max(120, '年龄不能超过120'),
          defaultValue: 25,
          itemProps: { type: 'number', placeholder: '请输入年龄' }
        },
        {
          key: 'email',
          label: '邮箱',
          control: 'input',
          validate: z.string().email('请输入有效的邮箱地址'),
          defaultValue: 'tom@example.com',
          itemProps: { placeholder: '请输入邮箱' }
        }
      ]
    },
    {
      key: 'settings',
      label: '设置',
      childrenFields: [
        {
          key: 'level',
          label: '用户等级',
          control: 'radio',
          validate: z.enum(['basic', 'premium', 'vip']),
          defaultValue: 'basic',
          options: [
            { label: '基础用户', value: 'basic' },
            { label: '高级用户', value: 'premium' },
            { label: 'VIP用户', value: 'vip' }
          ]
        },
        {
          key: 'creditLimit',
          label: '信用额度',
          control: 'input',
          validate: z.number().min(0, '信用额度不能为负数'),
          defaultValue: 1000,
          itemProps: { type: 'number', placeholder: '请输入信用额度' }
        }
      ]
    }
  ]
};


export default function ResponsiveValidationDemo() {
  const [currentRule, setCurrentRule] = useState<string>('default');
  const [validationStatus, setValidationStatus] = useState<string>('');
  
  const [model, _] = useState(new FormModel(responsiveValidationSchema));
  
  // 创建表单模型
  const form = useDynamicForm(model);

  // 获取要显示的字段路径
  const displayFields = model.getAllLeafPaths();

  // 响应式校验规则演示集合
  const validationRules = {
    default: {
      name: '默认校验',
      description: '使用表单定义时的默认校验规则',
      action: () => {
        // 清除所有响应式校验规则，恢复默认
        model.set(['profile', 'name'], 'validation', undefined);
        model.set(['profile', 'age'], 'validation', undefined);
        model.set(['profile', 'email'], 'validation', undefined);
        model.set(['settings', 'creditLimit'], 'validation', undefined);
      }
    },
    strict: {
      name: '严格模式',
      description: '更严格的校验规则',
      action: () => {
        model.setFieldValidation(['profile', 'name'], 
          z.string().min(3, '姓名至少3个字符').max(10, '姓名不能超过10个字符')
        );
        model.setFieldValidation(['profile', 'age'], 
          z.number().int('年龄必须是整数').min(18, '必须年满18岁').max(65, '年龄不能超过65岁')
        );
        model.setFieldValidation(['profile', 'email'], 
          z.string().email('无效邮箱格式').refine(val => val.includes('@company.com'), {
            message: '只允许公司邮箱(@company.com)'
          })
        );
      }
    },
    dynamic: {
      name: '动态规则',
      description: '根据用户等级动态调整校验规则',
      action: () => {
        const userLevel = model.get(['settings', 'level'], 'value');
        
        if (userLevel === 'vip') {
          model.setFieldValidation(['settings', 'creditLimit'], 
            z.number().min(10000, 'VIP用户信用额度至少10000')
          );
          model.setFieldValidation(['profile', 'name'], 
            z.string().min(2, 'VIP用户姓名至少2个字符').regex(/^[A-Za-z\s]+$/, 'VIP用户姓名只能包含英文字母')
          );
        } else if (userLevel === 'premium') {
          model.setFieldValidation(['settings', 'creditLimit'], 
            z.number().min(5000, '高级用户信用额度至少5000')
          );
          model.setFieldValidation(['profile', 'name'], 
            z.string().min(2, '姓名至少2个字符')
          );
        } else {
          model.setFieldValidation(['settings', 'creditLimit'], 
            z.number().max(2000, '基础用户信用额度不能超过2000')
          );
          model.setFieldValidation(['profile', 'name'], 
            z.string().min(2, '姓名至少2个字符')
          );
        }
      }
    },
    crossField: {
      name: '跨字段校验',
      description: '年龄和信用额度的关联校验',
      action: () => {
        // 这个规则通过validateFieldsWithEnhancer来实现
        model.setFieldValidation(['profile', 'age'], 
          z.number().min(18, '年龄必须大于18岁')
        );
        model.setFieldValidation(['settings', 'creditLimit'], 
          z.number().min(0, '信用额度不能为负数')
        );
      }
    }
  };

  // 应用选中的校验规则
  const applyValidationRule = (ruleKey: string) => {
    setCurrentRule(ruleKey);
    validationRules[ruleKey as keyof typeof validationRules].action();
    setValidationStatus(`已应用 ${validationRules[ruleKey as keyof typeof validationRules].name}`);
    
    // 如果是动态规则，需要监听用户等级变化
    if (ruleKey === 'dynamic') {
      // 注册响应式规则来监听用户等级变化
      model.registerRule(({ get, set }) => {
        const level = get(['settings', 'level']);
        if (level) {
          validationRules.dynamic.action();
        }
      });
    }
  };

  // 验证表单
  const validateForm = async () => {
    try {
      if (currentRule === 'crossField') {
        // 使用跨字段校验
        await model.validateFieldsWithEnhancer(
          [['profile', 'age'], ['settings', 'creditLimit']],
          (schema) => schema.refine(
            (data: any) => {
              const age = data.profile?.age || 0;
              const creditLimit = data.settings?.creditLimit || 0;
              // 年龄越大，允许的信用额度越高
              const maxCredit = age * 1000;
              return creditLimit <= maxCredit;
            },
            {
              message: '信用额度不能超过年龄×1000',
              path: ['settings', 'creditLimit']
            }
          )
        );
      } else {
        await model.validateAllFields();
      }
      setValidationStatus('✅ 表单验证通过！');
    } catch (error) {
      setValidationStatus('❌ 表单验证失败，请查看错误提示');
      console.error('Validation error:', error);
    }
  };

  // 重置表单
  const resetForm = () => {
    model.set(['profile', 'name'], 'value', 'Tom');
    model.set(['profile', 'age'], 'value', 25);
    model.set(['profile', 'email'], 'value', 'tom@example.com');
    model.set(['settings', 'level'], 'value', 'basic');
    model.set(['settings', 'creditLimit'], 'value', 1000);
    
    // 清除所有错误信息
    displayFields.forEach(path => {
      model.set(path, 'errorMessage', undefined);
    });
    
    setValidationStatus('表单已重置');
  };

  // 填充测试数据
  const fillTestData = (scenario: string) => {
    switch (scenario) {
      case 'valid':
        model.set(['profile', 'name'], 'value', 'Alice Johnson');
        model.set(['profile', 'age'], 'value', 30);
        model.set(['profile', 'email'], 'value', 'alice@company.com');
        model.set(['settings', 'level'], 'value', 'premium');
        model.set(['settings', 'creditLimit'], 'value', 8000);
        break;
      case 'invalid':
        model.set(['profile', 'name'], 'value', 'A');
        model.set(['profile', 'age'], 'value', 16);
        model.set(['profile', 'email'], 'value', 'invalid-email');
        model.set(['settings', 'level'], 'value', 'vip');
        model.set(['settings', 'creditLimit'], 'value', 50000);
        break;
      case 'crossFieldTest':
        model.set(['profile', 'age'], 'value', 20);
        model.set(['settings', 'creditLimit'], 'value', 25000); // 超过 20*1000
        break;
    }
    setValidationStatus('测试数据已填充');
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Card title="🚀 响应式校验规则演示" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3>🎯 功能演示：</h3>
          <p>这个演示展示了如何动态设置和切换字段的校验规则，实现响应式校验。</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {Object.entries(validationRules).map(([key, rule]) => (
              <Card 
                key={key}
                size="small" 
                title={rule.name}
                bordered={false}
                style={{ 
                  backgroundColor: currentRule === key ? '#e6f7ff' : '#fafafa',
                  border: currentRule === key ? '1px solid #1890ff' : '1px solid #d9d9d9'
                }}
              >
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
                  {rule.description}
                </p>
                <Button 
                  size="small"
                  type={currentRule === key ? 'primary' : 'default'}
                  onClick={() => applyValidationRule(key)}
                  block
                >
                  {currentRule === key ? '已应用' : '应用规则'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <Divider />

        <div style={{ marginBottom: '16px' }}>
          <strong>🎮 操作演示：</strong>
          <div style={{ marginTop: '12px' }}>
            <Space wrap size="middle">
              <Button onClick={() => fillTestData('valid')} type="primary" ghost>
                📝 填充有效数据
              </Button>
              <Button onClick={() => fillTestData('invalid')} danger ghost>
                ⚠️ 填充无效数据
              </Button>
              <Button onClick={() => fillTestData('crossFieldTest')} type="dashed">
                🔗 跨字段测试数据
              </Button>
              <Button onClick={validateForm} type="primary">
                ✅ 验证表单
              </Button>
              <Button onClick={resetForm}>
                🔄 重置表单
              </Button>
            </Space>
          </div>
          
          {validationStatus && (
            <Alert 
              message={validationStatus} 
              type={validationStatus.includes('✅') ? 'success' : validationStatus.includes('❌') ? 'error' : 'info'}
              style={{ marginTop: '12px' }}
              showIcon
            />
          )}
        </div>

        <Divider />

        <div>
          <strong>📋 使用说明：</strong>
          <ol style={{ marginTop: '8px', marginBottom: 0 }}>
            <li><strong>默认校验：</strong>使用表单定义时的基础校验规则</li>
            <li><strong>严格模式：</strong>应用更严格的校验规则，如公司邮箱限制</li>
            <li><strong>动态规则：</strong>根据用户等级自动调整校验规则</li>
            <li><strong>跨字段校验：</strong>实现字段间的关联校验（年龄×1000 ≥ 信用额度）</li>
            <li><strong>实时反馈：</strong>所有校验规则都会实时生效并显示错误信息</li>
          </ol>
        </div>
      </Card>

      {/* 主表单区域 */}
      <Generator
        model={model}
        displayFields={displayFields}
      />

      {/* 当前状态显示 */}
      <Card title="🔧 当前状态" style={{ marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div>
            <h4>📊 当前校验规则</h4>
            <Tag color={currentRule === 'default' ? 'default' : 'blue'} style={{ fontSize: '14px' }}>
              {validationRules[currentRule as keyof typeof validationRules].name}
            </Tag>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
              {validationRules[currentRule as keyof typeof validationRules].description}
            </p>
          </div>
          
          <div>
            <h4>📋 表单数据</h4>
            <div style={{ 
              backgroundColor: '#f8f8f8', 
              padding: '12px', 
              borderRadius: '4px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              <pre style={{ margin: 0, fontSize: '12px' }}>
                {JSON.stringify(model.getJSONData(), null, 2)}
              </pre>
            </div>
          </div>
          
          <div>
            <h4>🎯 实用提示</h4>
            <ul style={{ fontSize: '13px', color: '#666', margin: 0, paddingLeft: '16px' }}>
              <li>切换用户等级观察动态规则变化</li>
              <li>在严格模式下尝试输入非公司邮箱</li>
              <li>使用跨字段测试观察关联校验</li>
              <li>查看错误信息的实时更新</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
