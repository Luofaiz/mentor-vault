export function orderItems<T>(items: T[], order: string[], getKey: (item: T) => string) {
  const orderMap = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index, orderIndex: orderMap.get(getKey(item)) }))
    .sort((left, right) => {
      if (left.orderIndex !== undefined && right.orderIndex !== undefined) {
        return left.orderIndex - right.orderIndex;
      }
      if (left.orderIndex !== undefined) {
        return -1;
      }
      if (right.orderIndex !== undefined) {
        return 1;
      }
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function moveKey(keys: string[], sourceKey: string, targetKey: string) {
  if (sourceKey === targetKey) {
    return keys;
  }

  const sourceIndex = keys.indexOf(sourceKey);
  const targetIndex = keys.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) {
    return keys;
  }

  const nextKeys = [...keys];
  const [movedKey] = nextKeys.splice(sourceIndex, 1);
  nextKeys.splice(targetIndex, 0, movedKey);
  return nextKeys;
}
