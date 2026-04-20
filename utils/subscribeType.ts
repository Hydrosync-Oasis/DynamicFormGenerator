import { never } from "zod";
import { EffectInvokeReason, FieldKey, FormCommands, ValueProxy } from "./type";

export type SubscribeTopic = keyof typeof ValueTypeOfProps;

type PickProps<T extends ValueType> = {
  [K in keyof typeof ValueTypeOfProps]: (typeof ValueTypeOfProps)[K] extends T
    ? K
    : never;
}[keyof typeof ValueTypeOfProps];

export type LazyTopic = PickProps<"lazy">;

export type ImmediateTopic = PickProps<"immediate">;

export type VoidTopic = PickProps<"void">;

export const ValueTypeOfProps = {
  dirty: "immediate",
  touch: "lazy",
  value: "lazy",
  rawValue: "lazy",
  error: "immediate",
  effect: "void",
} as const;

type ValueType = (typeof ValueTypeOfProps)[keyof typeof ValueTypeOfProps];

export function isLazyTopic(topic: SubscribeTopic): topic is LazyTopic {
  return ValueTypeOfProps[topic] === "lazy";
}

export function isVoidTopic(topic: SubscribeTopic): topic is VoidTopic {
  return ValueTypeOfProps[topic] === "void";
}

export function isNonVoidTopic(
  topic: SubscribeTopic,
): topic is Exclude<keyof typeof ValueTypeOfProps, VoidTopic> {
  return ValueTypeOfProps[topic] !== "void";
}

export function isImmediateTopic(
  topic: SubscribeTopic,
): topic is ImmediateTopic {
  return ValueTypeOfProps[topic] === "immediate";
}

export type SubscribePropCurrentObject<K extends SubscribeTopic> =
  | (K extends ImmediateTopic
      ? SubscribePropValueType<K>
      : {
          valueGetter: undefined | (() => SubscribePropValueType<K>);
        })
  | undefined;

export type SubscribePropValueType<T extends SubscribeTopic> =
  T extends "rawValue"
    ? any
    : T extends "value"
      ?
          | {
              hasValue: true;
              value: any;
            }
          | {
              hasValue: false;
            }
      : T extends "effect"
        ? void
        : boolean;

export type NotifiableNode = EffectNode | SubscribeNode;

export type EffectNode = {
  type: "effect";
  effFnArg: [ValueProxy, FormCommands, EffectInvokeReason];
  fn: Function;
};

export type SubscribeNode = {
  type: "sub";
  key: FieldKey;
  children?: Map<FieldKey, SubscribeNode>;
  subscriber: Partial<{
    [K in SubscribeTopic]: {
      value: K extends "effect"
        ? void
        : {
            old?: SubscribePropValueType<K>;
            current: SubscribePropCurrentObject<K>;
          };
      fn: Set<Function>;
    };
  }>;
  parent: SubscribeNode | undefined;
};
