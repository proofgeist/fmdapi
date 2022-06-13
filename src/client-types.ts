import { T } from "ts-toolbelt";
import { z } from "zod";

export const ZFieldValue = z.union([z.string(), z.number()]);
export type FieldValue = z.infer<typeof ZFieldValue>;

export const ZFieldData = z.record(z.string(), ZFieldValue);
export type FieldData = z.infer<typeof ZFieldData>;

export type ZodGenericPortalData = z.ZodObject<{
  [key: string]: z.ZodObject<{ [x: string]: z.ZodString | z.ZodNumber }>;
}>;
export type GenericPortalData = z.infer<ZodGenericPortalData>;

export type PortalsWithIds<U extends GenericPortalData = GenericPortalData> = {
  [key in keyof U]: Array<
    U[key] & {
      recordId: string;
      modId: string;
    }
  >;
};

export const getFMRecordAsZod = <T, U>({
  fieldData,
  portalData,
}: ZInput<T, U>): z.ZodTypeAny => {
  const obj = z.object({
    fieldData: fieldData,
    recordId: z.string(),
    modId: z.string(),
  });
  if (portalData) {
    obj.extend({ portalData });
  }
  return obj;
};
export type FMRecord2 = z.infer<ReturnType<typeof getFMRecordAsZod>>;

export type FMRecord<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = {
  fieldData: T;
  recordId: string;
  modId: string;
  portalData: PortalsWithIds<U>;
};

export type ScriptParams = {
  script?: string;
  "script.param"?: string;
  "script.prerequest"?: string;
  "script.prerequest.param"?: string;
  "script.presort"?: string;
  "script.presort.param"?: string;
};

const ZScriptResponse = z.object({
  scriptResult: z.string().optional(),
  scriptError: z.string().optional(),
  "scriptResult.prerequest": z.string().optional(),
  "scriptError.prerequest": z.string().optional(),
  "scriptResult.presort": z.string().optional(),
  "scriptError.presort": z.string().optional(),
});
export type ScriptResponse = z.infer<typeof ZScriptResponse>;

export type CreateParams<U> = ScriptParams & { portalData?: U };

export type CreateResponse = ScriptResponse & {
  recordId: string;
  modId: string;
};

export type UpdateParams<U> = CreateParams<U> & {
  modId?: number;
};

export type UpdateResponse = ScriptResponse & {
  modId: string;
};

export type DeleteParams = ScriptParams;

export type DeleteResponse = ScriptResponse;

export type RangeParams = {
  offset?: number;
  limit?: number;
};

export type PortalRanges<U extends GenericPortalData = GenericPortalData> =
  Partial<{ [key in keyof U]: RangeParams }>;

export type PortalRangesParams<
  U extends GenericPortalData = GenericPortalData
> = {
  portalRanges?: PortalRanges<U>;
};

export type GetParams<U extends GenericPortalData = GenericPortalData> =
  ScriptParams &
    PortalRangesParams<U> & {
      "layout.response"?: string;
    };

export type Sort<T extends FieldData = FieldData> = {
  fieldName: keyof T;
  sortOrder: "ascend" | "descend" | string;
};

export type ListParams<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = GetParams<U> &
  RangeParams & {
    sort?: Sort<T> | Array<Sort<T>>;
  };

export type GetResponse<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = ScriptResponse & {
  data: Array<FMRecord<T, U>>;
};
export type GetResponseOne<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = ScriptResponse & {
  data: FMRecord<T, U>;
};

type ZInput<T, U> = {
  fieldData: z.ZodType<FieldData>;
  portalData?: ZodGenericPortalData;
};
export const ZGetResponse = <T extends FieldData, U extends GenericPortalData>({
  fieldData,
  portalData,
}: ZInput<T, U>): z.ZodType<GetResponse<T, U>, z.ZodTypeDef, any> =>
  ZScriptResponse.extend({
    data: z.array(getFMRecordAsZod({ fieldData, portalData })),
  });
type ZGetResponseReturnType<T, U> = z.infer<ReturnType<typeof ZGetResponse>>;
export type Query<T extends FieldData = FieldData> = Partial<{
  [key in keyof T]: T[key] | string;
}> & {
  omit?: boolean;
};

export type MetadataResponse = {
  fieldMetaData: FieldMetaData[];
  portalMetaData: { [key: string]: FieldMetaData[] };
  valueLists?: ValueList[];
};

export type FieldMetaData = {
  name: string;
  type: "normal" | "calculation" | "summary";
  displayType:
    | "editText"
    | "popupList"
    | "popupMenu"
    | "checkBox"
    | "calendar"
    | "radioButtons"
    | "secureText";
  result: "text" | "number" | "date" | "time" | "timeStamp" | "container";
  global: boolean;
  autoEnter: boolean;
  fourDigitYear: boolean;
  maxRepeat: number;
  maxCharacters: number;
  notEmpty: boolean;
  numeric: boolean;
  repetitions: number;
  timeOfDay: boolean;
  valueList?: string;
};

type ValueList = {
  name: string;
  // TODO need to test type of value list from other file
  type: "customList" | "byField";
  values: Array<{ value: string; displayValue: string }>;
};
