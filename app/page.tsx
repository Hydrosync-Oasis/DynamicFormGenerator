"use client";

import React, { useState } from 'react';
import { Button, Select, Switch, Card, Tag, Space, Divider, Steps, DatePicker, InputNumber, Rate, Slider } from 'antd';
import { FormModel, FormSchema, FieldValue } from '../utils/structures';
import { Generator, useDynamicForm } from '../utils/generator';
import * as z from 'zod';

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
      {(value && value.length > 0) &&
        <div style={{ marginTop: 8 }}>
          {value.map(tag => (
            <Tag key={tag} color="blue" style={{ margin: '2px' }}>
              {options.find(opt => opt.value === tag)?.label || tag}
            </Tag>
          ))}
        </div>
      }
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

// 自定义组件：评分组件
const RatingSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
  max?: number;
}> = ({ value, onChange, max = 5 }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Rate count={max} value={value} onChange={onChange} />
      <span>{value ? `${value}/${max}` : '未评分'}</span>
    </div>
  );
};

// 自定义组件：滑块选择器
const SliderSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}> = ({ value, onChange, min = 0, max = 100, step = 1, suffix = '' }) => {
  return (
    <div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        marks={{
          [min]: `${min}${suffix}`,
          [max]: `${max}${suffix}`
        }}
      />
      <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
        当前值: {value}{suffix}
      </div>
    </div>
  );
};

// 自定义组件：年龄选择器
const AgeSelector: React.FC<{
  value: number;
  onChange: (value: number | null) => void;
}> = ({ value, onChange }) => {
  return (
    <InputNumber
      min={1}
      max={120}
      value={value}
      onChange={(val) => onChange(val)}
      addonAfter="岁"
      placeholder="请输入年龄"
      style={{ width: '100%' }}
    />
  );
};

// 定义多步骤表单Schema，展示复杂的嵌套结构和动态功能
const formSchema: FormSchema = {
  fields: [
    // 第一步：基本信息
    {
      key: 'step1_basic',
      label: '第一步：基本信息',
      childrenFields: [
        {
          key: 'personalInfo',
          label: '个人基础信息',
          childrenFields: [
            {
              key: 'name',
              label: '姓名',
              control: 'input',
              schema: z.string()
                .min(2, '姓名至少2个字符')
                .max(20, '姓名不能超过20个字符')
                .nonempty('请输入姓名'),
              itemProps: { placeholder: '请输入您的真实姓名' }
            },
            {
              key: 'age',
              label: '年龄',
              schema: z.number()
                .int('年龄必须是整数')
                .min(18, '年龄必须在18-65岁之间')
                .max(65, '年龄必须在18-65岁之间'),
              control: AgeSelector
            },
            {
              key: 'gender',
              label: '性别',
              control: 'radio',
              options: [
                { label: '男', value: 'male' },
                { label: '女', value: 'female' },
                { label: '其他', value: 'other' }
              ],
              schema: z.enum(['male', 'female', 'other'], {
                message: '请选择性别'
              })
            }
          ]
        },
        {
          key: 'contactInfo',
          label: '联系方式',
          childrenFields: [
            {
              key: 'email',
              label: '邮箱',
              control: 'input',
              schema: z.string()
                .email('请输入有效的邮箱地址')
                .nonempty('请输入邮箱'),
              itemProps: { placeholder: 'example@email.com' }
            },
            {
              key: 'phone',
              label: '手机号',
              control: 'input',
              schema: z.string()
                .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号')
                .nonempty('请输入手机号'),
              itemProps: { placeholder: '请输入11位手机号' }
            }
          ]
        }
      ]
    },
    
    // 第二步：职业信息
    {
      key: 'step2_career',
      label: '第二步：职业信息',
      initialVisible: false,
      childrenFields: [
        {
          key: 'userType',
          label: '用户类型',
          control: 'radio',
          options: [
            { label: '学生', value: 'student' },
            { label: '在职人员', value: 'employee' },
            { label: '自由职业者', value: 'freelancer' },
            { label: '企业主', value: 'business_owner' }
          ],
          schema: z.enum(['student', 'employee', 'freelancer', 'business_owner'], {
            message: '请选择用户类型'
          })
        },
        
        // 学生信息（动态显示）
        {
          key: 'studentInfo',
          label: '学生信息',
          initialVisible: false,
          childrenFields: [
            {
              key: 'school',
              label: '学校名称',
              control: 'input',
              schema: z.string().nonempty('请输入学校名称'),
              itemProps: { placeholder: '请输入学校全称' }
            },
            {
              key: 'major',
              label: '专业',
              control: 'input',
              schema: z.string().nonempty('请输入专业'),
              itemProps: { placeholder: '请输入专业名称' }
            },
            {
              key: 'grade',
              label: '年级',
              control: 'radio',
              schema: z.string(),
              options: [
                { label: '大一', value: 'freshman' },
                { label: '大二', value: 'sophomore' },
                { label: '大三', value: 'junior' },
                { label: '大四', value: 'senior' },
                { label: '研究生', value: 'graduate' }
              ]
            }
          ]
        },
        
        // 在职信息（动态显示）
        {
          key: 'employeeInfo',
          label: '在职信息',
          initialVisible: false,
          childrenFields: [
            {
              key: 'company',
              label: '公司名称',
              control: 'input',
              schema: z.string().nonempty('请输入公司名称'),
              itemProps: { placeholder: '请输入公司全称' }
            },
            {
              key: 'position',
              label: '职位',
              control: 'input',
              schema: z.string().nonempty('请输入职位'),
              itemProps: { placeholder: '请输入您的职位' }
            },
            {
              key: 'workYears',
              label: '工作年限',
              schema: z.number().min(0).max(40),
              control: SliderSelector,
              itemProps: { min: 0, max: 40, step: 1, suffix: '年' }
            },
            {
              key: 'salary',
              label: '薪资水平',
              control: 'radio',
              options: [
                { label: '5K以下', value: 'below_5k' },
                { label: '5K-10K', value: '5k_10k' },
                { label: '10K-20K', value: '10k_20k' },
                { label: '20K-50K', value: '20k_50k' },
                { label: '50K以上', value: 'above_50k' }
              ]
            }
          ]
        },
        
        // 企业主信息（动态显示）
        {
          key: 'businessInfo',
          label: '企业信息',
          initialVisible: false,
          childrenFields: [
            {
              key: 'companyName',
              label: '企业名称',
              control: 'input',
              schema: z.string().nonempty('请输入企业名称'),
              itemProps: { placeholder: '请输入企业全称' }
            },
            {
              key: 'industry',
              label: '所属行业',
              control: 'radio',
              options: [
                { label: '互联网/IT', value: 'internet' },
                { label: '金融', value: 'finance' },
                { label: '教育', value: 'education' },
                { label: '制造业', value: 'manufacturing' },
                { label: '服务业', value: 'service' },
                { label: '其他', value: 'other' }
              ]
            },
            {
              key: 'companySize',
              label: '企业规模',
              control: 'radio',
              options: [
                { label: '1-10人', value: 'small' },
                { label: '11-50人', value: 'medium' },
                { label: '51-200人', value: 'large' },
                { label: '200人以上', value: 'enterprise' }
              ]
            }
          ]
        }
      ]
    },
    
    // 第三步：偏好设置
    {
      key: 'step3_preferences',
      label: '第三步：偏好与评价',
      initialVisible: false,
      childrenFields: [
        {
          key: 'interests',
          label: '兴趣爱好',
          control: TagSelector,
          schema: z.array(z.string())
            .min(2, '请至少选择2个兴趣爱好')
            .max(8, '最多选择8个兴趣爱好'),
          options: [
            { label: '编程技术', value: 'programming' },
            { label: '产品设计', value: 'design' },
            { label: '数据分析', value: 'data_analysis' },
            { label: '人工智能', value: 'ai' },
            { label: '区块链', value: 'blockchain' },
            { label: '云计算', value: 'cloud' },
            { label: '网络安全', value: 'security' },
            { label: '移动开发', value: 'mobile' },
            { label: '前端开发', value: 'frontend' },
            { label: '后端开发', value: 'backend' }
          ]
        },
        {
          key: 'skillLevel',
          label: '技能水平',
          control: RatingSelector,
          itemProps: { max: 10 },
          schema: z.number().min(1, '请评估您的技能水平').max(10)
        },
        {
          key: 'learningGoal',
          label: '学习目标',
          control: SliderSelector,
          itemProps: { min: 1, max: 12, step: 1, suffix: '个月' }
        },
        {
          key: 'notifications',
          label: '通知设置',
          childrenFields: [
            {
              key: 'emailNotification',
              label: '邮件通知',
              schema: z.boolean(),
              control: SwitchSelector,
              itemProps: { label: '接收邮件通知' }
            },
            {
              key: 'smsNotification',
              label: '短信通知',
              schema: z.boolean(),
              control: SwitchSelector,
              itemProps: { label: '接收短信通知' }
            },
            {
              key: 'pushNotification',
              label: '推送通知',
              schema: z.boolean(),
              control: SwitchSelector,
              itemProps: { label: '接收推送通知' }
            }
          ]
        }
      ]
    },
    
    // 第四步：附加信息
    {
      key: 'step4_additional',
      label: '第四步：附加信息',
      initialVisible: false,
      childrenFields: [
        {
          key: 'feedback',
          label: '用户反馈',
          childrenFields: [
            {
              key: 'satisfaction',
              label: '整体满意度',
              control: RatingSelector,
              itemProps: { max: 5 }
            },
            {
              key: 'recommendation',
              label: '推荐指数',
              control: SliderSelector,
              itemProps: { min: 0, max: 10, step: 0.5, suffix: '分' }
            },
            {
              key: 'comments',
              label: '意见建议',
              schema: z.string().optional(),
              control: 'input',
              itemProps: {
                placeholder: '请输入您的意见和建议...',
                type: 'textarea',
                rows: 4
              }
            }
          ]
        },
        {
          key: 'privacy',
          label: '隐私设置',
          childrenFields: [
            {
              key: 'dataSharing',
              label: '数据共享',
              schema: z.boolean(),
              control: SwitchSelector,
              itemProps: { label: '同意数据用于产品改进' }
            },
            {
              key: 'marketing',
              label: '营销推广',
              schema: z.boolean(),
              control: SwitchSelector,
              itemProps: { label: '同意接收营销信息' }
            }
          ]
        }
      ]
    }
  ]
};
const model = new FormModel(formSchema);

// 复杂的响应式规则系统

// 规则1：基本信息完整性检查和步骤控制
model.registerRule(({ get, set }) => {
  const name = get(['step1_basic', 'personalInfo', 'name']);
  const age = get(['step1_basic', 'personalInfo', 'age']);
  const gender = get(['step1_basic', 'personalInfo', 'gender']);
  const email = get(['step1_basic', 'contactInfo', 'email']);
  const phone = get(['step1_basic', 'contactInfo', 'phone']);

  // 当第一步基本信息填写完整时，自动解锁第二步
  const isStep1Complete = name && age && gender && email && phone;
  if (isStep1Complete) {
    set(['step2_career'], 'visible', true);
    set(['step1_basic', 'personalInfo', 'name'], 'alertTip', '✅ 基本信息已完整，已解锁职业信息步骤');
  } else {
    set(['step2_career'], 'visible', false);
    set(['step3_preferences'], 'visible', false);
    set(['step4_additional'], 'visible', false);
    set(['step1_basic', 'personalInfo', 'name'], 'alertTip', '请完整填写基本信息以解锁下一步');
  }
});

// 规则2：根据用户类型动态显示相应信息区块
model.registerRule(({ get, set }) => {
  const userType = get(['step2_career', 'userType']);

  // 重置所有职业信息区块的可见性
  set(['step2_career', 'studentInfo'], 'visible', false);
  set(['step2_career', 'employeeInfo'], 'visible', false);
  set(['step2_career', 'businessInfo'], 'visible', false);

  if (userType === 'student') {
    set(['step2_career', 'studentInfo'], 'visible', true);
    set(['step2_career', 'userType'], 'alertTip', '👨‍🎓 学生用户，请填写学校相关信息');
  } else if (userType === 'employee') {
    set(['step2_career', 'employeeInfo'], 'visible', true);
    set(['step2_career', 'userType'], 'alertTip', '💼 在职用户，请填写工作相关信息');
  } else if (userType === 'business_owner') {
    set(['step2_career', 'businessInfo'], 'visible', true);
    set(['step2_career', 'userType'], 'alertTip', '🏢 企业主用户，请填写企业相关信息');
  } else if (userType === 'freelancer') {
    set(['step2_career', 'userType'], 'alertTip', '🎯 自由职业者，暂无需填写额外信息');
  } else {
    set(['step2_career', 'userType'], 'alertTip', undefined);
  }
});

// 规则3：职业信息完整性检查
model.registerRule(({ get, set }) => {
  const userType = get(['step2_career', 'userType']);
  let isStep2Complete = false;

  if (userType === 'student') {
    const school = get(['step2_career', 'studentInfo', 'school']);
    const major = get(['step2_career', 'studentInfo', 'major']);
    isStep2Complete = school && major;
  } else if (userType === 'employee') {
    const company = get(['step2_career', 'employeeInfo', 'company']);
    const position = get(['step2_career', 'employeeInfo', 'position']);
    isStep2Complete = company && position;
  } else if (userType === 'business_owner') {
    const companyName = get(['step2_career', 'businessInfo', 'companyName']);
    const industry = get(['step2_career', 'businessInfo', 'industry']);
    isStep2Complete = companyName && industry;
  } else if (userType === 'freelancer') {
    isStep2Complete = true; // 自由职业者不需要额外信息
  }

  if (isStep2Complete && userType) {
    set(['step3_preferences'], 'visible', true);
    set(['step2_career', 'userType'], 'alertTip', '✅ 职业信息已完整，已解锁偏好设置步骤');
  } else {
    set(['step3_preferences'], 'visible', false);
    set(['step4_additional'], 'visible', false);
  }
});

// 规则4：年龄相关的动态提示和选项调整
model.registerRule(({ get, set }) => {
  const age = get(['step1_basic', 'personalInfo', 'age']);
  
  if (age && age < 25) {
    set(['step1_basic', 'personalInfo', 'age'], 'alertTip', '🌟 年轻有为！建议多关注技能学习相关内容');
    // 为年轻用户调整兴趣选项，突出学习相关的
    set(['step3_preferences', 'interests'], 'alertTip', '推荐年轻用户多关注新兴技术领域');
  } else if (age && age >= 25 && age < 35) {
    set(['step1_basic', 'personalInfo', 'age'], 'alertTip', '💪 正值黄金年龄！可以考虑更多职业发展机会');
  } else if (age && age >= 35) {
    set(['step1_basic', 'personalInfo', 'age'], 'alertTip', '🎯 经验丰富！建议关注管理和领导力相关内容');
  }
});

// 规则5：薪资水平与技能水平的联动检查
model.registerRule(({ get, set }) => {
  const salary = get(['step2_career', 'employeeInfo', 'salary']);
  const skillLevel = get(['step3_preferences', 'skillLevel']);
  
  if (salary && skillLevel) {
    const highSalary = ['20k_50k', 'above_50k'].includes(salary);
    const lowSkill = skillLevel < 5;
    
    if (highSalary && lowSkill) {
      set(['step3_preferences', 'skillLevel'], 'alertTip', '🤔 高薪资但技能水平较低？建议重新评估或加强学习');
    } else if (!highSalary && skillLevel >= 8) {
      set(['step3_preferences', 'skillLevel'], 'alertTip', '💡 技能水平很高！可以考虑寻求更好的职业机会');
    } else {
      set(['step3_preferences', 'skillLevel'], 'alertTip', undefined);
    }
  }
});

// 规则6：兴趣爱好与学习目标的智能推荐
model.registerRule(({ get, set }) => {
  const interests = get(['step3_preferences', 'interests']) || [];
  const learningGoal = get(['step3_preferences', 'learningGoal']);
  
  if (interests.length > 0) {
    if (interests.includes('ai') || interests.includes('data_analysis')) {
      set(['step3_preferences', 'learningGoal'], 'alertTip', '🤖 AI/数据分析学习建议：6-12个月较为合适');
    } else if (interests.includes('frontend') || interests.includes('backend')) {
      set(['step3_preferences', 'learningGoal'], 'alertTip', '💻 编程开发学习建议：3-8个月可以入门');
    } else if (interests.includes('design')) {
      set(['step3_preferences', 'learningGoal'], 'alertTip', '🎨 设计学习建议：2-6个月可以掌握基础');
    }
  }
  
  if (learningGoal && learningGoal > 6) {
    const currentTip = model.get(['step3_preferences', 'learningGoal'], 'alertTip');
    set(['step3_preferences', 'learningGoal'], 'alertTip', 
      (currentTip || '') + ' 📚 长期学习计划很棒！');
  }
});

// 规则7：通知设置的智能建议
model.registerRule(({ get, set }) => {
  const emailNotification = get(['step3_preferences', 'notifications', 'emailNotification']);
  const smsNotification = get(['step3_preferences', 'notifications', 'smsNotification']);
  const pushNotification = get(['step3_preferences', 'notifications', 'pushNotification']);
  
  const notificationCount = [emailNotification, smsNotification, pushNotification].filter(Boolean).length;
  
  if (notificationCount === 0) {
    set(['step3_preferences', 'notifications', 'emailNotification'], 'alertTip', 
      '📢 建议至少开启一种通知方式，以便及时获取重要信息');
  } else if (notificationCount === 3) {
    set(['step3_preferences', 'notifications', 'pushNotification'], 'alertTip', 
      '✅ 全部通知已开启，您将获得最及时的信息推送');
  } else {
    set(['step3_preferences', 'notifications', 'emailNotification'], 'alertTip', undefined);
    set(['step3_preferences', 'notifications', 'pushNotification'], 'alertTip', undefined);
  }
});

// 规则8：偏好设置完整性检查
model.registerRule(({ get, set }) => {
  const interests = get(['step3_preferences', 'interests']);
  const skillLevel = get(['step3_preferences', 'skillLevel']);
  const emailNotification = get(['step3_preferences', 'notifications', 'emailNotification']);
  
  const isStep3Complete = interests && interests.length >= 2 && skillLevel && skillLevel > 0;
  
  if (isStep3Complete) {
    set(['step4_additional'], 'visible', true);
    const currentTip = model.get(['step3_preferences', 'interests'], 'alertTip');
    set(['step3_preferences', 'interests'], 'alertTip', 
      (currentTip || '') + ' ✅ 偏好设置已完整，已解锁最终步骤');
  } else {
    set(['step4_additional'], 'visible', false);
  }
});

// 规则9：满意度与推荐指数的一致性检查
model.registerRule(({ get, set }) => {
  const satisfaction = get(['step4_additional', 'feedback', 'satisfaction']);
  const recommendation = get(['step4_additional', 'feedback', 'recommendation']);
  
  if (satisfaction && recommendation) {
    // 将5星制转换为10分制进行比较
    const normalizedSatisfaction = satisfaction * 2;
    const diff = Math.abs(normalizedSatisfaction - recommendation);
    
    if (diff > 3) {
      set(['step4_additional', 'feedback', 'recommendation'], 'alertTip', 
        '🤔 推荐指数与满意度差异较大，请重新确认评分');
    } else {
      set(['step4_additional', 'feedback', 'recommendation'], 'alertTip', undefined);
    }
  }
});

// 规则10：隐私设置的智能提醒
model.registerRule(({ get, set }) => {
  const dataSharing = get(['step4_additional', 'privacy', 'dataSharing']);
  const marketing = get(['step4_additional', 'privacy', 'marketing']);
  const age = get(['step1_basic', 'personalInfo', 'age']);
  
  if (age && age < 25 && !dataSharing) {
    set(['step4_additional', 'privacy', 'dataSharing'], 'alertTip', 
      '💡 年轻用户建议开启数据共享，有助于获得更个性化的服务');
  } else if (dataSharing && !marketing) {
    set(['step4_additional', 'privacy', 'marketing'], 'alertTip', 
      '📧 已同意数据共享，是否也接收相关的营销信息？');
  }
});

// 初始化执行所有规则
model.runAllRules();
export default function DynamicFormDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  
  // 创建表单模型
  const form = useDynamicForm(model);

  // 获取要显示的字段路径（所有叶子节点）
  const displayFields = model.getAllLeafPaths();

  // 定义步骤配置，用于步骤导航显示
  const steps = [
    {
      title: '基本信息',
      description: '填写个人基础信息',
      key: 'step1_basic'
    },
    {
      title: '职业信息', 
      description: '选择用户类型并填写相关信息',
      key: 'step2_career'
    },
    {
      title: '偏好设置',
      description: '设置兴趣爱好和通知偏好',
      key: 'step3_preferences'
    },
    {
      title: '完成',
      description: '提供反馈和隐私设置',
      key: 'step4_additional'
    }
  ];

  // // 根据当前可见的步骤来更新步骤导航
  // React.useEffect(() => {
  //   const snapshot = model.getSnapshot();
  //   let maxVisibleStep = 0;
    
  //   steps.forEach((step, index) => {
  //     const stepNode = snapshot.find(node => node.key === step.key);
  //     if (stepNode?.state?.visible !== false) {
  //       maxVisibleStep = index;
  //     }
  //   });
    
  //   // 自动跳转到最新解锁的步骤
  //   if (maxVisibleStep > currentStep) {
  //     setCurrentStep(maxVisibleStep);
  //   }
  // }, [model.getSnapshot(), currentStep]);

  // 验证当前步骤
  const validateCurrentStep = async () => {
    try {
      const currentStepFields = displayFields.filter(path => {
        const currentStepKey = steps[currentStep]?.key;
        return currentStepKey ? path[0] === currentStepKey : true;
      }).filter(field => {
        try {
          return model.get(field, 'visible');
        } catch {
          return false;
        }
      });
      
      if (currentStepFields.length > 0) {
        await model.validateFields(currentStepFields);
      }
      return true;
    } catch (error) {
      console.log('当前步骤验证失败:', error);
      return false;
    }
  };

  const handleFinish = (values: Record<string, FieldValue>) => {
    console.log('🎉 表单提交值:', values);
    console.log('📊 内部模型数据:', model.getJSONData());

    // 模拟提交成功的反馈
    const allData = model.getJSONData();
    let summary = '表单提交成功！\n\n📋 数据概览：\n';
    
    if (allData.step1_basic?.personalInfo) {
      const info = allData.step1_basic.personalInfo;
      summary += `👤 姓名：${info.name}，年龄：${info.age}岁\n`;
    }
    
    if (allData.step2_career?.userType) {
      const typeMap: Record<string, string> = {
        'student': '学生',
        'employee': '在职人员', 
        'freelancer': '自由职业者',
        'business_owner': '企业主'
      };
      summary += `💼 用户类型：${typeMap[allData.step2_career.userType] || allData.step2_career.userType}\n`;
    }
    
    if (allData.step3_preferences?.interests) {
      summary += `🎯 兴趣数量：${allData.step3_preferences.interests.length}个\n`;
    }
    
    alert(summary);
  };

  const handleStepChange = (step: number) => {
    // 检查目标步骤是否可见（已解锁）
    const snapshot = model.getSnapshot();
    const targetStepKey = steps[step]?.key;
    const targetStepNode = snapshot.find(node => node.key === targetStepKey);
    
    if (targetStepNode?.state?.visible !== false || step === 0) {
      setCurrentStep(step);
    }
  };

  // 高级批量操作演示功能
  const advancedOperations = {
    // 模拟数据预填充
    fillSampleData: () => {
      const sampleData = {
        step1_basic: {
          personalInfo: {
            name: '张三',
            age: 28,
            gender: 'male'
          },
          contactInfo: {
            email: 'zhangsan@example.com',
            phone: '13812345678'
          }
        }
      };
      
      // 使用hook的setFieldsValue方法批量设置
      form.setFieldsValue(sampleData);
      alert('✅ 已填充示例数据');
    },
    
    // 重置所有数据
    resetAllData: () => {
      const allLeafPaths = model.getAllLeafPaths();
      allLeafPaths.forEach(path => {
        model.set(path, 'value', undefined);
        model.set(path, 'errorMessage', undefined);
      });
      setCurrentStep(0);
      alert('🔄 已重置所有数据');
    },
    
    // 批量设置警告提示
    setGlobalAlert: () => {
      model.set(['step1_basic'], 'alertTip', '⚠️ 全局提示：请认真填写所有信息');
      model.set(['step2_career'], 'alertTip', '⚠️ 全局提示：职业信息将影响推荐内容');
      alert('📢 已设置全局警告提示');
    },
    
    // 清除所有警告提示
    clearAllAlerts: () => {
      const allLeafPaths = model.getAllLeafPaths();
      allLeafPaths.forEach(path => {
        model.set(path, 'alertTip', undefined);
      });
      model.set(['step1_basic'], 'alertTip', undefined);
      model.set(['step2_career'], 'alertTip', undefined);
      alert('🧹 已清除所有警告提示');
    },
    
    // 验证当前步骤
    validateCurrentStep: async () => {
      const isValid = await validateCurrentStep();
      if (isValid) {
        alert(`✅ 当前步骤 "${steps[currentStep].title}" 验证通过！`);
      } else {
        alert(`❌ 当前步骤存在验证错误，请检查红色错误提示`);
      }
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Card title="🚀 高级动态表单生成器 - 多步骤长表单演示" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3>🌟 核心功能展示：</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <Card size="small" title="📊 数据架构" bordered={false}>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li><strong>深度嵌套：</strong>支持4层嵌套结构</li>
                <li><strong>步骤控制：</strong>根据完整性自动解锁</li>
                <li><strong>类型安全：</strong>TypeScript完整支持</li>
              </ul>
            </Card>
            
            <Card size="small" title="🎛️ 自定义组件" bordered={false}>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li><strong>评分组件：</strong>星级和滑块评分</li>
                <li><strong>标签选择：</strong>多选标签可视化</li>
                <li><strong>开关组件：</strong>带标签的开关选择</li>
              </ul>
            </Card>
            
            <Card size="small" title="⚡ 响应式规则" bordered={false}>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li><strong>10+条规则：</strong>覆盖各种业务场景</li>
                <li><strong>智能提示：</strong>动态警告和建议</li>
                <li><strong>联动检查：</strong>跨步骤数据验证</li>
              </ul>
            </Card>
            
            <Card size="small" title="🔧 高级功能" bordered={false}>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li><strong>批量操作：</strong>支持非叶子节点设置</li>
                <li><strong>实时验证：</strong>输入时即时校验</li>
                <li><strong>步骤导航：</strong>智能解锁机制</li>
              </ul>
            </Card>
          </div>
        </div>

        <Divider />

        <div style={{ marginBottom: '16px' }}>
          <strong>🎮 高级操作演示：</strong>
          <div style={{ marginTop: '12px' }}>
            <Space wrap size="middle">
              <Button type="primary" ghost onClick={advancedOperations.fillSampleData}>
                📝 填充示例数据
              </Button>
              <Button onClick={advancedOperations.validateCurrentStep}>
                ✅ 验证当前步骤
              </Button>
              <Button type="dashed" onClick={advancedOperations.setGlobalAlert}>
                📢 设置全局提示
              </Button>
              <Button type="dashed" onClick={advancedOperations.clearAllAlerts}>
                🧹 清除所有提示
              </Button>
              <Button danger ghost onClick={advancedOperations.resetAllData}>
                🔄 重置所有数据
              </Button>
            </Space>
          </div>
        </div>

        <Divider />

        <div>
          <strong>📋 使用说明：</strong>
          <ol style={{ marginTop: '8px', marginBottom: 0 }}>
            <li><strong>步骤解锁：</strong>完整填写当前步骤后自动解锁下一步骤</li>
            <li><strong>用户类型：</strong>选择不同类型查看动态字段显示</li>
            <li><strong>智能提示：</strong>注意观察蓝色提示和红色错误信息</li>
            <li><strong>数据联动：</strong>年龄、薪资、技能水平等字段互相影响</li>
            <li><strong>实时反馈：</strong>所有操作都有相应的提示信息</li>
          </ol>
        </div>
      </Card>

      {/* 步骤导航 */}
      <Card style={{ marginBottom: '20px' }}>
        <Steps
          current={currentStep}
          onChange={handleStepChange}
          items={steps.map((step, index) => ({
            title: step.title,
            description: step.description,
            disabled: index > 0 && !model.getSnapshot().find(node => node.key === step.key)?.state?.visible
          }))}
        />
      </Card>

      {/* 主表单区域 */}
      <Generator
        model={model}
        displayFields={displayFields.filter(path => {
          // 只显示当前步骤的字段
          const currentStepKey = steps[currentStep]?.key;
          return currentStepKey ? path[0] === currentStepKey : true;
        })}
      />

      {/* 步骤控制按钮 */}
      <Card style={{ marginTop: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px 0'
        }}>
          <Button 
            size="large"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            style={{ minWidth: '100px' }}
          >
            ← 上一步
          </Button>
          
          <div style={{ 
            textAlign: 'center', 
            color: '#666',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            <div>步骤 {currentStep + 1} / {steps.length}</div>
            <div style={{ fontSize: '14px', marginTop: '4px', color: '#1890ff' }}>
              {steps[currentStep]?.title}
            </div>
          </div>
          
          {currentStep === steps.length - 1 ? (
            <Button 
              type="primary"
              size="large"
              style={{ 
                minWidth: '100px',
                backgroundColor: '#52c41a',
                borderColor: '#52c41a'
              }}
              onClick={async () => {
                const isValid = await validateCurrentStep();
                if (isValid) {
                  // 如果验证通过，提交表单
                  handleFinish(model.getJSONData());
                } else {
                  alert('❌ 当前步骤存在验证错误，请检查红色错误提示');
                }
              }}
            >
              🎉 提交
            </Button>
          ) : (
            <Button 
              type="primary"
              size="large"
              style={{ minWidth: '100px' }}
              onClick={async () => {
                // 先验证当前步骤
                const isValid = await validateCurrentStep();
                if (!isValid) {
                  alert('❌ 当前步骤存在验证错误，请检查后再进入下一步');
                  return;
                }
                
                const nextStep = currentStep + 1;
                const nextStepKey = steps[nextStep]?.key;
                const nextStepNode = model.getSnapshot().find(node => node.key === nextStepKey);
                
                if (nextStepNode?.state?.visible !== false) {
                  setCurrentStep(nextStep);
                } else {
                  alert('⚠️ 下一步骤尚未解锁，请完成当前步骤的所有必填字段');
                }
              }}
            >
              下一步 →
            </Button>
          )}
        </div>
      </Card>

      {/* 调试和操作面板 */}
      <Card title="🔧 开发者面板" style={{ marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div>
            <h4>📊 表单状态</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block
                onClick={() => console.log('📸 快照数据:', model.getSnapshot())}
              >
                打印快照数据
              </Button>
              <Button 
                block
                onClick={() => console.log('📋 JSON数据:', model.getJSONData())}
              >
                打印JSON数据
              </Button>
              <Button 
                block
                onClick={() => console.log('🍃 叶子路径:', model.getAllLeafPaths())}
              >
                打印叶子路径
              </Button>
            </Space>
          </div>
          
          <div>
            <h4>🎯 表单操作</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block
                type="primary"
                onClick={() => {
                  model.validateAllFields()
                    .then(() => alert('🎉 全部验证通过！'))
                    .catch(() => alert('❌ 存在验证错误'));
                }}
              >
                验证整个表单
              </Button>
              <Button 
                block
                onClick={() => {
                  const data = model.getJSONData();
                  navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
                  alert('📋 数据已复制到剪贴板');
                }}
              >
                复制表单数据
              </Button>
            </Space>
          </div>
          
          <div>
            <h4>⚙️ 步骤控制</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>当前步骤: {currentStep + 1}/4</div>
              <div>步骤名称: {steps[currentStep]?.title}</div>
              <Space>
                <Button 
                  size="small"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                >
                  上一步
                </Button>
                <Button 
                  size="small"
                  disabled={currentStep === steps.length - 1}
                  onClick={() => {
                    const nextStep = currentStep + 1;
                    const nextStepKey = steps[nextStep]?.key;
                    const nextStepNode = model.getSnapshot().find(node => node.key === nextStepKey);
                    if (nextStepNode?.state?.visible !== false) {
                      setCurrentStep(nextStep);
                    } else {
                      alert('⚠️ 下一步骤尚未解锁，请完成当前步骤');
                    }
                  }}
                >
                  下一步
                </Button>
              </Space>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  );
}