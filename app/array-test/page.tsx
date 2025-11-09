"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Space, message } from "antd";
import { z } from "zod";
import { FormModel } from "../../utils/structures";
import {
  Generator,
  useDynamicForm,
  DefaultFieldDisplay,
} from "../../utils/generator";
import type { FieldSchema, FieldPath } from "../../utils/structures";

export default function ArrayTestPage() {
  // HOC：创建标签更宽的Field组件
  const withWiderLabel = (WrappedComponent: any) => {
    return (props: any) => {
      return (
        <WrappedComponent
          {...props}
          displayOption={{
            ...props.displayOption,
            labelSpan: 10,
            fieldSpan: 14,
          }}
        />
      );
    };
  };

  // 使用HOC创建标签更宽的Field组件
  const WiderLabelField = withWiderLabel(DefaultFieldDisplay);

  // 定义数组外层的Flex布局组件
  const ServersFlexLayout = ({ children }: any) => {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginTop: 8,
        }}
      >
        {children}
      </div>
    );
  };

  // 定义服务器卡片布局组件
  const ServerCardLayout = ({ children, state }: any) => {
    // 从state中获取当前路径的IP地址（作为标题）
    const path = state.path as FieldPath;
    const ipAddress = path[path.length - 1]; // 数组项的key就是IP地址

    return (
      <Card
        size="small"
        title={`服务器配置 - ${ipAddress}`}
        style={{
          width: 320,
          flexShrink: 0,
        }}
        headStyle={{
          backgroundColor: "#f5f5f5",
          minHeight: 36,
          fontSize: 14,
          fontWeight: 500,
        }}
        bodyStyle={{ padding: "12px 16px" }}
      >
        {children}
      </Card>
    );
  };

  // 定义表单 schema
  const schema = useMemo(
    () => ({
      fields: [
        // 第一个字段：IP 输入框
        {
          key: "ipAddresses",
          label: "IP地址列表",
          control: "input",
          controlProps: {
            placeholder: "请输入IP地址，多个用英文逗号分隔",
          },
          validate: z
            .string()
            .min(1, { message: "请输入IP地址" })
            .refine(
              (val) => {
                const ips = val.split(",").map((ip) => ip.trim());
                return ips.every((ip) => {
                  // 简单的IP格式验证
                  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                  return ipRegex.test(ip);
                });
              },
              { message: "请输入有效的IP地址格式" }
            ),
          helpTip: "示例：192.168.1.1, 10.0.0.1",
        },
        // 第二个字段：数组型嵌套字段
        {
          key: "servers",
          isArray: true,
          LayoutComponent: ServersFlexLayout,
          arraySchema: {
            isArray: false,
            LayoutComponent: ServerCardLayout,
            childrenFields: [
              // 第一个字段：服务器名称
              {
                key: "serverName",
                label: "服务器名称",
                control: "input",
                controlProps: {
                  placeholder: "请输入服务器名称",
                },
                validate: z.string().min(1, { message: "请输入服务器名称" }),
                FieldDisplayComponent: WiderLabelField,
              },
              // 第二个字段：端口号
              {
                key: "port",
                label: "端口号",
                control: "input",
                controlProps: {
                  placeholder: "请输入端口号",
                  type: "number",
                },
                validate: z
                  .string()
                  .min(1, { message: "请输入端口号" })
                  .refine(
                    (val) => {
                      const port = parseInt(val);
                      return port > 0 && port <= 65535;
                    },
                    { message: "端口号必须在1-65535之间" }
                  ),
                FieldDisplayComponent: WiderLabelField,
              },
              // 第三个字段：协议类型（单选框）
              {
                key: "protocol",
                label: "协议类型",
                control: "radio",
                controlProps: {
                  options: [
                    { label: "HTTP", value: "http" },
                    { label: "HTTPS", value: "https" },
                  ],
                },
                validate: z.enum(["http", "https"], {
                  message: "请选择协议类型",
                }),
                defaultValue: "http",
                FieldDisplayComponent: WiderLabelField,
              },
              // 第四个字段：SSL证书路径（根据协议类型显示/隐藏）
              {
                key: "sslCertPath",
                label: "SSL证书路径",
                control: "input",
                controlProps: {
                  placeholder: "请输入SSL证书路径",
                },
                validate: z.string().min(1, { message: "请输入SSL证书路径" }),
                initialVisible: false,
                FieldDisplayComponent: WiderLabelField,
              },
            ],
          },
        },
      ] satisfies FieldSchema[],
    }),
    []
  );

  // 初始化模型 & Hook
  const [model] = useState(() => new FormModel(schema));
  const form = useDynamicForm(model);

  // 初始化：设置数组初始数据
  useEffect(() => {
    // 注册联动规则1：根据IP数量自动调整服务器数组项数
    model.registerRule((ctx, cause) => {
      const ipAddresses = ctx.get(["ipAddresses"]);

      if (typeof ipAddresses === "string" && ipAddresses.trim()) {
        // 解析IP地址列表
        const ips = ipAddresses
          .split(",")
          .map((ip) => ip.trim())
          .filter((ip) => ip.length > 0);

        const currentServers = ctx.get(["servers"], false) || {};
        const currentKeys = Object.keys(currentServers);

        // 使用IP地址作为key
        const newServers: Record<string, any> = {};
        ips.forEach((ip, index) => {
          // 如果已存在该IP的服务器配置，保留它；否则创建新的
          if (currentServers[ip]) {
            newServers[ip] = currentServers[ip];
          } else {
            newServers[ip] = {
              serverName: `服务器${index + 1}`,
              port: "8080",
              protocol: "http",
              sslCertPath: "",
            };
          }
        });

        // 只有在服务器配置发生变化时才更新
        if (
          JSON.stringify(currentKeys.sort()) !==
          JSON.stringify(Object.keys(newServers).sort())
        ) {
          ctx.setArray(["servers"], newServers, { shouldTriggerRule: true });
        }
      } else if (!ipAddresses || ipAddresses.trim() === "") {
        // 如果IP地址为空，清空服务器数组
        const currentServers = ctx.get(["servers"], false) || {};
        if (Object.keys(currentServers).length > 0) {
          ctx.setArray(["servers"], {}, { shouldTriggerRule: false });
        }
      }
    });

    // 注册联动规则2：根据协议类型显示/隐藏SSL证书路径
    model.registerRule((ctx, cause) => {
      const serversValue = ctx.get(["servers"], true);
      if (serversValue && typeof serversValue === "object") {
        Object.keys(serversValue).forEach((key) => {
          const protocol = ctx.get(["servers", key, "protocol"]);
          const shouldShowSSL = protocol === "https";

          ctx.setVisible(["servers", key, "sslCertPath"], shouldShowSSL);

          // 如果是HTTPS，SSL证书路径必填；如果是HTTP，设置为可选
          if (shouldShowSSL) {
            ctx.setValidation(
              ["servers", key, "sslCertPath"],
              z.string().min(1, { message: "请输入SSL证书路径" })
            );
          } else {
            ctx.setValidation(
              ["servers", key, "sslCertPath"],
              z.string().optional()
            );
          }
        });
      }
    });

    model.initial();
  }, [model]);

  // 展示字段
  const displayFields: FieldPath[] = useMemo(
    () => [["ipAddresses"], ["servers"]],
    []
  );

  // 添加服务器
  const handleAddServer = () => {
    const newKey = `server_${Date.now()}`;
    const newServer = {
      serverName: "",
      port: "",
      protocol: "http",
      sslCertPath: "",
    };

    model.insertIntoArray(["servers"], { [newKey]: newServer }, "after");
    message.success("已添加新服务器配置");
  };

  // 删除服务器
  const handleDeleteServer = (key: string) => {
    model.setItemOfArray(["servers"], key, undefined);
    message.success(`已删除服务器: ${key}`);
  };

  // 提交表单
  const onSubmit = async () => {
    try {
      const data = await form.submit();
      message.success("提交成功，请查看控制台");
      console.log("提交数据:", data);
    } catch (e) {
      message.error("请检查表单校验错误");
      console.error("校验错误:", e);
    }
  };

  return (
    <div className="p-6">
      <Card title="服务器配置表单" bordered>
        <Generator
          model={model}
          displayFields={displayFields}
          displayOption={{ showDebug: true }}
        />

        <div style={{ marginTop: 24 }}>
          <Space>
            <Button type="primary" onClick={onSubmit}>
              提交表单
            </Button>
            <Button onClick={handleAddServer}>添加服务器</Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
