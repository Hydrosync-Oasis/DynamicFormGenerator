"use client";

import React from "react";
import {
  FormModel,
  type FieldSchema,
  type FormSchema,
  type MutableFieldNode,
} from "@/utils/structures";
import { PlainObjectCacheManager } from "@/utils/plainObjectCacheManager";

type CacheView = {
  path: string;
  type: string;
  nodeType: MutableFieldNode["type"];
  value?: any;
};

function buildSchema(): FormSchema {
  const fields: FieldSchema[] = [
    {
      key: "user",
      label: "User",
      childrenFields: [
        { key: "name", label: "Name", defaultValue: "Alice" },
        { key: "age", label: "Age", defaultValue: 18 },
      ],
    },
    {
      key: "settings",
      label: "Settings",
      childrenFields: [{ key: "theme", label: "Theme", defaultValue: "light" }],
    },
    // 数组套对象：orders 是数组，其中每个元素是一个对象 item，包含 product/qty/meta.note
    {
      key: "orders",
      label: "Orders",
      isArray: true,
      childrenFields: [
        {
          key: "item",
          label: "Item",
          childrenFields: [
            { key: "product", label: "Product", defaultValue: "" },
            { key: "qty", label: "Qty", defaultValue: 1 },
            {
              key: "meta",
              label: "Meta",
              childrenFields: [
                { key: "note", label: "Note", defaultValue: "" },
              ],
            },
          ],
        },
        {
          key: "gift",
          label: "Gift",
          childrenFields: [
            { key: "code", label: "Code", defaultValue: "" },
            { key: "amount", label: "Amount", defaultValue: 0 },
          ],
        },
      ],
    },
  ];
  return { fields };
}

export default function TestPlainCachePage() {
  const modelRef = React.useRef<FormModel | null>(null);
  const rootRef = React.useRef<MutableFieldNode | null>(null);
  const cacheRef = React.useRef<PlainObjectCacheManager | null>(null);

  const [finalObj, setFinalObj] = React.useState<any>(null);
  const [cacheView, setCacheView] = React.useState<CacheView[]>([]);
  const [log, setLog] = React.useState<string[]>([]);

  const appendLog = (msg: string) =>
    setLog((l) => [...l, `${new Date().toLocaleTimeString()} - ${msg}`]);

  React.useEffect(() => {
    // init model and cache manager
    const schema = buildSchema();
    const model = new FormModel(schema);
    const root = model.findNodeByPath([])!; // dummy root
    const cacheMgr = new PlainObjectCacheManager(root);

    modelRef.current = model;
    rootRef.current = root;
    cacheRef.current = cacheMgr;

    refreshCacheView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshCacheView() {
    const root = rootRef.current;
    if (!root) return;
    const list: CacheView[] = [];

    const visit = (node: MutableFieldNode, base: string[]) => {
      const p = base.join(".") || "<root>";
      const entry: CacheView = {
        path: p,
        type: node.cache?.plainObj?.type ?? "<none>",
        nodeType: node.type,
      };
      if (node.type === "field") {
        entry.value = node.dynamicProp?.value;
      }
      list.push(entry);
      if (node.type !== "field" && node.children) {
        for (const ch of node.children) visit(ch, [...base, ch.key]);
      }
    };

    visit(root, []);
    setCacheView(list);
  }

  function mutateValue(path: string[], value: any) {
    const model = modelRef.current;
    const cacheMgr = cacheRef.current;
    if (!model || !cacheMgr) return;
    const node = model.findNodeByPath(path);
    if (!node || node.type !== "field") {
      appendLog(`Path ${path.join(".")} not found or not a field`);
      return;
    }
    // 手动改 value（不走 setValue），然后调用 updateNode
    node.dynamicProp.value = value;
    cacheMgr.updateNode(node);
    appendLog(`Updated ${path.join(".")} to ${JSON.stringify(value)}`);
    refreshCacheView();
  }

  function setVisibleManual(path: string[], visible: boolean) {
    const model = modelRef.current;
    const cacheMgr = cacheRef.current;
    if (!model || !cacheMgr) return;
    const node = model.findNodeByPath(path);
    if (!node || node.type !== "field") {
      appendLog(`Path ${path.join(".")} not found or not a field`);
      return;
    }
    node.dynamicProp.visible = visible;
    cacheMgr.updateNode(node);
    appendLog(`Set visible ${path.join(".")} = ${visible}`);
    refreshCacheView();
  }

  function getFinal() {
    const cacheMgr = cacheRef.current;
    if (!cacheMgr) return;
    const obj = cacheMgr.getFinalPlainObject();
    setFinalObj(obj);
    appendLog(`getFinalPlainObject() returned: ${JSON.stringify(obj)}`);
    refreshCacheView();
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">PlainObjectCacheManager 测试</h1>
      <p className="text-sm text-gray-600">
        流程：手动修改 MutableFieldNode 的值 → 调用 updateNode → 调用
        getFinalPlainObject 收集树的 value。
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={() => mutateValue(["user", "name"], "Bob")}
        >
          设置 user.name = "Bob"
        </button>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={() => mutateValue(["user", "age"], 21)}
        >
          设置 user.age = 21
        </button>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={() => mutateValue(["settings", "theme"], "dark")}
        >
          设置 settings.theme = "dark"
        </button>
        <button
          className="px-3 py-2 rounded bg-indigo-600 text-white"
          onClick={() => mutateValue(["orders", "item", "product"], "Book")}
        >
          设置 orders.item.product = "Book"
        </button>
        <button
          className="px-3 py-2 rounded bg-indigo-600 text-white"
          onClick={() => mutateValue(["orders", "item", "qty"], 2)}
        >
          设置 orders.item.qty = 2
        </button>
        <button
          className="px-3 py-2 rounded bg-indigo-600 text-white"
          onClick={() =>
            mutateValue(["orders", "item", "meta", "note"], "urgent")
          }
        >
          设置 orders.item.meta.note = "urgent"
        </button>
        <button
          className="px-3 py-2 rounded bg-purple-600 text-white"
          onClick={() => mutateValue(["orders", "gift", "code"], "G100")}
        >
          设置 orders.gift.code = "G100"
        </button>
        <button
          className="px-3 py-2 rounded bg-purple-600 text-white"
          onClick={() => mutateValue(["orders", "gift", "amount"], 50)}
        >
          设置 orders.gift.amount = 50
        </button>
        <button
          className="px-3 py-2 rounded bg-emerald-600 text-white"
          onClick={getFinal}
        >
          调用 getFinalPlainObject()
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() => setVisibleManual(["user", "age"], false)}
        >
          隐藏 user.age
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() => setVisibleManual(["user", "age"], true)}
        >
          显示 user.age
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() =>
            setVisibleManual(["orders", "item", "meta", "note"], false)
          }
        >
          隐藏 orders.item.meta.note
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() =>
            setVisibleManual(["orders", "item", "meta", "note"], true)
          }
        >
          显示 orders.item.meta.note
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() => setVisibleManual(["orders", "gift", "amount"], false)}
        >
          隐藏 orders.gift.amount
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-600 text-white"
          onClick={() => setVisibleManual(["orders", "gift", "amount"], true)}
        >
          显示 orders.gift.amount
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">缓存视图（cache.plainObj.type）</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">路径</th>
                <th className="py-1">节点类型</th>
                <th className="py-1">cache.type</th>
                <th className="py-1">值</th>
              </tr>
            </thead>
            <tbody>
              {cacheView.map((row, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-1 pr-2 font-mono">{row.path}</td>
                  <td className="py-1 pr-2">{row.nodeType}</td>
                  <td className="py-1 pr-2">{row.type}</td>
                  <td className="py-1 pr-2 font-mono">
                    {row.value !== undefined ? JSON.stringify(row.value) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">getFinalPlainObject 结果</h2>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
            {finalObj ? JSON.stringify(finalObj, null, 2) : "(未调用或为空)"}
          </pre>
        </div>
      </div>

      <div className="border rounded p-3">
        <h2 className="font-medium mb-2">操作日志</h2>
        <ul className="text-sm space-y-1">
          {log.map((l, i) => (
            <li key={i} className="font-mono">
              {l}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
