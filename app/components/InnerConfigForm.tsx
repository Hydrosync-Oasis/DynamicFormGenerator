"use client";

import React, { useEffect, useMemo } from "react";
import { z } from "zod";
import { Generator } from "../../utils/generator";
import { FormModel, FormSchema } from "../../utils/structures";

export interface InnerConfigValue {
  remark?: string;
  autoFindPath?: boolean;
  path?: string;
}

type Props = {
  value?: InnerConfigValue;
  onChange?: (v: InnerConfigValue) => void;
  disabled?: boolean;
};

// 自定义子表单组件：备注、是否自动配置路径、路径（在不自动配置时显示）
export const InnerConfigForm: React.FC<Props> = ({
  value,
  onChange,
  disabled,
}) => {
  const innerSchema = useMemo<FormSchema>(
    () => ({
      fields: [
        {
          key: "remark",
          label: "备注",
          control: "input",
          validate: z.string().optional(),
          defaultValue: value?.remark ?? "",
        },
        {
          key: "autoFindPath",
          label: "是否自动寻找路径",
          control: "radio",
          options: [
            { label: "是", value: true },
            { label: "否", value: false },
          ],
          validate: z.boolean(),
          defaultValue: value?.autoFindPath ?? true,
        },
        {
          key: "path",
          label: "路径",
          helpTip: "当未自动寻找路径时，请手动填写绝对路径",
          control: "input",
          validate: z.string().min(1, "请填写路径").nonempty(),
          defaultValue: value?.path ?? "",
          initialVisible: !(value?.autoFindPath ?? true) ? true : false,
        },
      ],
    }),
    []
  );

  const innerModel = useMemo(() => new FormModel(innerSchema), [innerSchema]);

  useEffect(() => {
    // 显隐联动：auto=false 显示 path
    innerModel.registerRule(({ get, set }) => {
      const auto = get(["autoFindPath"]) as boolean | undefined;
      set(["path"], "visible", auto === false);
    });
    innerModel.runAllRules();

    // 同步初始值
    if (value) {
      innerModel.set(["remark"], "value", value.remark ?? "");
      innerModel.set(["autoFindPath"], "value", value.autoFindPath ?? true);
      innerModel.set(["path"], "value", value.path ?? "");
    }

    // 订阅变化 -> 往外抛出对象值
    innerModel.onChange = () => {
      const data = innerModel.getJSONData(true) as any;
      onChange?.({
        remark: data.remark,
        autoFindPath: data.autoFindPath,
        path: data.path,
      });
    };

    return () => {
      // 清理回调，避免泄漏
      innerModel.onChange = undefined;
    };
  }, [innerModel, onChange, value]);

  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }}>
      <Generator
        model={innerModel}
        displayFields={[["remark"], ["autoFindPath"], ["path"]]}
      />
    </div>
  );
};

export default InnerConfigForm;
