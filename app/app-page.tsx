"use client";

import { Generator } from "@/utils/generator";
import { FormModel } from "@/utils/structures";
import { Button } from "antd";
import { useMemo } from "react";
import z from "zod";

export default function AppPage() {
  const model = useMemo(() => {
    const model = new FormModel({
      fields: [
        {
          key: "arrayTest",
          isArray: true,
          arraySchema: {
            childrenFields: [
              {
                key: "name",
                label: "Name",
                control: "input",
                validate: z
                  .string()
                  .min(2, "Name must be at least 2 characters"),
              },
              {
                key: "age",
                label: "Age",
                control: "input",
                validate: z.coerce
                  .number()
                  .min(0, "Age must be a positive number"),
              },
              {
                isArray: true,
                key: "tags",
                arraySchema: {
                  childrenFields: [
                    {
                      key: "tag",
                      label: "Tag",
                      control: "input",
                      validate: z
                        .string()
                        .min(2, "Tag must be at least 2 characters"),
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    model.updateChildren(
      ["arrayTest"],
      [
        {
          name: "Alice",
          age: 30,
          tags: [{ tag: "friend" }, { tag: "colleague" }],
        },
        { name: "Bob", age: 25, tags: [{ tag: "family" }] },
      ]
    );
    model.setRefiner(["arrayTest"], (zodType) => {
      return zodType.refine(
        (arr) => {
          if (arr === undefined) return true;
          if (!Array.isArray(arr)) return false;
          return arr.length > 1;
        },
        {
          message: "You can only add more than 1 item",
          path: ["0", "name"],
        }
      );
    });
    console.log(model);

    return model;
  }, []);

  return (
    <>
      <Button
        onClick={() =>
          model.updateChildren(
            ["arrayTest"],
            [{ name: "Charlie", age: 28, tags: [{ tag: "gym" }] }]
          )
        }
      >
        Click Me
      </Button>
      <Generator model={model} displayFields={[[]]}></Generator>
    </>
  );
}
