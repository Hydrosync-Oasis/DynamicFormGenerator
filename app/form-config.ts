import { FormSchema } from "../utils/legacy-types";
import z from "zod";

// 创建响应式校验规则演示的表单Schema
export const responsiveValidationSchema: FormSchema = {
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