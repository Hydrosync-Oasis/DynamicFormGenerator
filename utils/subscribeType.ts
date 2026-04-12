import { FieldKey } from "./type";

export type SubscribeTopic = keyof typeof ValueTypeOfProps;

export type LazyTopic = {
  [K in keyof typeof ValueTypeOfProps]: (typeof ValueTypeOfProps)[K] extends "lazy"
    ? K
    : never;
}[keyof typeof ValueTypeOfProps];

export type ImmediateTopic = Exclude<SubscribeTopic, LazyTopic>;

export const ValueTypeOfProps = {
  dirty: "immediate",
  touch: "lazy",
  value: "lazy",
  error: "immediate",
} as const;

export function IsLazyTopic(topic: SubscribeTopic): topic is LazyTopic {
  return ValueTypeOfProps[topic] === "lazy";
}

export type SubscribePropCurrentObject<K extends SubscribeTopic> =
  | (K extends ImmediateTopic
      ? SubscribePropValueType<K>
      : {
          valueGetter: undefined | (() => SubscribePropValueType<K>);
        })
  | undefined;

export type SubscribePropValueType<T extends SubscribeTopic> = T extends "value"
  ?
      | {
          hasValue: true;
          value: any;
        }
      | {
          hasValue: false;
        }
  : boolean;

export type SubscribeNode = {
  key: FieldKey;
  children: Map<FieldKey, SubscribeNode>;
  subscriber: Partial<{
    [K in SubscribeTopic]: {
      value: {
        old?: SubscribePropValueType<K>;
        current: SubscribePropCurrentObject<K>;
      };
      fn: Set<Function>;
    };
  }>;
  parent: SubscribeNode | undefined;
};
