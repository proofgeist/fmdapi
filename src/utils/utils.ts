import type { S, L, U } from 'ts-toolbelt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformedFields<T extends Record<string, any>> = U.Merge<
  {
    [Field in keyof T]: {
      [Key in Field extends string
        ? L.Last<S.Split<Field, '::'>>
        : Field]: T[Field];
    };
  }[keyof T]
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeFMTableNames<T extends Record<string, any>>(
  obj: T,
): TransformedFields<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newObj: any = {};
  for (const key in obj) {
    if (key.includes('::')) {
      const newKey = key.split('::')[1];
      newObj[newKey as keyof TransformedFields<T>] = obj[key];
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}