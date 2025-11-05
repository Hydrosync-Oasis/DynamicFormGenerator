"use client";

import React from "react";
import {
  FormModel,
  type FieldSchema,
  type FormSchema,
} from "@/utils/structures";
import { z } from "zod";

function buildTestSchema(): FormSchema {
  const fields: FieldSchema[] = [
    {
      key: "user",
      label: "用户信息",
      childrenFields: [
        {
          key: "name",
          label: "姓名",
          defaultValue: "",
          validate: z.string().min(2, "姓名至少2个字符"),
        },
        {
          key: "age",
          label: "年龄",
          defaultValue: 0,
          validate: z.number().min(18, "年龄必须大于等于18"),
        },
        {
          key: "email",
          label: "邮箱",
          defaultValue: "",
          validate: z.string().email("邮箱格式不正确"),
        },
      ],
    },
    {
      key: "address",
      label: "地址信息",
      childrenFields: [
        {
          key: "city",
          label: "城市",
          defaultValue: "",
          validate: z.string().min(1, "请输入城市"),
        },
        {
          key: "zipCode",
          label: "邮编",
          defaultValue: "",
          validate: z.string().regex(/^\d{6}$/, "邮编必须是6位数字"),
        },
      ],
    },
    {
      key: "password",
      label: "密码",
      defaultValue: "",
      validate: z.string().min(6, "密码至少6个字符"),
    },
    {
      key: "confirmPassword",
      label: "确认密码",
      defaultValue: "",
      validate: z.string().min(6, "确认密码至少6个字符"),
    },
  ];
  return { fields };
}

type TestResult = {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
};

export default function TestValidatePage() {
  const modelRef = React.useRef<FormModel | null>(null);
  const [testResults, setTestResults] = React.useState<TestResult[]>([]);
  const [log, setLog] = React.useState<string[]>([]);

  const appendLog = (msg: string) =>
    setLog((l) => [...l, `${new Date().toLocaleTimeString()} - ${msg}`]);

  React.useEffect(() => {
    const schema = buildTestSchema();
    const model = new FormModel(schema);
    modelRef.current = model;
    appendLog("FormModel 初始化完成");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAllTests() {
    const model = modelRef.current;
    if (!model) {
      appendLog("模型未初始化");
      return;
    }

    const results: TestResult[] = [];
    setLog([]);
    appendLog("开始运行所有测试...");

    // ========== 测试1: 单个字段校验 - 校验失败 ==========
    try {
      appendLog("测试1: 单个字段校验 - 校验失败");
      model.setValue(["user", "name"], "A"); // 只有1个字符，应该失败
      await model.validateField(["user", "name"], false);
      results.push({
        name: "测试1: 单个字段校验 - 校验失败",
        passed: false,
        error: "应该抛出错误但没有",
      });
    } catch (error: any) {
      const node = model.findNodeByPath(["user", "name"]);
      const errorMsg =
        node?.type === "field" ? node.dynamicProp?.errorMessage : undefined;
      if (errorMsg === "姓名至少2个字符") {
        results.push({
          name: "测试1: 单个字段校验 - 校验失败",
          passed: true,
          details: `正确捕获错误: ${errorMsg}`,
        });
      } else {
        results.push({
          name: "测试1: 单个字段校验 - 校验失败",
          passed: false,
          error: `错误信息不匹配: ${errorMsg}`,
        });
      }
    }

    // ========== 测试2: 单个字段校验 - 校验成功 ==========
    try {
      appendLog("测试2: 单个字段校验 - 校验成功");
      model.setValue(["user", "name"], "Alice");
      await model.validateField(["user", "name"], false);
      const node = model.findNodeByPath(["user", "name"]);
      const errorMsg =
        node?.type === "field" ? node.dynamicProp?.errorMessage : undefined;
      if (errorMsg === undefined) {
        results.push({
          name: "测试2: 单个字段校验 - 校验成功",
          passed: true,
          details: "字段校验通过，无错误信息",
        });
      } else {
        results.push({
          name: "测试2: 单个字段校验 - 校验成功",
          passed: false,
          error: `不应该有错误信息: ${errorMsg}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: "测试2: 单个字段校验 - 校验成功",
        passed: false,
        error: `不应该抛出错误: ${error.message}`,
      });
    }

    // ========== 测试3: 嵌套对象校验 - 不启用enhancer ==========
    try {
      appendLog("测试3: 嵌套对象校验 - 不启用enhancer");
      model.setValue(["user", "name"], "Bob");
      model.setValue(["user", "age"], 16); // 年龄小于18，应该失败
      model.setValue(["user", "email"], "bob@example.com");
      await model.validateField(["user"], false);
      results.push({
        name: "测试3: 嵌套对象校验 - 不启用enhancer",
        passed: false,
        error: "应该抛出错误但没有",
      });
    } catch (error: any) {
      console.error(error);
      const ageNode = model.findNodeByPath(["user", "age"]);
      const ageErrorMsg =
        ageNode?.type === "field"
          ? ageNode.dynamicProp?.errorMessage
          : undefined;
      if (ageErrorMsg === "年龄必须大于等于18") {
        results.push({
          name: "测试3: 嵌套对象校验 - 不启用enhancer",
          passed: true,
          details: `正确捕获嵌套字段错误: ${ageErrorMsg}`,
        });
      } else {
        results.push({
          name: "测试3: 嵌套对象校验 - 不启用enhancer",
          passed: false,
          error: `错误信息不匹配: ${ageErrorMsg}`,
        });
      }
    }

    // ========== 测试4: 嵌套对象校验 - 全部通过 ==========
    try {
      appendLog("测试4: 嵌套对象校验 - 全部通过");
      model.setValue(["user", "name"], "Charlie");
      model.setValue(["user", "age"], 25);
      model.setValue(["user", "email"], "charlie@example.com");
      await model.validateField(["user"], false);
      const nameNode = model.findNodeByPath(["user", "name"]);
      const ageNode = model.findNodeByPath(["user", "age"]);
      const emailNode = model.findNodeByPath(["user", "email"]);
      const nameError =
        nameNode?.type === "field"
          ? nameNode.dynamicProp?.errorMessage
          : undefined;
      const ageError =
        ageNode?.type === "field"
          ? ageNode.dynamicProp?.errorMessage
          : undefined;
      const emailError =
        emailNode?.type === "field"
          ? emailNode.dynamicProp?.errorMessage
          : undefined;
      if (!nameError && !ageError && !emailError) {
        results.push({
          name: "测试4: 嵌套对象校验 - 全部通过",
          passed: true,
          details: "所有嵌套字段校验通过",
        });
      } else {
        results.push({
          name: "测试4: 嵌套对象校验 - 全部通过",
          passed: false,
          error: `存在错误信息: name=${nameError}, age=${ageError}, email=${emailError}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: "测试4: 嵌套对象校验 - 全部通过",
        passed: false,
        error: `不应该抛出错误: ${error.message}`,
      });
    }

    // ========== 测试5: 启用enhancer - 跨字段校验 ==========
    try {
      appendLog("测试5: 启用enhancer - 跨字段校验（密码不匹配）");
      // 设置refiner进行跨字段校验：密码和确认密码必须一致
      model.setRefiner([], (schema) => {
        return schema.refine(
          (data: any) => {
            return data.password === data.confirmPassword;
          },
          {
            message: "两次密码不一致",
            path: ["confirmPassword"],
          }
        );
      });

      model.setValue(["password"], "password123");
      model.setValue(["confirmPassword"], "password456"); // 不一致

      await model.validateField(["confirmPassword"], true);
      results.push({
        name: "测试5: 启用enhancer - 跨字段校验（密码不匹配）",
        passed: false,
        error: "应该抛出错误但没有",
      });
    } catch (error: any) {
      const confirmPwdNode = model.findNodeByPath(["confirmPassword"]);
      const confirmPwdError =
        confirmPwdNode?.type === "field"
          ? confirmPwdNode.dynamicProp?.errorMessage
          : undefined;
      if (confirmPwdError === "两次密码不一致") {
        results.push({
          name: "测试5: 启用enhancer - 跨字段校验（密码不匹配）",
          passed: true,
          details: `正确捕获跨字段校验错误: ${confirmPwdError}`,
        });
      } else {
        results.push({
          name: "测试5: 启用enhancer - 跨字段校验（密码不匹配）",
          passed: false,
          error: `错误信息不匹配: ${confirmPwdError}`,
        });
      }
    }

    // ========== 测试6: 启用enhancer - 跨字段校验通过 ==========
    try {
      appendLog("测试6: 启用enhancer - 跨字段校验通过");
      model.setValue(["password"], "password123");
      model.setValue(["confirmPassword"], "password123"); // 一致

      await model.validateField(["confirmPassword"], true);
      const confirmPwdNode = model.findNodeByPath(["confirmPassword"]);
      const confirmPwdError =
        confirmPwdNode?.type === "field"
          ? confirmPwdNode.dynamicProp?.errorMessage
          : undefined;
      if (!confirmPwdError) {
        results.push({
          name: "测试6: 启用enhancer - 跨字段校验通过",
          passed: true,
          details: "跨字段校验通过",
        });
      } else {
        results.push({
          name: "测试6: 启用enhancer - 跨字段校验通过",
          passed: false,
          error: `不应该有错误信息: ${confirmPwdError}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: "测试6: 启用enhancer - 跨字段校验通过",
        passed: false,
        error: `不应该抛出错误: ${error.message}`,
      });
    }

    // ========== 测试7: 不启用enhancer - 跨字段校验不生效 ==========
    try {
      appendLog("测试7: 不启用enhancer - 跨字段校验不生效");
      model.setValue(["password"], "password123");
      model.setValue(["confirmPassword"], "password456"); // 不一致，但不启用enhancer

      await model.validateField(["confirmPassword"], false);
      const confirmPwdNode = model.findNodeByPath(["confirmPassword"]);
      const confirmPwdError =
        confirmPwdNode?.type === "field"
          ? confirmPwdNode.dynamicProp?.errorMessage
          : undefined;
      // 不启用enhancer时，只校验字段本身的validation，不会执行refiner
      // confirmPassword的validation是至少6个字符，所以应该通过
      if (!confirmPwdError) {
        results.push({
          name: "测试7: 不启用enhancer - 跨字段校验不生效",
          passed: true,
          details: "不启用enhancer时，跨字段校验不生效",
        });
      } else {
        results.push({
          name: "测试7: 不启用enhancer - 跨字段校验不生效",
          passed: false,
          error: `不应该有错误信息: ${confirmPwdError}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: "测试7: 不启用enhancer - 跨字段校验不生效",
        passed: false,
        error: `不应该抛出错误: ${error.message}`,
      });
    }

    // ========== 测试8: 邮箱格式校验 ==========
    try {
      appendLog("测试8: 邮箱格式校验 - 格式错误");
      model.setValue(["user", "email"], "invalid-email");
      await model.validateField(["user", "email"], false);
      results.push({
        name: "测试8: 邮箱格式校验 - 格式错误",
        passed: false,
        error: "应该抛出错误但没有",
      });
    } catch (error: any) {
      const emailNode = model.findNodeByPath(["user", "email"]);
      const emailError =
        emailNode?.type === "field"
          ? emailNode.dynamicProp?.errorMessage
          : undefined;
      if (emailError === "邮箱格式不正确") {
        results.push({
          name: "测试8: 邮箱格式校验 - 格式错误",
          passed: true,
          details: `正确捕获邮箱格式错误: ${emailError}`,
        });
      } else {
        results.push({
          name: "测试8: 邮箱格式校验 - 格式错误",
          passed: false,
          error: `错误信息不匹配: ${emailError}`,
        });
      }
    }

    // ========== 测试9: 正则表达式校验（邮编） ==========
    try {
      appendLog("测试9: 正则表达式校验 - 邮编格式错误");
      model.setValue(["address", "zipCode"], "12345"); // 只有5位
      await model.validateField(["address", "zipCode"], false);
      results.push({
        name: "测试9: 正则表达式校验 - 邮编格式错误",
        passed: false,
        error: "应该抛出错误但没有",
      });
    } catch (error: any) {
      const zipNode = model.findNodeByPath(["address", "zipCode"]);
      const zipError =
        zipNode?.type === "field"
          ? zipNode.dynamicProp?.errorMessage
          : undefined;
      if (zipError === "邮编必须是6位数字") {
        results.push({
          name: "测试9: 正则表达式校验 - 邮编格式错误",
          passed: true,
          details: `正确捕获邮编格式错误: ${zipError}`,
        });
      } else {
        results.push({
          name: "测试9: 正则表达式校验 - 邮编格式错误",
          passed: false,
          error: `错误信息不匹配: ${zipError}`,
        });
      }
    }

    // ========== 测试10: 正则表达式校验通过 ==========
    try {
      appendLog("测试10: 正则表达式校验 - 邮编格式正确");
      model.setValue(["address", "zipCode"], "100000");
      await model.validateField(["address", "zipCode"], false);
      const zipNode = model.findNodeByPath(["address", "zipCode"]);
      const zipError =
        zipNode?.type === "field"
          ? zipNode.dynamicProp?.errorMessage
          : undefined;
      if (!zipError) {
        results.push({
          name: "测试10: 正则表达式校验 - 邮编格式正确",
          passed: true,
          details: "邮编校验通过",
        });
      } else {
        results.push({
          name: "测试10: 正则表达式校验 - 邮编格式正确",
          passed: false,
          error: `不应该有错误信息: ${zipError}`,
        });
      }
    } catch (error: any) {
      results.push({
        name: "测试10: 正则表达式校验 - 邮编格式正确",
        passed: false,
        error: `不应该抛出错误: ${error.message}`,
      });
    }

    setTestResults(results);
    const passedCount = results.filter((r) => r.passed).length;
    appendLog(`测试完成: ${passedCount}/${results.length} 个测试通过`);
  }

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">validateField 功能测试</h1>
      <p className="text-sm text-gray-600">
        测试 FormModel 的 validateField 方法，包括：
        <br />
        1. 单个字段校验（成功/失败）
        <br />
        2. 嵌套对象校验（不启用enhancer）
        <br />
        3. 跨字段校验（启用/不启用enhancer）
        <br />
        4. 各种校验规则（字符串长度、邮箱格式、正则表达式等）
      </p>

      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={runAllTests}
        >
          运行所有测试
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="border rounded p-4 bg-gray-50">
          <h2 className="font-medium mb-2 text-lg">
            测试结果: {passedCount}/{totalCount} 通过
          </h2>
          <div className="space-y-2">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border ${
                  result.passed
                    ? "bg-green-50 border-green-300"
                    : "bg-red-50 border-red-300"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`font-bold ${
                      result.passed ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {result.passed ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{result.name}</div>
                    {result.details && (
                      <div className="text-sm text-gray-700 mt-1">
                        {result.details}
                      </div>
                    )}
                    {result.error && (
                      <div className="text-sm text-red-700 mt-1">
                        错误: {result.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded p-3">
        <h2 className="font-medium mb-2">测试日志</h2>
        <div className="bg-gray-50 p-2 rounded max-h-60 overflow-auto">
          <ul className="text-sm space-y-1">
            {log.map((l, i) => (
              <li key={i} className="font-mono text-xs">
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
