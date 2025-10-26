"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  Button,
  Card,
  Flex,
  Space,
  Typography,
  message,
  InputNumber,
} from "antd";
import { z } from "zod";
import { FormModel, FieldSchema, FieldPath } from "@/utils/structures";
import { Generator, useDynamicForm } from "@/utils/generator";

const { Title, Paragraph, Text } = Typography;

// AntD 数字输入适配器
const NumberInput: React.FC<{
  value?: number | undefined;
  onChange?: (v: number | undefined) => void;
  status?: "error" | undefined;
  disabled?: boolean;
  size?: "small" | undefined;
  id?: string;
  [key: string]: any;
}> = ({ value, onChange, status, disabled, size, id, ...rest }) => {
  return (
    <InputNumber
      id={id}
      value={value}
      onChange={(v) => onChange?.(v ?? undefined)}
      disabled={disabled}
      status={status}
      size={size}
      style={{ width: "100%" }}
      {...rest}
    />
  );
};

export default function Page() {
  // 1) 定义“个人 + 学校/公司”的复杂动态表单结构
  const schoolFields: FieldSchema[] = [
    {
      key: "schoolName",
      label: "学校名称",
      control: "input",
      validate: z.string().min(2, "至少2个字符"),
    },
    {
      key: "schoolEmail",
      label: "学校邮箱",
      control: "input",
      validate: z.string().email("邮箱格式不正确"),
    },
    {
      key: "grade",
      label: "年级(1-12)",
      control: NumberInput,
      itemProps: { min: 1, max: 12, precision: 0 },
      validate: z.coerce.number().int().min(1).max(12),
    },
    {
      key: "enrolDate",
      label: "入学日期(YYYY-MM-DD)",
      control: "input",
      validate: z.string().min(1, "必填"),
    },
    {
      key: "graduationDate",
      label: "毕业日期(YYYY-MM-DD)",
      control: "input",
      validate: z.string().min(1, "必填"),
    },
  ];

  const companyFields: FieldSchema[] = [
    {
      key: "companyName",
      label: "公司名称",
      control: "input",
      validate: z.string().min(2, "至少2个字符"),
    },
    {
      key: "workEmail",
      label: "工作邮箱",
      control: "input",
      validate: z.string().email("邮箱格式不正确"),
    },
    {
      key: "position",
      label: "职位",
      control: "input",
      validate: z.string().min(2, "至少2个字符"),
    },
    {
      key: "hireDate",
      label: "入职日期(YYYY-MM-DD)",
      control: "input",
      validate: z.string().min(1, "必填"),
    },
    {
      key: "salary",
      label: "月薪(元)",
      control: NumberInput,
      itemProps: { min: 0, precision: 0 },
      validate: z.coerce.number().min(0, ">=0"),
    },
    {
      key: "probationMonths",
      label: "试用期(月)",
      control: NumberInput,
      itemProps: { min: 0, max: 12, precision: 0 },
      validate: z.coerce.number().int().min(0).max(12),
    },
  ];

  const schema: { fields: FieldSchema[] } = useMemo(
    () => ({
      fields: [
        {
          key: "role",
          label: "身份类型",
          control: "select",
          options: [
            { label: "学生", value: "student" },
            { label: "员工", value: "employee" },
          ],
          validate: z.string().min(1, "请选择身份"),
          defaultValue: "student",
        },
        {
          key: "person",
          label: "个人信息",
          childrenFields: [
            {
              key: "fullName",
              label: "姓名",
              control: "input",
              validate: z
                .string()
                .min(2, "至少2个字符")
                .max(30, "最多30个字符"),
              defaultValue: "",
            },
            {
              key: "birthDate",
              label: "出生日期(YYYY-MM-DD)",
              control: "input",
              validate: z.string().min(1, "必填"),
            },
            {
              key: "age",
              label: "年龄",
              control: NumberInput,
              itemProps: { min: 0, max: 120, precision: 0 },
              validate: z.coerce.number().int().min(0).max(120),
            },
            {
              key: "email",
              label: "个人邮箱",
              control: "input",
              validate: z.string().email("邮箱格式不正确"),
            },
            {
              key: "phone",
              label: "手机号",
              control: "input",
              validate: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
            },
            {
              key: "emergencyPhone",
              label: "紧急联系电话",
              control: "input",
              validate: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
            },
            {
              key: "idNumber",
              label: "身份证号(18位)",
              control: "input",
              validate: z.string().regex(/^\d{17}[\dXx]$/, "身份证格式不正确"),
            },
          ],
        },
        {
          key: "orgInfo",
          label: "学校/公司信息（动态）",
          isArray: true,
          childrenFields: schoolFields,
        },
        {
          key: "note",
          label: "说明",
          control: "input",
          validate: z.string().optional(),
          defaultValue: "复杂跨字段校验 + 动态子结构 Demo",
          disabled: true,
        },
      ],
    }),
    []
  );

  // 2) 构建 Model（只初始化一次）
  const modelRef = useRef<FormModel>();
  if (!modelRef.current) {
    modelRef.current = new FormModel(schema);
  }
  const model = modelRef.current;

  // 3) 注册响应式规则（动态子结构 + 跨字段校验，直接使用 setValidation + z.refine）
  useEffect(() => {
    // 3.1 身份切换：动态切换 orgInfo 的子结构（学校/公司）
    const unreg1 = model.registerRule((ctx) => {
      const role = ctx.get(["role"]);
      console.log(99);

      ctx.updateChildren(
        ["orgInfo"],
        role === "employee" ? companyFields : schoolFields,
        { keepPreviousData: true, shouldTriggerRule: true }
      );
    });

    // 3.2 个人信息跨字段校验：年龄与出生日期、紧急联系电话不等于本人电话、身份证与生日匹配
    const unreg2 = model.registerRule((ctx) => {
      const birth = ctx.get(["person", "birthDate"]);
      const phone = ctx.get(["person", "phone"]);
      const idNo = ctx.get(["person", "idNumber"]);

      // 年龄与出生年份大致匹配（±1 年容差）
      try {
        ctx.setValidation(
          ["person", "age"],
          z.coerce
            .number()
            .int()
            .min(0)
            .max(120)
            .refine((age) => {
              const t = Date.parse(String(birth ?? ""));
              if (Number.isNaN(t)) return true;
              const by = new Date(t).getFullYear();
              const nowY = new Date().getFullYear();
              const expect = nowY - by;
              return Math.abs((age ?? 0) - expect) <= 1;
            }, "年龄与出生日期不匹配")
        );
      } catch {}

      // 紧急电话不得等于本人电话
      try {
        ctx.setValidation(
          ["person", "emergencyPhone"],
          z
            .string()
            .regex(/^1\d{10}$/)
            .refine((v) => v !== phone, "紧急联系电话不能与本人手机号相同")
        );
      } catch {}

      // 身份证与出生日期匹配（若为18位身份证，校验其中的生日段 yyyyMMdd）
      try {
        ctx.setValidation(
          ["person", "idNumber"],
          z
            .string()
            .regex(/^\d{17}[\dXx]$/)
            .refine((v) => {
              const b = String(birth ?? "");
              if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return true;
              const ymd = b.replace(/-/g, "");
              const seg = v.slice(6, 14);
              return seg === ymd;
            }, "身份证中的出生日期与填写的不一致")
        );
      } catch {}

      // 未成年人提示，且禁用公司薪资字段
      try {
        const age = ctx.get(["person", "age"]);
        ctx.get(["orgInfo"]); // 依赖数组根
        if (typeof age === "number" && age < 18) {
          ctx.setAlertTip(
            ["person", "age"],
            <Text>未成年人：部分公司字段可能被禁用</Text>
          );
          ctx.setDisable(["orgInfo", "salary"], true);
        } else {
          ctx.setAlertTip(["person", "age"], undefined);
          ctx.setDisable(["orgInfo", "salary"], false);
        }
      } catch {}
    });

    // 3.3 学校/公司分场景校验（只能监听 orgInfo 根；读取子字段不作为依赖）
    const unreg3 = model.registerRule((ctx) => {
      const role = ctx.get(["role"]);
      ctx.get(["orgInfo"]);

      if (role === "student") {
        const enrol = ctx.get(["orgInfo", "enrolDate"], false);
        const grad = ctx.get(["orgInfo", "graduationDate"], false);
        const grade = ctx.get(["orgInfo", "grade"], false);
        const personAge = ctx.get(["person", "age"], false);
        const personalEmail = ctx.get(["person", "email"], false);
        const schoolEmail = ctx.get(["orgInfo", "schoolEmail"], false);

        const parse = (s: any) => {
          const t = Date.parse(String(s ?? ""));
          return Number.isNaN(t) ? undefined : new Date(t);
        };
        const e1 = parse(enrol);
        const e2 = parse(grad);

        ctx.setValidation(
          ["orgInfo", "graduationDate"],
          z
            .string()
            .min(1, "必填")
            .refine(() => !!e1 && !!e2 && e2! >= e1!, "毕业日期不得早于入学")
        );

        ctx.setValidation(
          ["orgInfo", "grade"],
          z.coerce
            .number()
            .int()
            .min(1)
            .max(12)
            .refine(
              (g) =>
                typeof personAge === "number"
                  ? g <= Math.max(1, personAge - 5)
                  : true,
              "年级与年龄不匹配"
            )
        );

        ctx.setValidation(
          ["orgInfo", "schoolEmail"],
          z
            .string()
            .email()
            .refine((v) => v !== personalEmail, "学校邮箱不能与个人邮箱相同")
            .refine(
              (v) => /\.edu(\.\w+)?$/i.test(v),
              "学校邮箱建议以 .edu 结尾"
            )
        );
      } else if (role === "employee") {
        const hire = ctx.get(["orgInfo", "hireDate"], false);
        const salary = ctx.get(["orgInfo", "salary"], false);
        const workEmail = ctx.get(["orgInfo", "workEmail"], false);
        const personalEmail = ctx.get(["person", "email"], false);
        const birth = ctx.get(["person", "birthDate"], false);

        const parse = (s: any) => {
          const t = Date.parse(String(s ?? ""));
          return Number.isNaN(t) ? undefined : new Date(t);
        };
        const h = parse(hire);
        const b = parse(birth);

        try {
          ctx.setValidation(
            ["orgInfo", "hireDate"],
            z
              .string()
              .min(1, "必填")
              .refine(() => !!h && !!b && h! > b!, "入职日期必须晚于出生日期")
          );
        } catch {}

        try {
          ctx.setValidation(
            ["orgInfo", "probationMonths"],
            z.coerce
              .number()
              .int()
              .min(0)
              .max(12)
              .refine(
                (m) =>
                  typeof salary === "number" && salary < 3000 ? m <= 6 : true,
                "低薪岗位试用期不得超过6个月"
              )
          );
        } catch {}

        try {
          ctx.setValidation(
            ["orgInfo", "workEmail"],
            z
              .string()
              .email()
              .refine((v) => v !== personalEmail, "工作邮箱不能与个人邮箱相同")
          );
        } catch {}
      }
    });

    model.runAllRules();
    return () => {
      unreg1();
      unreg2();
      unreg3();
    };
  }, [model]);

  // 4) Hook：对外方法（提交、设置值、校验）
  const form = useDynamicForm(model);

  // 5) 测试动作（填充不同场景的数据）
  const fillValidValues = () => {
    // 学生档
    form.setFieldsValue({
      role: "student",
      person: {
        fullName: "李雷",
        birthDate: "2008-05-20",
        age: 17,
        email: "lilei@example.com",
        phone: "13800138000",
        emergencyPhone: "13900139000",
        idNumber: "110101200805200012",
      },
      orgInfo: {
        schoolName: "北京第一中学",
        schoolEmail: "student@school.edu",
        grade: 11,
        enrolDate: "2024-09-01",
        graduationDate: "2027-06-30",
      },
    });
  };

  const fillEdgeValues = () => {
    // 员工档，制造多处跨字段错误
    form.setFieldsValue({
      role: "employee",
      person: {
        fullName: "韩梅梅",
        birthDate: "1995-01-10",
        age: 10,
        email: "han@example.com",
        phone: "13800138001",
        emergencyPhone: "13800138001",
        idNumber: "110101199501100045",
      },
      orgInfo: {
        companyName: "ACME",
        workEmail: "han@example.com",
        position: "Dev",
        hireDate: "1990-01-01",
        salary: 2000,
        probationMonths: 9,
      },
    });
  };

  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，详见控制台");
      // eslint-disable-next-line no-console
      console.log("Submit Data:", data);
    } catch (e) {
      message.error("请检查表单错误");
    }
  };

  const validateCriticalFields = async () => {
    try {
      await form.validateFields([
        ["role"],
        ["person", "fullName"],
        ["person", "age"],
      ] as unknown as FieldPath[]);
      message.success("关键字段校验通过");
    } catch (e) {
      message.error("关键字段校验未通过");
    }
  };

  // 6) 渲染
  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <Title level={3}>个人 + 学校/公司 表单 Demo（动态校验与跨字段）</Title>
      <Paragraph>
        目标：演示 setValidation + z.refine 做跨字段校验，以及通过
        updateChildren 在学校/公司字段集合间切换。
      </Paragraph>

      <Card size="small" title="操作区">
        <Space wrap>
          <Button onClick={fillValidValues}>一键填充（学生，有效）</Button>
          <Button onClick={fillEdgeValues}>一键填充（员工，异常）</Button>
          <Button type="primary" onClick={onSubmit}>
            提交并输出 JSON
          </Button>
          <Button onClick={validateCriticalFields}>校验常用必填</Button>
        </Space>
      </Card>

      <Generator
        model={model}
        size="normal"
        displayFields={[["role"], ["person"], ["orgInfo"], ["note"]]}
        displayOption={{ labelSpan: 5, fieldSpan: 19, showDebug: true }}
      />

      <Card size="small" title="说明">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            role 切换时，orgInfo
            在学校/公司字段集合之间动态切换（保留历史数据）。
          </li>
          <li>
            年龄与出生日期跨字段校验；紧急联系电话不得等于本人手机号；身份证与生日匹配。
          </li>
          <li>
            学生：毕业不得早于入学；年级与年龄匹配；学校邮箱不得与个人邮箱相同，且建议
            .edu 域。
          </li>
          <li>
            员工：入职晚于出生；低薪岗位试用期 ≤ 6
            个月；工作邮箱不得与个人邮箱相同。
          </li>
          <li>未成年人将禁用公司薪资字段，并在年龄字段展示提示。</li>
        </ul>
      </Card>
    </Flex>
  );
}
