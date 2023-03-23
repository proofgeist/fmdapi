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

export const getFMRecordAsZod = <
  T extends z.AnyZodObject,
  U extends z.AnyZodObject
>({
  fieldData,
  portalData,
}: ZInput<T, U>): z.ZodTypeAny => {
  const obj = z.object({
    fieldData: fieldData,
    recordId: z.string(),
    modId: z.string(),
  });
  if (portalData) {
    const portalObj = z.object({});
    Object.keys(portalData).forEach((key) => {
      portalObj.extend({ [key]: portalData.shape[key] });
    });
    obj.extend({ portalData: portalObj }).strict();
  }
  return obj;
};

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
  timeout?: number;
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

export const ZDataInfo = z.object({
  database: z.string(),
  layout: z.string(),
  table: z.string(),
  totalRecordCount: z.number(),
  foundCount: z.number(),
  returnedCount: z.number(),
});
export type DataInfo = z.infer<typeof ZDataInfo>;

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
  dataInfo: DataInfo;
};
export type GetResponseOne<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = ScriptResponse & {
  data: FMRecord<T, U>;
  dataInfo: DataInfo;
};

type ZInput<T, U> = {
  fieldData: T;
  portalData?: U;
};
export const ZGetResponse = <
  T extends z.AnyZodObject,
  U extends z.AnyZodObject
>({
  fieldData,
  portalData,
}: ZInput<T, U>): z.ZodType<
  GetResponse<z.infer<T>, z.infer<U>>
  // z.ZodTypeDef,
  // any
> =>
  ZScriptResponse.extend({
    data: z.array(getFMRecordAsZod({ fieldData, portalData })),
    dataInfo: ZDataInfo,
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

/**
 * Represents the data returned by a call to the Data API `layouts` endpoint.
 */
export type LayoutsResponse = {
  /**
   * A list of `Layout` or `LayoutsFolder` objects.
   */
  layouts: LayoutOrFolder[];
};

/**
 * Represents a FileMaker layout.
 */
export type Layout = {
  /**
   * The name of the layout
   */
  name: string;
  /**
   * If the node is a layout, `table` may contain the name of the table
   * the layout is associated with.
   */
  table: string;
};

/**
 * Represents a folder of `Layout` or `LayoutsFolder` objects.
 */
export type LayoutsFolder = {
  /**
   * The name of the folder
   */
  name: string;
  isFolder: boolean;
  /**
   * A list of the Layout or LayoutsFolder objects in the folder.
   */
  folderLayoutNames?: LayoutOrFolder[];
};

export type LayoutOrFolder = Layout | LayoutsFolder;

/**
 * Represents the data returned by a call to the Data API `scripts` endpoint.
 */
export type ScriptsMetadataResponse = {
  /**
   * A list of `Layout` or `LayoutsFolder` objects.
   */
  scripts: ScriptOrFolder[];
};
type Script = {
  name: string;
  isFolder: false;
};
type ScriptFolder = {
  name: string;
  isFolder: true;
  folderScriptNames: ScriptOrFolder[];
};
export type ScriptOrFolder = Script | ScriptFolder;

export type RawFMResponse<T = unknown> = {
  response?: T;
  messages?: [{ code: string }];
};
