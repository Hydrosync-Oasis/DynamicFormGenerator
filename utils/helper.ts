import { FieldPath } from "./type";

export function isChildNode(path1: FieldPath, path2: FieldPath): boolean {
  if (path1.length > path2.length) {
    return false;
  }

  for (let i in path1) {
    if (path1[i] !== path2[i]) {
      return false;
    }
  }
  return true;
}

export function isSamePath(path1: FieldPath, path2: FieldPath): boolean {
  if (path1.length !== path2.length) {
    return false;
  }
  for (let i in path1) {
    if (path1[i] !== path2[i]) {
      return false;
    }
  }
  return true;
}
