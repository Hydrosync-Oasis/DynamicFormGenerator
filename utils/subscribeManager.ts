import {
  SubscribePropCurrentObject,
  SubscribeNode,
  SubscribePropValueType,
  SubscribeTopic,
  ValueTypeOfProps,
  IsLazyTopic as isLazyTopic,
} from "./subscribeType";
import { FieldPath } from "./type";

export class SubscribeManager {
  subscribeTree: SubscribeNode;
  shouldNotifyNodes: Set<SubscribeNode>;

  constructor() {
    this.subscribeTree = {
      key: "dummy",
      children: new Map(),
      subscriber: {},
      parent: undefined,
    };
    this.shouldNotifyNodes = new Set();
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

    return oldValue === currentValue;
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
      const next = cur.children.get(key);
      if (!next) {
        return undefined;
      }
      cur = next;
    }
    return cur;
  }

  setNewValue<T extends SubscribeTopic>(
    subscribeNode: SubscribeNode,
    topic: T,
    value: SubscribePropCurrentObject<T>,
  ) {
    const subscriber = subscribeNode.subscriber;
    if (!subscriber[topic]) {
      subscriber[topic] = {
        fn: new Set(),
        value: this.createInitialTopicValue(topic),
      };
    }
    subscriber[topic].value.current = value;

    this.markAsShouldNotify(subscribeNode);
  }

  markAsShouldNotify(subscribeNode: SubscribeNode) {
    this.shouldNotifyNodes.add(subscribeNode);
  }

  subscribe<T extends SubscribeTopic>(
    path: FieldPath,
    topic: T,
    subscriber: Function,
    fallback?: SubscribePropCurrentObject<T>,
  ) {
    let curNode = this.subscribeTree;
    console.log("sub");

    for (const key of path) {
      const nextNode = curNode.children.get(key);
      if (!nextNode) {
        const createdNode: SubscribeNode = {
          key,
          children: new Map(),
          subscriber: {},
          parent: curNode,
        };
        curNode.children.set(key, createdNode);
        curNode = createdNode;
        continue;
      }

      curNode = nextNode;
    }

    const topicSubscriber = curNode.subscriber[topic];
    if (!topicSubscriber) {
      curNode.subscriber[topic] = {
        value: this.createInitialTopicValue(topic),
        fn: new Set(),
      };
    }

    curNode.subscriber[topic]!.fn.add(subscriber);
    if (fallback) {
      this.setNewValue(curNode, topic, fallback);
      this.notifyOneNode(curNode, topic);
    }
  }

  notify() {
    this.shouldNotifyNodes.forEach((subNode) => {
      Object.entries(subNode.subscriber).forEach(([topic]) => {
        this.notifyOneNode(subNode, topic as SubscribeTopic);
      });
    });

    this.shouldNotifyNodes.clear();
  }

  private notifyOneNode(subscribeNode: SubscribeNode, topic: SubscribeTopic) {
    const subscriber = subscribeNode.subscriber;
    const topicSubscriber = subscriber[topic];
    if (topicSubscriber === undefined) {
      return;
    }
    if (topicSubscriber.value.current === undefined) {
      return;
    }

    let curVal = undefined;
    if (isLazyTopic(topic)) {
      curVal = subscriber[topic]?.value.current?.valueGetter?.();
    } else {
      curVal = subscriber[topic]?.value.current;
    }

    if (this.isEqualByProp(topic, topicSubscriber.value.old, curVal)) {
      return;
    }

    for (let item of topicSubscriber.fn) {
      item(curVal);
    }
    topicSubscriber.value.old = curVal;
  }

  unsubscribe(path: FieldPath, topic: SubscribeTopic, subscriber: Function) {
    console.log("unsub");
    // debugger;

    let curNode = this.subscribeTree;
    const visitedNodes: SubscribeNode[] = [curNode];

    for (const key of path) {
      const nextNode = curNode.children.get(key);
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
      const hasChildren = node.children.size > 0;
      // 只删除没有子节点且没有剩余订阅存在的
      if (hasChildren || this.hasSubscribers(node)) {
        break;
      }

      this.shouldNotifyNodes.delete(node);

      const parent = visitedNodes[i - 1];
      parent.children.delete(node.key);
    }
  }
}
