/* eslint-disable @typescript-eslint/no-explicit-any */
import { S, L, U } from "ts-toolbelt";

type TransformedFields<T extends Record<string, any>> = U.Merge<
  {
    [Field in keyof T]: {
      [Key in Field extends string
        ? L.Last<S.Split<Field, "::">>
        : Field]: T[Field];
    };
  }[keyof T]
>;

export function removeFMTableNames<T extends Record<string, any>>(
  obj: T
): TransformedFields<T> {
  const newObj: any = {};
  for (const key in obj) {
    if (key.includes("::")) {
      const newKey = key.split("::")[1];
      newObj[newKey] = obj[key];
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

export type Otto3APIKey = `KEY_${string}`;
export type OttoFMSAPIKey = `dk_${string}`;
export type OttoAPIKey = Otto3APIKey | OttoFMSAPIKey;

export function isOtto3APIKey(key: string): key is Otto3APIKey {
  return key.startsWith("KEY_");
}
export function isOttoFMSAPIKey(key: string): key is OttoFMSAPIKey {
  return key.startsWith("dk_");
}
export function isOttoAPIKey(key: string): key is OttoAPIKey {
  return isOtto3APIKey(key) || isOttoFMSAPIKey(key);
}
