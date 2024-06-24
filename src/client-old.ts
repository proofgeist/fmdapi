/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import {
  CreateParams,
  CreateResponse,
  DeleteResponse,
  FieldData,
  GenericPortalData,
  GetParams,
  GetResponse,
  ListParams,
  Query,
  UpdateParams,
  UpdateResponse,
  DeleteParams,
  LayoutMetadataResponse,
  GetResponseOne,
  ZGetResponse,
  AllLayoutsMetadataResponse,
  FMRecord,
  PortalRanges,
  ScriptsMetadataResponse,
  RawFMResponse,
  ScriptResponse,
} from "./client-types.js";
import { request as _request, getBaseUrl, getToken } from "./request.js";
import { Adapter } from "./adapters/core.js";

function asNumber(input: string | number): number {
  return typeof input === "string" ? parseInt(input) : input;
}

// type UserPasswordAuth = { username: string; password: string };
// export function isOttoAuth(auth: ClientObjectProps["auth"]): auth is OttoAuth {
//   return "apiKey" in auth;
// }

const ZodOptions = z.object({
  server: z
    .string()
    .refine((val) => val.startsWith("http"), { message: "must include http" }),
  db: z.string().min(1),
  auth: z.union([
    z.object({
      apiKey: z.string().min(1),
      ottoPort: z.number().optional(),
    }),
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
  ]),
  layout: z.string().optional(),
  tokenStore: z
    .object({
      getKey: z.function().args().returns(z.string()).optional(),
      getToken: z
        .function()
        .args(z.string())
        .returns(
          z.union([z.string().nullable(), z.promise(z.string().nullable())])
        ),
      setToken: z.function().args(z.string(), z.string()).returns(z.any()),
      clearToken: z.function().args(z.string()).returns(z.void()),
    })
    .optional(),
});

class FileMakerError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function DataApi<
  Td extends FieldData = FieldData,
  Ud extends GenericPortalData = GenericPortalData
>(
  adapter: Adapter,
  options: ClientObjectProps
  // zodTypes?: {
  //   fieldData: z.AnyZodObject;
  //   portalData?: z.AnyZodObject;
  // }
) {
  // const options = ZodOptions.strict().parse(input); // validate options

  // const baseUrl = getBaseUrl(options as ClientObjectProps);
  const request = options.adapter.request;

  // async function request(params: {
  //   url: string;
  //   body?: object;
  //   query?: Record<string, string>;
  //   method?: string;
  //   retry?: boolean;
  //   portalRanges?: PortalRanges;
  //   timeout?: number;
  //   fetchOptions?: RequestInit;
  // }): Promise<unknown> {
  //   return await _request({ options: options as ClientObjectProps, ...params });
  // }

  type WithLayout = {
    /**
     * The layout to use for the request.
     */
    layout: string;
  };
  type CreateArgs<T extends Td = Td, U extends Ud = Ud> = CreateParams<U> & {
    fieldData: Partial<T>;
  };
  type GetArgs<U extends Ud = Ud> = GetParams<U> & {
    recordId: number | string;
  };
  type UpdateArgs<T extends Td = Td, U extends Ud = Ud> = UpdateParams<U> & {
    fieldData: Partial<T>;
    recordId: number | string;
  };
  type DeleteArgs = DeleteParams & {
    recordId: number | string;
  };
  type IgnoreEmptyResult = {
    /**
     * If true, a find that returns no results will retun an empty array instead of throwing an error.
     * @default false
     */
    ignoreEmptyResult?: boolean;
  };
  type FindArgs<T extends FieldData = Td, U extends Ud = Ud> = ListParams<
    T,
    U
  > & {
    query: Query<T> | Array<Query<T>>;
    timeout?: number;
  };

  type FetchOptions = {
    fetch?: RequestInit;
  };

  /**
   * List all records from a given layout, no find criteria applied.
   */
  async function list(): Promise<GetResponse<Td, Ud>>;
  async function list<T extends FieldData = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions
  ): Promise<GetResponse<T, U>>;
  async function list<T extends FieldData = Td, U extends Ud = Ud>(
    args?: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions
  ): Promise<GetResponse<T, U>> {
    const { layout = options.layout, fetch, ...params } = args ?? {};
    if (layout === undefined) throw new Error("Must specify layout");

    // rename and refactor limit, offset, and sort keys for this request
    if ("limit" in params && params.limit !== undefined)
      delete Object.assign(params, { _limit: params.limit })["limit"];
    if ("offset" in params && params.offset !== undefined) {
      if (params.offset <= 1) delete params.offset;
      else delete Object.assign(params, { _offset: params.offset })["offset"];
    }
    if ("sort" in params && params.sort !== undefined)
      delete Object.assign(params, {
        _sort: Array.isArray(params.sort) ? params.sort : [params.sort],
      })["sort"];
    // if ("dateformats" in params && params.dateformats !== undefined)
    //   delete Object.assign(params, {
    //     dateformats:
    //       params.dateformats === "US"
    //         ? 0
    //         : params.dateformats === "file_locale"
    //         ? 1
    //         : params.dateformats === "ISO8601"
    //         ? 2
    //         : 0,
    //   })["dateformats"];

    const data = await input.adapter.request({
      action: "list",
      data: params as ListParams,
      layout,
      fetch,
    });

    if (zodTypes) {
      ZGetResponse(zodTypes).parse(data);
    }
    return data as GetResponse<T, U>;
  }

  /**
   * Paginate through all records from a given layout, no find criteria applied.
   * ⚠️ WARNING: Use this method with caution, as it can be slow depending on the amount of records.
   */
  async function listAll<
    T extends FieldData = Td,
    U extends Ud = Ud
  >(): Promise<FMRecord<T, U>[]>;
  async function listAll<T extends FieldData = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions
  ): Promise<FMRecord<T, U>[]>;
  async function listAll<T extends FieldData = Td, U extends Ud = Ud>(
    args?: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions
  ): Promise<FMRecord<T, U>[]> {
    let runningData: GetResponse<T, U>["data"] = [];
    const limit = args?.limit ?? 100;
    let offset = args?.offset ?? 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = (await list({
        ...args,
        offset,
      } as any)) as unknown as GetResponse<T, U>;
      runningData = [...runningData, ...data.data];
      if (runningData.length >= data.dataInfo.foundCount) break;
      offset = offset + limit;
    }
    return runningData;
  }
  /**
   * Create a new record in a given layout
   */
  async function create<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? CreateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : CreateArgs<T, U> & WithLayout & FetchOptions
  ): Promise<CreateResponse> {
    const { fieldData, layout = options.layout, ...params } = args;
    return (await request({
      url: `/layouts/${layout}/records`,
      body: { fieldData, ...(params ?? {}) },
      timeout: args.timeout,
      fetchOptions: args.fetch,
    })) as CreateResponse;
  }
  /**
   * Get a single record by Internal RecordId
   */
  async function get<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? GetArgs<U> & Partial<WithLayout> & FetchOptions
      : GetArgs<U> & WithLayout & FetchOptions
  ): Promise<GetResponse<T, U>> {
    args.recordId = asNumber(args.recordId);
    const { recordId, layout = options.layout, fetch, ...params } = args;

    const data = await request({
      url: `/layouts/${layout}/records/${recordId}`,
      method: "GET",
      query: params as Record<string, string>,
      timeout: args.timeout,
      fetchOptions: fetch,
    });
    if (zodTypes)
      return ZGetResponse(zodTypes).parse(data) as GetResponse<T, U>;
    return data as GetResponse<T, U>;
  }
  /**
   * Update a single record by internal RecordId
   */
  async function update<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? UpdateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : UpdateArgs<T, U> & WithLayout & FetchOptions
  ): Promise<UpdateResponse> {
    args.recordId = asNumber(args.recordId);
    const { recordId, fieldData, layout = options.layout, ...params } = args;
    return (await request({
      url: `/layouts/${layout}/records/${recordId}`,
      body: { fieldData, ...(params ?? {}) },
      method: "PATCH",
      timeout: args.timeout,
      fetchOptions: args.fetch,
    })) as UpdateResponse;
  }
  /**
   * Delete a single record by internal RecordId
   */
  async function deleteRecord(
    args: Opts["layout"] extends string
      ? DeleteArgs & Partial<WithLayout> & FetchOptions
      : DeleteArgs & WithLayout & FetchOptions
  ): Promise<DeleteResponse> {
    args.recordId = asNumber(args.recordId);
    const { recordId, layout = options.layout, fetch, ...params } = args;
    return (await request({
      url: `/layouts/${layout}/records/${recordId}`,
      query: params as Record<string, string>,
      method: "DELETE",
      timeout: args.timeout,
      fetchOptions: fetch,
    })) as DeleteResponse;
  }

  /**
   * Get the metadata for a given layout
   */
  async function metadata(
    args: Opts["layout"] extends string
      ? { timeout?: number } & Partial<WithLayout> & FetchOptions
      : { timeout?: number } & WithLayout & FetchOptions
  ): Promise<LayoutMetadataResponse> {
    const { layout = options.layout } = args;
    return (await request({
      method: "GET",
      url: `/layouts/${layout}`,
      timeout: args.timeout,
      fetchOptions: args.fetch,
    })) as LayoutMetadataResponse;
  }
  /**
   * Forcibly logout of the Data API session
   */
  function disconnect(): Opts["auth"] extends OttoAuth ? never : Promise<void> {
    if ("apiKey" in options.auth)
      throw new Error("Cannot disconnect when using Otto API key.");

    const func = async () => {
      // await request({ url: "/sessions", method: "DELETE" });
      const token = await getToken({ options: options as ClientObjectProps });
      const url = new URL(`${baseUrl}/sessions/${token}`);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      let respData: RawFMResponse;
      try {
        respData = await res.json();
      } catch {
        respData = {};
      }

      if (!res.ok) {
        throw new FileMakerError(
          respData?.messages?.[0].code ?? "500",
          `Filemaker Data API failed with (${res.status}): ${JSON.stringify(
            respData,
            null,
            2
          )}`
        );
      }

      return respData.response;
    };
    return func() as Opts["auth"] extends OttoAuth ? never : Promise<void>;
  }

  /**
   * Find records in a given layout
   */
  async function find<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout & FetchOptions
  ): Promise<GetResponse<T, U>> {
    const {
      query: queryInput,
      layout = options.layout,
      ignoreEmptyResult = false,
      timeout,
      fetch,
      ...params
    } = args;
    const query = !Array.isArray(queryInput) ? [queryInput] : queryInput;

    // rename and refactor limit, offset, and sort keys for this request
    if ("offset" in params && params.offset !== undefined) {
      if (params.offset <= 1) delete params.offset;
    }
    if ("dateformats" in params && params.dateformats !== undefined) {
      // reassign dateformats to match FileMaker's expected values
      // @ts-expect-error FM wants a string, so this is fine
      params.dateformats = (
        params.dateformats === "US"
          ? 0
          : params.dateformats === "file_locale"
          ? 1
          : params.dateformats === "ISO8601"
          ? 2
          : 0
      ).toString();
    }
    const data = (await request({
      url: `/layouts/${layout}/_find`,
      body: { query, ...params },
      method: "POST",
      timeout,
      fetchOptions: fetch,
    }).catch((e: unknown) => {
      if (ignoreEmptyResult && e instanceof FileMakerError && e.code === "401")
        return { data: [] };
      throw e;
    })) as GetResponse<T, U>;
    if (zodTypes && ignoreEmptyResult && data.data.length !== 0) {
      // only parse this if we have data. Ignoring empty result won't match this anyway
      ZGetResponse(zodTypes).parse(data);
    }
    return data;
  }

  /**
   * Helper method for `find`. Will only return the first result or throw error if there is more than 1 result.
   */
  async function findOne<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & WithLayout & FetchOptions
  ): Promise<GetResponseOne<T, U>> {
    const res = await find<T, U>(args);
    if (res.data.length !== 1)
      throw new Error(`${res.data.length} records found; expecting exactly 1`);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    return { ...res, data: res.data[0] };
  }

  /**
   * Helper method for `find`. Will only return the first result instead of an array.
   */
  async function findFirst<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout & FetchOptions
  ): Promise<GetResponseOne<T, U>> {
    const res = await find<T, U>(args);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    return { ...res, data: res.data[0] };
  }

  /**
   * Helper method for `find` to page through all found results.
   * ⚠️ WARNING: Use with caution as this can be a slow operation
   */
  async function findAll<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & WithLayout & FetchOptions
  ): Promise<FMRecord<T, U>[]> {
    let runningData: GetResponse<T, U>["data"] = [];
    const limit = args.limit ?? 100;
    let offset = args.offset ?? 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = await find<T, U>({
        ...args,
        offset,
        ignoreEmptyResult: true,
      });
      runningData = [...runningData, ...data.data];
      if (
        runningData.length === 0 ||
        runningData.length >= data.dataInfo.foundCount
      )
        break;
      offset = offset + limit;
    }
    return runningData;
  }

  type ExecuteScriptArgs = {
    script: string;
    scriptParam?: string;
    timeout?: number;
  };

  async function executeScript(
    args: Opts["layout"] extends string
      ? ExecuteScriptArgs & Partial<WithLayout> & FetchOptions
      : ExecuteScriptArgs & WithLayout & FetchOptions
  ) {
    const { script, scriptParam, layout = options.layout } = args;
    return (await request({
      url: `/layouts/${layout}/script/${script}`,
      query: scriptParam ? { "script.param": scriptParam } : undefined,
      method: "GET",
      timeout: args.timeout,
      fetchOptions: args.fetch,
    })) as Pick<ScriptResponse, "scriptResult" | "scriptError">;
  }

  /**
   * Returns a list of available layouts on the database.
   */
  async function layouts(): Promise<AllLayoutsMetadataResponse> {
    return (await request({
      url: `/layouts`,
      method: "GET",
    })) as AllLayoutsMetadataResponse;
  }
  /**
   * Returns a list of available scripts on the database.
   * @returns
   */
  async function scripts(): Promise<ScriptsMetadataResponse> {
    return (await request({
      url: `/scripts`,
      method: "GET",
    })) as ScriptsMetadataResponse;
  }

  type GlobalsArgs = {
    globalFields: Record<string, string | number>;
  };

  /**
   * Set global fields for the current session
   */
  async function globals(args: GlobalsArgs & FetchOptions) {
    const { globalFields } = args;
    return (await request({
      url: `/globals`,
      method: "PATCH",
      body: { globalFields },
      fetchOptions: args.fetch,
    })) as Record<string, never>;
  }

  return {
    baseUrl, // returned only for testing purposes
    list,
    listAll,
    create,
    get,
    update,
    delete: deleteRecord,
    metadata,
    disconnect,
    find,
    findOne,
    findFirst,
    findAll,
    executeScript,
    layouts,
    scripts,
    globals,
  };
}

export default DataApi;
export { DataApi, FileMakerError };
