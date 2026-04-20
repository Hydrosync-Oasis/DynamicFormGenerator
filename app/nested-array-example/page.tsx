"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Space, message, Divider } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import {
  Generator,
  useDynamicForm,
  DefaultFieldDisplay,
} from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";
import { FormCommands } from "@/utils/type";

/**
 * 两层嵌套数组示例：部门 -> 员工 -> 项目
 *
 * 数据结构：
 * departments (数组)
 *   └─ employees (数组)
 *        └─ projects (数组)
 */
export default function NestedArrayExamplePage() {
  // HOC：创建标签更宽的Field组件
  const withWiderLabel = (labelSpan: number = 8) => {
    return React.memo((props: any) => {
      return (
        <DefaultFieldDisplay
          {...props}
          displayOption={{
            ...props.displayOption,
            labelSpan,
            fieldSpan: 24 - labelSpan,
          }}
        />
      );
    });
  };

  const WiderLabelField = withWiderLabel(8);
  const ExtraWiderLabelField = withWiderLabel(10);

  // 定义部门数组的Flex布局组件
  const DepartmentsFlexLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: any;
    }) => {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            marginTop: 16,
          }}
        >
          {state.children.map((child: any) => render(child))}
        </div>
      );
    },
  );

  DepartmentsFlexLayout.displayName = "DepartmentsFlexLayout";

  // 定义部门卡片布局组件
  const DepartmentCardLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: any;
    }) => {
      const path = state.path as FieldPath;
      const deptKey = path[path.length - 1];

      // 添加员工的处理函数
      const handleAddEmployee = () => {
        const empKey = `EMP${Date.now()}`;
        // 使用 formCommands.insertIntoArray 添加员工
        // 参数顺序: path, value, position, key
        formCommands.insertIntoArray(
          ["departments", deptKey, "employees"],
          {
            [empKey]: {
              empName: "新员工",
              position: "engineer",
              salary: "15000",
              projects: {},
            },
          },
          "after",
          undefined,
          true,
        );
        message.success(`已为部门 ${deptKey} 添加新员工`);
      };

      return (
        <Card
          size="small"
          title={`📁 部门 - ${deptKey}`}
          extra={
            <Button
              type="link"
              size="small"
              onClick={handleAddEmployee}
              style={{ padding: 0, height: "auto", color: "#1890ff" }}
            >
              ➕ 添加员工
            </Button>
          }
          style={{
            backgroundColor: "#fafafa",
            border: "2px solid #1890ff",
          }}
          headStyle={{
            backgroundColor: "#e6f7ff",
            fontSize: 16,
            fontWeight: 600,
            color: "#1890ff",
          }}
          bodyStyle={{ padding: "16px" }}
        >
          {state.children.map((child: any) => render(child))}
        </Card>
      );
    },
  );

  DepartmentCardLayout.displayName = "DepartmentCardLayout";

  // 定义员工数组的Flex布局组件
  const EmployeesFlexLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: any;
    }) => {
      return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 12,
            marginLeft: 16,
          }}
        >
          {state.children.map((child: any) => render(child))}
        </div>
      );
    },
  );

  EmployeesFlexLayout.displayName = "EmployeesFlexLayout";

  // 定义员工卡片布局组件
  const EmployeeCardLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: FormCommands;
    }) => {
      const path = state.path as FieldPath;
      const empKey = path[path.length - 1];
      const deptKey = path[path.length - 3]; // 获取部门key

      // 添加项目的处理函数
      const handleAddProject = () => {
        const projKey = `PROJ${Date.now()}`;
        // 使用 formCommands.insertIntoArray 添加项目
        // 参数顺序: path, value, position, key
        formCommands.insertIntoArray(
          ["departments", deptKey, "employees", empKey, "projects"],
          {
            [projKey]: {
              projectName: "新项目",
              status: "ongoing",
              progress: "0",
            },
          },
          undefined,
          "after",
        );
        message.success(`已为员工 ${empKey} 添加新项目`);
      };

      return (
        <Card
          size="small"
          title={`👤 员工 - ${empKey}`}
          extra={
            <Button
              type="link"
              size="small"
              onClick={handleAddProject}
              style={{ padding: 0, height: "auto", color: "#52c41a" }}
            >
              ➕ 添加项目
            </Button>
          }
          style={{
            width: 480,
            backgroundColor: "#ffffff",
            border: "1px solid #52c41a",
          }}
          headStyle={{
            backgroundColor: "#f6ffed",
            minHeight: 36,
            fontSize: 14,
            fontWeight: 500,
            color: "#52c41a",
          }}
          bodyStyle={{ padding: "12px" }}
        >
          {state.children.map((child: any) => render(child))}
        </Card>
      );
    },
  );

  EmployeeCardLayout.displayName = "EmployeeCardLayout";

  // 定义项目数组的列表布局组件
  const ProjectsListLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: any;
    }) => {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
            paddingLeft: 12,
            borderLeft: "3px solid #faad14",
          }}
        >
          {state.children.map((child: any) => render(child))}
        </div>
      );
    },
  );

  ProjectsListLayout.displayName = "ProjectsListLayout";

  // 定义项目卡片布局组件
  const ProjectCardLayout = React.memo(
    ({
      render,
      state,
      formCommands,
    }: {
      render: (state: any) => React.ReactNode;
      state: any;
      formCommands: any;
    }) => {
      const path = state.path as FieldPath;
      const projectKey = path[path.length - 1];

      return (
        <Card
          size="small"
          title={`📋 项目 - ${projectKey}`}
          style={{
            backgroundColor: "#fffbf0",
            border: "1px solid #faad14",
          }}
          headStyle={{
            backgroundColor: "#fffbe6",
            minHeight: 32,
            fontSize: 13,
            fontWeight: 500,
            color: "#faad14",
          }}
          bodyStyle={{ padding: "8px 12px" }}
        >
          {state.children.map((child: any) => render(child))}
        </Card>
      );
    },
  );

  ProjectCardLayout.displayName = "ProjectCardLayout";

  // 定义表单 schema
  const schema = useMemo(
    () => ({
      fields: [
        {
          key: "companyName",
          label: "公司名称",
          control: "input",
          controlProps: {
            placeholder: "请输入公司名称",
          },
          defaultValue: "科技创新有限公司",
          validate: z.string().min(1, { message: "请输入公司名称" }),
        },
        // 第一层数组：部门
        {
          key: "departments",
          isArray: true,
          LayoutComponent: DepartmentsFlexLayout,
          arraySchema: {
            isArray: false,
            LayoutComponent: DepartmentCardLayout,
            childrenFields: [
              {
                key: "deptName",
                label: "部门名称",
                control: "input",
                controlProps: {
                  placeholder: "请输入部门名称",
                },
                validate: z.string().min(1, { message: "请输入部门名称" }),
                FieldDisplayComponent: WiderLabelField,
              },
              {
                key: "budget",
                label: "部门预算(万元)",
                control: "input",
                controlProps: {
                  placeholder: "请输入部门预算",
                  type: "number",
                },
                validate: z
                  .string()
                  .min(1, { message: "请输入部门预算" })
                  .refine(
                    (val) => {
                      const num = parseFloat(val);
                      return num > 0;
                    },
                    { message: "预算必须大于0" },
                  ),
                FieldDisplayComponent: WiderLabelField,
              },
              // 第二层数组：员工
              {
                key: "employees",
                isArray: true,
                LayoutComponent: EmployeesFlexLayout,
                arraySchema: {
                  isArray: false,
                  LayoutComponent: EmployeeCardLayout,
                  childrenFields: [
                    {
                      key: "empName",
                      label: "员工姓名",
                      control: "input",
                      controlProps: {
                        placeholder: "请输入员工姓名",
                      },
                      validate: z
                        .string()
                        .min(1, { message: "请输入员工姓名" }),
                      FieldDisplayComponent: ExtraWiderLabelField,
                    },
                    {
                      key: "position",
                      label: "职位",
                      control: "select",
                      controlProps: {
                        placeholder: "请选择职位",
                        options: [
                          { label: "经理", value: "manager" },
                          { label: "主管", value: "supervisor" },
                          { label: "工程师", value: "engineer" },
                          { label: "设计师", value: "designer" },
                          { label: "分析师", value: "analyst" },
                        ],
                      },
                      validate: z.enum(
                        [
                          "manager",
                          "supervisor",
                          "engineer",
                          "designer",
                          "analyst",
                        ],
                        { message: "请选择职位" },
                      ),
                      FieldDisplayComponent: ExtraWiderLabelField,
                    },
                    {
                      key: "salary",
                      label: "月薪(元)",
                      control: "input",
                      controlProps: {
                        placeholder: "请输入月薪",
                        type: "number",
                      },
                      validate: z
                        .string()
                        .min(1, { message: "请输入月薪" })
                        .refine(
                          (val) => {
                            const num = parseFloat(val);
                            return num > 0;
                          },
                          { message: "月薪必须大于0" },
                        ),
                      FieldDisplayComponent: ExtraWiderLabelField,
                    },
                    // 第三层数组：项目
                    {
                      key: "projects",
                      isArray: true,
                      LayoutComponent: ProjectsListLayout,
                      arraySchema: {
                        isArray: false,
                        LayoutComponent: ProjectCardLayout,
                        childrenFields: [
                          {
                            key: "projectName",
                            label: "项目名称",
                            control: "input",
                            controlProps: {
                              placeholder: "请输入项目名称",
                            },
                            validate: z
                              .string()
                              .min(1, { message: "请输入项目名称" }),
                            FieldDisplayComponent: ExtraWiderLabelField,
                          },
                          {
                            key: "status",
                            label: "项目状态",
                            control: "radio",
                            controlProps: {
                              options: [
                                { label: "进行中", value: "ongoing" },
                                { label: "已完成", value: "completed" },
                                { label: "已暂停", value: "paused" },
                              ],
                            },
                            defaultValue: "ongoing",
                            validate: z.enum(
                              ["ongoing", "completed", "paused"],
                              { message: "请选择项目状态" },
                            ),
                            FieldDisplayComponent: ExtraWiderLabelField,
                          },
                          {
                            key: "progress",
                            label: "完成进度(%)",
                            control: "input",
                            controlProps: {
                              placeholder: "请输入完成进度",
                              type: "number",
                            },
                            validate: z
                              .string()
                              .min(1, { message: "请输入完成进度" })
                              .refine(
                                (val) => {
                                  const num = parseFloat(val);
                                  return num >= 0 && num <= 100;
                                },
                                { message: "进度必须在0-100之间" },
                              ),
                            FieldDisplayComponent: ExtraWiderLabelField,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ] satisfies FieldSchema[],
    }),
    [],
  );

  // 初始化模型 & Hook
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 初始化：设置初始数据
  useEffect(() => {
    // 设置初始数据
    form.setFieldsValue({
      companyName: "科技创新有限公司",
      departments: {
        研发部: {
          deptName: "研发部",
          budget: "500",
          employees: {
            EMP001: {
              empName: "张三",
              position: "manager",
              salary: "25000",
              projects: {
                PROJ001: {
                  projectName: "移动应用开发",
                  status: "ongoing",
                  progress: "75",
                },
                PROJ002: {
                  projectName: "数据平台重构",
                  status: "ongoing",
                  progress: "40",
                },
              },
            },
            EMP002: {
              empName: "李四",
              position: "engineer",
              salary: "18000",
              projects: {
                PROJ003: {
                  projectName: "API接口优化",
                  status: "completed",
                  progress: "100",
                },
              },
            },
          },
        },
        设计部: {
          deptName: "设计部",
          budget: "300",
          employees: {
            EMP003: {
              empName: "王五",
              position: "designer",
              salary: "16000",
              projects: {
                PROJ004: {
                  projectName: "品牌视觉升级",
                  status: "ongoing",
                  progress: "60",
                },
              },
            },
          },
        },
      },
    });

    // 注册联动规则示例：根据职位自动调整薪资范围
    const stop = model.effect((value, ctx) => {
      // track 整个 departments 数组（不能 track 数组内部的字段）
      const departments = value.departments();

      if (typeof departments === "object" && departments !== null) {
        for (const deptKey in departments) {
          const dept = (departments as any)[deptKey];
          if (dept?.employees && typeof dept.employees === "object") {
            for (const empKey in dept.employees) {
              const employee = dept.employees[empKey];
              const position = employee?.position;

              // 根据职位设置薪资提示
              let tip = "";
              if (position === "manager") {
                tip = "经理级别薪资范围：20000-30000元";
              } else if (position === "supervisor") {
                tip = "主管级别薪资范围：15000-22000元";
              } else if (position === "engineer") {
                tip = "工程师级别薪资范围：12000-20000元";
              } else if (position === "designer") {
                tip = "设计师级别薪资范围：10000-18000元";
              } else if (position === "analyst") {
                tip = "分析师级别薪资范围：11000-19000元";
              }

              if (tip) {
                ctx.setAlertTip(
                  ["departments", deptKey, "employees", empKey, "salary"],
                  tip,
                );
              }
            }
          }
        }
      }
    });

    model.initial();
    console.log(model);

    return stop;
  }, [model, form]);

  // 展示字段顺序
  const displayFields: FieldPath[] = useMemo(
    () => [["companyName"], ["departments"]],
    [],
  );

  // 交互
  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功！请查看控制台");
      console.log("📊 提交数据:", JSON.stringify(data, null, 2));
    } catch (e) {
      message.error("请检查表单校验错误");
      console.error("校验错误:", e);
    }
  };

  const onReset = () => {
    form.resetFields();
    message.info("表单已重置");
  };

  const onAddDepartment = () => {
    const deptKey = `DEPT${Date.now()}`;
    // 参数顺序: path, value, position, key
    model.insertIntoArray(
      ["departments"],
      {
        [deptKey]: {
          deptName: "新部门",
          budget: "100",
          employees: {},
        },
      },
      undefined,
      "after",
      true,
    );
    message.success("已添加新部门");
  };

  const onAddEmployee = () => {
    // 添加到第一个部门
    const departments = form.getFieldValue(["departments"]);
    if (departments && typeof departments === "object") {
      const firstDeptKey = Object.keys(departments)[0];
      if (firstDeptKey) {
        const empKey = `EMP${Date.now()}`;
        model.insertIntoArray(
          ["departments", firstDeptKey, "employees"],
          {
            [empKey]: {
              empName: "新员工",
              position: "engineer",
              salary: "15000",
              projects: {},
            },
          },
          "after",
          undefined,
          true,
        );
        message.success("已添加新员工到第一个部门");
      } else {
        message.warning("请先添加部门");
      }
    } else {
      message.warning("请先添加部门");
    }
  };

  const onAddProject = () => {
    // 添加到第一个部门的第一个员工
    const departments = form.getFieldValue(["departments"]);
    if (departments && typeof departments === "object") {
      const firstDeptKey = Object.keys(departments)[0];
      if (firstDeptKey) {
        const employees = (departments as any)[firstDeptKey]?.employees;
        if (employees && typeof employees === "object") {
          const firstEmpKey = Object.keys(employees)[0];
          if (firstEmpKey) {
            const projKey = `PROJ${Date.now()}`;
            model.insertIntoArray(
              [
                "departments",
                firstDeptKey,
                "employees",
                firstEmpKey,
                "projects",
              ],
              {
                [projKey]: {
                  projectName: "新项目",
                  status: "ongoing",
                  progress: "0",
                },
              },
              "after",
              undefined,
              true,
            );
            message.success("已添加新项目到第一个员工");
          } else {
            message.warning("请先添加员工");
          }
        } else {
          message.warning("请先添加员工");
        }
      } else {
        message.warning("请先添加部门");
      }
    } else {
      message.warning("请先添加部门");
    }
  };

  return (
    <div className="p-6">
      <Card
        title="🏢 两层嵌套数组示例：部门 → 员工 → 项目"
        bordered
        extra={
          <Space>
            <Button type="primary" size="small" onClick={onAddDepartment}>
              ➕ 添加部门
            </Button>
            <Button size="small" onClick={onAddEmployee}>
              ➕ 添加员工
            </Button>
            <Button size="small" onClick={onAddProject}>
              ➕ 添加项目
            </Button>
          </Space>
        }
      >
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <h3 className="text-base font-semibold mb-2">💡 示例说明：</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>第一层数组：</strong>
              部门列表（departments），每个部门有名称和预算
            </li>
            <li>
              <strong>第二层数组：</strong>
              员工列表（employees），每个员工有姓名、职位和薪资
            </li>
            <li>
              <strong>第三层数组：</strong>
              项目列表（projects），每个项目有名称、状态和进度
            </li>
            <li>
              <strong>联动规则：</strong>根据员工职位自动显示薪资范围提示
            </li>
          </ul>
        </div>

        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ showDebug: false }}
        />

        <Divider />

        <Space>
          <Button type="primary" onClick={onSubmit}>
            提交表单
          </Button>
          <Button onClick={onReset}>重置表单</Button>
        </Space>
      </Card>
    </div>
  );
}
