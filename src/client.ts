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
  MetadataResponse,
  GetResponseOne,
  ZGetResponse,
  LayoutsResponse,
  FMRecord,
  PortalRanges,
  ScriptsMetadataResponse,
  RawFMResponse,
  ScriptResponse,
} from "./client-types.js";
import type { TokenStoreDefinitions } from "./tokenStore/types.js";
import { memoryStore } from "./tokenStore/memory.js";
import { Otto3APIKey, OttoFMSAPIKey } from "./utils/utils.js";

function asNumber(input: string | number): number {
  return typeof input === "string" ? parseInt(input) : input;
}
type OttoAuth =
  | {
      apiKey: Otto3APIKey;
      ottoPort?: number;
    }
  | { apiKey: OttoFMSAPIKey; ottoPort?: never };

type UserPasswordAuth = { username: string; password: string };
export function isOttoAuth(auth: ClientObjectProps["auth"]): auth is OttoAuth {
  return "apiKey" in auth;
}
export type ClientObjectProps = {
  server: string;
  db: string;
  auth: OttoAuth | UserPasswordAuth;
  /**
   * The layout to use by default for all requests. Can be overrridden on each request.
   */
  layout?: string;
  tokenStore?: TokenStoreDefinitions;
};
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
  Opts extends ClientObjectProps,
  Td extends FieldData = FieldData,
  Ud extends GenericPortalData = GenericPortalData
>(
  input: Opts,
  zodTypes?: {
    fieldData: z.AnyZodObject;
    portalData?: z.AnyZodObject;
  }
) {
  const options = ZodOptions.strict().parse(input); // validate options

  const tokenStore = options.tokenStore ?? memoryStore();

  const baseUrl = new URL(
    `${options.server}/fmi/data/vLatest/databases/${options.db}`
  );
  if ("apiKey" in options.auth) {
    if (options.auth.apiKey.startsWith("KEY_")) {
      // otto v3 uses port 3030
      baseUrl.port = (options.auth.ottoPort ?? 3030).toString();
    } else if (options.auth.apiKey.startsWith("dk_")) {
      // otto v4 uses default port, but with /otto prefix
      baseUrl.pathname = `/otto/fmi/data/vLatest/databases/${options.db}`;
    } else {
      throw new Error(
        "Invalid Otto API key format. Must start with 'KEY_' (Otto v3) or 'dk_' (OttoFMS)"
      );
    }
  }

  async function getToken(
    refresh = false,
    fetchOptions?: Omit<RequestInit, "method">
  ): Promise<string> {
    if ("apiKey" in options.auth) return options.auth.apiKey;

    if (!tokenStore) throw new Error("No token store provided");

    if (!tokenStore.getKey) {
      tokenStore.getKey = () => `${options.server}/${options.db}`;
    }

    if (tokenStore === undefined) throw new Error("No token store provided");
    if (!tokenStore.getKey) throw new Error("No token store key provided");

    let token = await tokenStore.getToken(tokenStore.getKey());

    if (refresh) token = null; // clear token so are forced to get a new one

    if (!token) {
      const res = await fetch(`${baseUrl}/sessions`, {
        ...fetchOptions,
        method: "POST",
        headers: {
          ...fetchOptions?.headers,
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${options.auth.username}:${options.auth.password}`
          ).toString("base64")}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new FileMakerError(
          data.messages[0].code,
          data.messages[0].message
        );
      }
      token = res.headers.get("X-FM-Data-Access-Token");
      if (!token) throw new Error("Could not get token");
    }

    tokenStore.setToken(tokenStore.getKey(), token);
    return token;
  }

  async function request(params: {
    url: string;
    body?: object;
    query?: Record<string, string>;
    method?: string;
    retry?: boolean;
    portalRanges?: PortalRanges;
    timeout?: number;
    fetchOptions?: RequestInit;
  }): Promise<unknown> {
    const {
      query,
      body,
      method = "POST",
      retry = false,
      fetchOptions = {},
    } = params;
    const url = new URL(`${baseUrl}${params.url}`);

    if (query) {
      const searchParams = new URLSearchParams(query);
      if (query.portalRanges && typeof query.portalRanges === "object") {
        for (const [portalName, value] of Object.entries(
          query.portalRanges as PortalRanges
        )) {
          if (value) {
            value.offset &&
              value.offset > 0 &&
              searchParams.set(
                `_offset.${portalName}`,
                value.offset.toString()
              );
            value.limit &&
              searchParams.set(`_limit.${portalName}`, value.limit.toString());
          }
        }
      }
      searchParams.delete("portalRanges");
      url.search = searchParams.toString();
    }

    if (body && "portalRanges" in body) {
      for (const [portalName, value] of Object.entries(
        body.portalRanges as PortalRanges
      )) {
        if (value) {
          value.offset &&
            value.offset > 0 &&
            url.searchParams.set(
              `_offset.${portalName}`,
              value.offset.toString()
            );
          value.limit &&
            url.searchParams.set(
              `_limit.${portalName}`,
              value.limit.toString()
            );
        }
      }
      delete body.portalRanges;
    }

    const controller = new AbortController();
    let timeout: NodeJS.Timeout | null = null;
    if (params.timeout)
      timeout = setTimeout(() => controller.abort(), params.timeout);

    const token = await getToken(retry);
    const res = await fetch(url.toString(), {
      ...fetchOptions,
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...fetchOptions?.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signal: controller.signal,
    });

    if (timeout) clearTimeout(timeout);

    let respData: RawFMResponse;
    try {
      respData = await res.json();
    } catch {
      respData = {};
    }

    if (!res.ok) {
      if (respData?.messages?.[0].code === "952" && !retry) {
        // token expired, get new token and retry once
        return request({ ...params, retry: true });
      } else {
        throw new FileMakerError(
          respData?.messages?.[0].code ?? "500",
          `Filemaker Data API failed with (${res.status}): ${JSON.stringify(
            respData,
            null,
            2
          )}`
        );
      }
    }

    return respData.response;
  }

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

    const data = await request({
      url: `/layouts/${layout}/records`,
      method: "GET",
      query: params as Record<string, string>,
      timeout: args?.timeout,
      fetchOptions: fetch,
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
  ): Promise<MetadataResponse> {
    const { layout = options.layout } = args;
    return (await request({
      method: "GET",
      url: `/layouts/${layout}`,
      timeout: args.timeout,
      fetchOptions: args.fetch,
    })) as MetadataResponse;
  }
  /**
   * Forcibly logout of the Data API session
   */
  function disconnect(): Opts["auth"] extends OttoAuth ? never : Promise<void> {
    if ("apiKey" in options.auth)
      throw new Error("Cannot disconnect when using Otto API key.");

    const func = async () => {
      const token = await getToken();
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
  async function layouts(): Promise<LayoutsResponse> {
    return (await request({
      url: `/layouts`,
      method: "GET",
    })) as LayoutsResponse;
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
    layouts,
    scripts,
    executeScript,
  };
}

export default DataApi;
export { DataApi, FileMakerError };
