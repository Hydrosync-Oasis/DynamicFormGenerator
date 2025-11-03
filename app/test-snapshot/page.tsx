"use client";

import React from "react";
import {
  FormModel,
  type FieldSchema,
  type FormSchema,
  type ImmutableFormState,
} from "@/utils/structures";

type Check = { label: string; pass: boolean };

function findNode(snapshot: ImmutableFormState, path: string[]) {
  let cur: ImmutableFormState | undefined = snapshot;
  for (const key of path) {
    if (!cur || cur.type !== "nested") return undefined;
    cur = cur.children.find((c) => c.key === key);
  }
  return cur;
}

function countAllNodes(root: ImmutableFormState): number {
  let cnt = 1;
  if (root.type === "nested") {
    for (const ch of root.children || []) cnt += countAllNodes(ch);
  }
  return cnt;
}

export default function TestSnapshotPage() {
  const [checks, setChecks] = React.useState<Check[]>([]);
  const [summary, setSummary] = React.useState<string>("");

  React.useEffect(() => {
    try {
      // Schema similar to utils/test.ts, expanded
      const fields: FieldSchema[] = [
        {
          key: "user",
          label: "User",
          childrenFields: [
            { key: "name", label: "Name", defaultValue: "Alice" },
            { key: "age", label: "Age", defaultValue: 18 },
            {
              key: "address",
              label: "Address",
              childrenFields: [
                { key: "city", label: "City", defaultValue: "Shanghai" },
                { key: "zip", label: "ZIP", defaultValue: "200000" },
              ],
            },
            {
              key: "contacts",
              label: "Contacts",
              isArray: true,
              childrenFields: [
                { key: "type", label: "Type", defaultValue: "mobile" },
                { key: "phone", label: "Phone", defaultValue: "" },
              ],
            },
          ],
        },
        {
          key: "settings",
          label: "Settings",
          childrenFields: [
            {
              key: "notifications",
              label: "Notifications",
              defaultValue: true,
            },
            { key: "theme", label: "Theme", defaultValue: "light" },
            {
              key: "privacy",
              label: "Privacy",
              childrenFields: [
                {
                  key: "shareEmail",
                  label: "Share Email",
                  defaultValue: false,
                },
              ],
            },
          ],
        },
        {
          key: "items",
          label: "Items",
          isArray: true,
          childrenFields: [
            { key: "title", label: "Title", defaultValue: "" },
            { key: "qty", label: "Quantity", defaultValue: 1 },
            {
              key: "meta",
              label: "Meta",
              childrenFields: [
                {
                  key: "tags",
                  label: "Tags",
                  isArray: true,
                  childrenFields: [
                    { key: "label", label: "Label", defaultValue: "" },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const schema: FormSchema = { fields };

      // helper: run one scenario with a fresh model
      const runScenario = (
        changePath: string[],
        unaffectedPaths: string[][],
        title: string
      ): Check[] => {
        const m = new FormModel(schema);
        const s1 = m.testGetSnapshot();
        const s2 = m.testGetSnapshot();
        const out: Check[] = [];
        out.push({ label: `${title} — No-change: s1 === s2`, pass: s1 === s2 });

        // apply change
        m.testSet(changePath);
        const s3 = m.testGetSnapshot();

        // changed path and all its ancestors should be new references
        for (let i = 1; i <= changePath.length; i++) {
          const prefix = changePath.slice(0, i);
          const n2 = findNode(s2, prefix);
          const n3 = findNode(s3, prefix);
          out.push({
            label: `${title} — Changed new ref: ${prefix.join(".")}`,
            pass: !!n2 && !!n3 && n2 !== n3,
          });
        }

        // unaffected paths should be same reference
        for (const p of unaffectedPaths) {
          const n2 = findNode(s2, p);
          const n3 = findNode(s3, p);
          out.push({
            label: `${title} — Unchanged reused: ${p.join(".")}`,
            pass: !!n2 && !!n3 && n2 === n3,
          });
        }

        // summary count (just ensure s3 exists & shaped)
        out.push({
          label: `${title} — Snapshot node count >= 1`,
          pass: countAllNodes(s3) >= 1,
        });

        return out;
      };

      // aggregate scenarios
      const c: Check[] = [];

      // Scenario A: change user.name
      c.push(
        ...runScenario(
          ["user", "name"],
          [["settings"], ["settings", "theme"], ["items"], ["user", "age"]],
          "A"
        )
      );

      // Scenario B: change user.address.city
      c.push(
        ...runScenario(
          ["user", "address", "city"],
          [
            ["user", "age"],
            ["settings"],
            ["items"],
            ["settings", "privacy", "shareEmail"],
          ],
          "B"
        )
      );

      // Scenario C: change user.contacts.phone (array template leaf)
      c.push(
        ...runScenario(
          ["user", "contacts", "phone"],
          [
            ["user", "name"],
            ["settings", "theme"],
            ["items", "meta", "tags", "label"],
          ],
          "C"
        )
      );

      // Scenario D: change settings.privacy.shareEmail
      c.push(
        ...runScenario(
          ["settings", "privacy", "shareEmail"],
          [["user"], ["items"], ["settings", "theme"]],
          "D"
        )
      );

      // Scenario E: change items.meta.tags.label (nested array under array)
      c.push(
        ...runScenario(
          ["items", "meta", "tags", "label"],
          [
            ["user", "address", "zip"],
            ["settings", "privacy", "shareEmail"],
            ["items", "qty"],
          ],
          "E"
        )
      );

      setSummary(`Scenarios executed: A, B, C, D, E`);
      setChecks(c);
    } catch (err) {
      setSummary(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setChecks([{ label: "Runtime error", pass: false }]);
    }
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        FormModel Snapshot Identity Test
      </h1>
      <p className="text-sm text-gray-600">{summary}</p>

      <ul className="space-y-2">
        {checks.map((ch, idx) => (
          <li
            key={idx}
            className={`px-3 py-2 rounded border ${
              ch.pass
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {ch.pass ? "PASS" : "FAIL"} — {ch.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
