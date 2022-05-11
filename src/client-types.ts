export type Numerish = string | number;
export type FieldValue = string | Numerish;
export type FieldData = { [key: string]: FieldValue };

export type GenericPortalData = {
  [key: string]: {
    [key: string]: FieldValue;
  };
};

export type FMRecord<
  T extends FieldData = FieldData,
  U extends GenericPortalData = GenericPortalData
> = {
  fieldData: T;
  recordId: string;
  modId: string;
  portalData: {
    [key in keyof U]: Array<
      U[key] & {
        recordId: string;
        modId: string;
      }
    >;
  };
};

export type ScriptParams = {
  script?: string;
  "script.param"?: string;
  "script.prerequest"?: string;
  "script.prerequest.param"?: string;
  "script.presort"?: string;
  "script.presort.param"?: string;
};

export type ScriptResponse = {
  scriptResult?: string;
  scriptError?: string;
  "scriptResult.prerequest"?: string;
  "scriptError.prerequest"?: string;
  "scriptResult.presort"?: string;
  "scriptError.presort"?: string;
};

export type CreateParams<U> = ScriptParams & { portalData: U };

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

export type Query<T extends FieldData = FieldData> = Partial<{
  [key in keyof T]: T[key] | string;
}> & {
  omit?: boolean;
};
