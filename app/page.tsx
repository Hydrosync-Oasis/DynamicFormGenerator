import Link from "next/link";
import { Card, Space, Typography } from "antd";

const pages = [
  { href: "/rhf-subscribe-test", label: "react-hook-form 订阅回调测试" },
  { href: "/on-value-change-test", label: "onValueChange 函数测试" },
  { href: "/array-test", label: "array-test" },
  { href: "/demo-showcase", label: "demo-showcase" },
  { href: "/dynamic-example", label: "dynamic-example" },
  { href: "/nested-array-example", label: "nested-array-example" },
  { href: "/perf-array", label: "perf-array" },
  { href: "/test-dirty-api", label: "test-dirty-api" },
  { href: "/test-dirty-include-rule", label: "test-dirty-include-rule" },
  { href: "/on-dirty-change-test", label: "onDirtyChange 函数测试" },
  { href: "/test-include-policy", label: "test-include-policy" },
  { href: "/validation-demo", label: "validation-demo" },
];

export default function Page() {
  return (
    <div className="mx-auto mt-8 w-11/12 max-w-3xl">
      <Card title="Dynamic Form Playground">
        <Space direction="vertical" size={10}>
          {pages.map((page) => (
            <Link key={page.href} href={page.href}>
              <Typography.Text>{page.label}</Typography.Text>
            </Link>
          ))}
        </Space>
      </Card>
    </div>
  );
}
