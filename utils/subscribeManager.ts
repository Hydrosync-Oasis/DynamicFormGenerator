import {
  SubscribePropCurrentObject,
  SubscribeNode,
  SubscribePropValueType,
  SubscribeTopic,
  ValueTypeOfProps,
  isLazyTopic as isLazyTopic,
  EffectNode,
  NotifiableNode,
  isVoidTopic,
  isImmediateTopic,
  isNonVoidTopic,
} from "./subscribeType";
import { FieldPath, FormCommands, ValueProxy } from "./type";

export class SubscribeManager {
  subscribeTree: SubscribeNode;
  effects: Set<EffectNode>;

  private queue1: Set<NotifiableNode>;
  private queue2: Set<NotifiableNode>;
  private isQueue1: boolean;
  readonly MAX_COUNT = 1000;

  constructor() {
    this.subscribeTree = {
      type: "sub",
      key: "dummy",
      children: new Map(),
      subscriber: {},
      parent: undefined,
    };
    this.queue1 = new Set();
    this.queue2 = new Set();
    this.isQueue1 = true;

    this.effects = new Set();
  }

  private get currentQueue() {
    return this.isQueue1 ? this.queue1 : this.queue2;
  }

  private get wipQueue() {
    return !this.isQueue1 ? this.queue1 : this.queue2;
  }

  private swapQueue() {
    this.isQueue1 = !this.isQueue1;
  }

  hasSubscribers(subscribeNode: SubscribeNode) {
    return Object.values(subscribeNode.subscriber).some(
      (topicSubscriber) => topicSubscriber.fn.size > 0,
    );
  }

  private isEqualByProp<T extends SubscribeTopic>(
    prop: T,
    oldValue: SubscribePropValueType<T> | undefined,
    currentValue: SubscribePropValueType<T> | undefined,
  ): boolean {
    if (oldValue === undefined && currentValue === undefined) {
      return true;
    }

    if (oldValue === undefined || currentValue === undefined) {
      return false;
    }

    if (prop === "value") {
      const oldTyped = oldValue as SubscribePropValueType<"value">;
      const currentTyped = currentValue as SubscribePropValueType<"value">;

      if (oldTyped.hasValue !== currentTyped.hasValue) {
        return false;
      }

      if (!oldTyped.hasValue) {
        return true;
      }

      if (oldTyped.hasValue && currentTyped.hasValue) {
        return Object.is(oldTyped.value, currentTyped.value);
      }

      return true;
    }

    if (prop === "effect") {
      return false;
    }

    return Object.is(oldValue, currentValue);
  }

  private createInitialTopicValue(topic: SubscribeTopic, fallback?: any) {
    const valueType = ValueTypeOfProps[topic];

    if (valueType === "immediate") {
      return {
        current: fallback,
      };
    }

    return {
      current: {
        valueGetter: undefined,
      },
    };
  }

  findNode(path: FieldPath): SubscribeNode | undefined {
    let cur = this.subscribeTree;
    for (let key of path) {
      const next = cur.children?.get(key);
      if (!next) {
        return undefined;
      }
      cur = next;
    }
    return cur;
  }

  setNewValue<T extends Exclude<SubscribeTopic, "effect">>(
    subscribeNode: SubscribeNode,
    topic: T,
    value: SubscribePropCurrentObject<T>,
  ) {
    const subscriber = subscribeNode.subscriber;
    let subTopic: SubscribeNode["subscriber"][T] | undefined =
      subscriber[topic];
    if (subTopic === undefined) {
      subscriber[topic] = subTopic = {
        fn: new Set(),
        value: this.createInitialTopicValue(topic),
      };
    }
    subTopic!.value.current = value;

    this.markAsShouldNotify(subscribeNode);
  }

  markAsShouldNotify(subscribeNode: NotifiableNode) {
    this.currentQueue.add(subscribeNode);
  }

  subscribeEffect(
    effectFn: Function,
    getValueProxy: ValueProxy,
    formCommands: FormCommands,
    invokeFirst: boolean = true,
  ): EffectNode {
    const subNode: EffectNode = {
      type: "effect",
      effFnArg: [getValueProxy, formCommands, "initial-run"],
      fn: effectFn,
    };
    this.effects.add(subNode);
    if (invokeFirst) {
      this.markAsShouldNotify(subNode);
    }
    subNode.effFnArg[2] = "value-changed";
    return subNode;
  }

  subscribe<T extends SubscribeTopic>(
    path: FieldPath,
    topic: T,
    subscriber: Function,
    fallback?: SubscribePropCurrentObject<T>,
  ) {
    let curNode = this.subscribeTree;

    for (const key of path) {
      const nextNode = curNode.children?.get(key);
      if (!nextNode) {
        const createdNode: SubscribeNode = {
          type: "sub",
          key,
          children: new Map(),
          subscriber: {},
          parent: curNode,
        };
        if (!curNode.children) {
          curNode.children = new Map();
        }
        curNode.children.set(key, createdNode);
        curNode = createdNode;
        continue;
      }

      curNode = nextNode;
    }

    const topicSubscriber = curNode.subscriber[topic];
    if (!topicSubscriber) {
      if (isVoidTopic(topic)) {
        curNode.subscriber[topic] = {
          value: void 0,
          fn: new Set(),
        };
      }
      if (isNonVoidTopic(topic)) {
        curNode.subscriber[topic] = {
          value: this.createInitialTopicValue(topic),
          fn: new Set(),
        };
      }
    }

    curNode.subscriber[topic]!.fn.add(subscriber);
    if (fallback) {
      this.setNewValue(curNode, topic, fallback);
      // this.notifyOneNode(curNode, topic);
    }
  }

  notify() {
    let count = 0;
    while (true) {
      const cur = this.currentQueue;
      if (cur.size === 0) {
        return;
      }
      this.swapQueue();
      cur.forEach((subNode) => {
        if (subNode.type === "effect") {
          this.notifyOneNode(subNode, "effect");
        } else {
          Object.entries(subNode.subscriber).forEach(([topic]) => {
            this.notifyOneNode(subNode, topic as SubscribeTopic);
            if (count >= this.MAX_COUNT) {
              throw new Error("max effect depth exceeded");
            }
          });
        }
      });
      cur.clear();
      count++;
    }
  }

  private notifyOneNode(node: NotifiableNode, topic: SubscribeTopic) {
    if (node.type === "sub" && topic !== "effect") {
      const subscriber = node.subscriber;
      if (subscriber[topic] === undefined) {
        return;
      }

      if (isImmediateTopic(topic) || isLazyTopic(topic)) {
        const topicSubscriber = subscriber[topic];
        if (topicSubscriber.value.current === undefined) {
          return;
        }
      }

      let curVal = undefined;
      if (isLazyTopic(topic)) {
        curVal = subscriber[topic]?.value.current?.valueGetter?.();
      }
      if (isImmediateTopic(topic)) {
        curVal = subscriber[topic]?.value.current;
      }

      if (this.isEqualByProp(topic, subscriber[topic].value.old, curVal)) {
        return;
      }

      for (let item of subscriber[topic].fn) {
        item(curVal);
      }
      subscriber[topic].value.old = curVal;
    } else if (node.type === "effect") {
      node.fn.apply(undefined, node.effFnArg);
    } else {
      node.subscriber[topic as "effect"]?.fn.forEach((fn) => fn());
    }
  }

  unsubscribeEffect(subscribeNode: EffectNode) {
    this.effects.delete(subscribeNode);
    this.wipQueue.delete(subscribeNode);
  }

  unsubscribe(path: FieldPath, topic: SubscribeTopic, subscriber: Function) {
    let curNode = this.subscribeTree;
    const visitedNodes: SubscribeNode[] = [curNode];

    for (const key of path) {
      const nextNode = curNode.children?.get(key);
      if (!nextNode) {
        return;
      }
      curNode = nextNode;
      visitedNodes.push(curNode);
    }

    const topicSubscriber = curNode.subscriber[topic];
    if (!topicSubscriber) {
      return;
    }

    topicSubscriber.fn.delete(subscriber);
    if (topicSubscriber.fn.size === 0) {
      delete curNode.subscriber[topic];
    }

    for (let i = visitedNodes.length - 1; i > 0; i--) {
      const node = visitedNodes[i];
      const hasChildren = node.children && node.children.size > 0;
      // 只删除没有子节点且没有剩余订阅存在的
      if (hasChildren || this.hasSubscribers(node)) {
        break;
      }

      this.wipQueue.delete(node);

      const parent = visitedNodes[i - 1];
      parent.children!.delete(node.key);
    }
  }
}
