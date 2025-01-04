export function valueToEnum<T extends Record<string, any>>(enumObj: T, value: string | number): T[keyof T] | undefined {
  const entries = Object.entries(enumObj) as [keyof T, T[keyof T]][];
  const found = entries.find(([_, enumValue]) => enumValue === value);
  return found ? enumObj[found[0]] : undefined;
}