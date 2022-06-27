import fetch from "node-fetch";
import { z } from "zod";
import { getSharedData, setSharedData } from "./shared";
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
  ZodGenericPortalData,
  GetResponseOne,
  ZGetResponse,
} from "./client-types";

type OttoAuth = {
  apiKey: string;
  ottoPort?: number;
};
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
};
const ZodOptions = z.object({
  server: z
    .string()
    .refine((val) => val.startsWith("http"), { message: "must include http" }),
  db: z.string().nonempty(),
  auth: z.union([
    z.object({
      apiKey: z.string().nonempty(),
      ottoPort: z.number().optional(),
    }),
    z.object({
      username: z.string().nonempty(),
      password: z.string().nonempty(),
    }),
  ]),
  layout: z.string().optional(),
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
  const sharedDataKey = `${options.server}/${options.db}`; // used for storing and re-using token

  const baseUrl = new URL(
    `${options.server}/fmi/data/vLatest/databases/${options.db}`
  );
  if ("apiKey" in options.auth) {
    baseUrl.port = (options.auth.ottoPort ?? 3030).toString();
  }

  async function getToken(refresh = false): Promise<string> {
    if ("apiKey" in options.auth) return options.auth.apiKey;

    let token = getSharedData(sharedDataKey);

    if (refresh) token = null; // clear token so are forced to get a new one

    if (!token) {
      const res = await fetch(`${baseUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${options.auth.username}:${options.auth.password}`
          ).toString("base64")}`,
        },
      });

      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new FileMakerError(
          data.messages[0].code,
          data.messages[0].message
        );
      }
      token = res.headers.get("X-FM-Data-Access-Token");
      if (!token) throw new Error("Could not get token");
    }

    setSharedData(sharedDataKey, token);
    return token;
  }

  async function request(params: {
    url: string;
    body?: object;
    query?: Record<string, string>;
    method?: string;
  }) {
    const { query, body, method = "POST" } = params;
    const url = new URL(`${baseUrl}${params.url}`);

    if (query) url.search = new URLSearchParams(query).toString();
    const token = await getToken();
    const res = await fetch(url.toString(), {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    let respData: any;
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
    recordId: number;
  };
  type UpdateArgs<T extends Td = Td, U extends Ud = Ud> = UpdateParams<U> & {
    fieldData: Partial<T>;
    recordId: number;
  };
  type DeleteArgs = DeleteParams & {
    recordId: number;
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
  };

  /**
   * List all records from a given layout, no find criteria applied.
   */
  async function list(args?: any): Promise<GetResponse<Td, Ud>>;
  async function list<T extends FieldData = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout>
      : ListParams<T, U> & WithLayout
  ): Promise<GetResponse<T, U>> {
    const { layout = options.layout, ...params } = (args = {} as any);

    // rename and refactor limit, offset, and sort keys for this request
    if (!!params.limit)
      delete Object.assign(params, { _limit: params.limit })["limit"];
    if (!!params.offset)
      delete Object.assign(params, { _offset: params.offset })["offset"];
    if (!!params.sort)
      delete Object.assign(params, {
        _sort: Array.isArray(params.sort) ? params.sort : [params.sort],
      })["sort"];

    const data = await request({
      url: `/layouts/${layout}/records`,
      method: "GET",
      // @ts-ignore
      query: params,
    });

    if (zodTypes) {
      ZGetResponse(zodTypes).parse(data);
    }
    return data;
  }
  /**
   * Create a new record in a given layout
   */
  async function create<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? CreateArgs<T, U> & Partial<WithLayout>
      : CreateArgs<T, U> & WithLayout
  ): Promise<CreateResponse> {
    const { fieldData, layout = options.layout, ...params } = args;
    return await request({
      url: `/layouts/${layout}/records`,
      body: { fieldData, ...(params ?? {}) },
    });
  }
  /**
   * Get a single record by Internal RecordId
   */
  async function get<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? GetArgs<U> & Partial<WithLayout>
      : GetArgs<U> & WithLayout
  ): Promise<GetResponse<T, U>> {
    const { recordId, layout = options.layout, ...params } = args;
    const data = await request({
      url: `/layouts/${layout}/records/${recordId}`,
      method: "GET",
      // @ts-ignore
      query: params,
    });
    if (zodTypes)
      return ZGetResponse(zodTypes).parse(data) as GetResponse<T, U>;
    return data;
  }
  /**
   * Update a single record by internal RecordId
   */
  async function update<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? UpdateArgs<T, U> & Partial<WithLayout>
      : UpdateArgs<T, U> & WithLayout
  ): Promise<UpdateResponse> {
    const { recordId, fieldData, layout = options.layout, ...params } = args;
    return await request({
      url: `/layouts/${layout}/records/${recordId}`,
      body: { fieldData, ...(params ?? {}) },
      method: "PATCH",
    });
  }
  /**
   * Delete a single record by internal RecordId
   */
  async function deleteRecord<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? DeleteArgs & Partial<WithLayout>
      : DeleteArgs & WithLayout
  ): Promise<DeleteResponse> {
    const { recordId, layout = options.layout, ...params } = args;
    return await request({
      url: `/layouts/${layout}/records/${recordId}`,
      // @ts-ignore
      query: params,
      method: "DELETE",
    });
  }

  /**
   * Get the metadata for a given layout
   */
  async function metadata(
    args: Opts["layout"] extends string ? Partial<WithLayout> : WithLayout
  ): Promise<MetadataResponse> {
    const { layout = options.layout } = args;
    return await request({ method: "GET", url: `/layouts/${layout}` });
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

      let respData: any;
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
    // @ts-ignore
    return func();
  }

  /**
   * Find records in a given layout
   */
  async function find<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout>
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout
  ): Promise<GetResponse<T, U>> {
    const {
      query: queryInput,
      layout = options.layout,
      ignoreEmptyResult = false,
      ...params
    } = args;
    const query = !Array.isArray(queryInput) ? [queryInput] : queryInput;
    const data = await request({
      url: `/layouts/${layout}/_find`,
      body: { query, ...params },
      method: "POST",
    }).catch((e) => {
      if (ignoreEmptyResult && e instanceof FileMakerError && e.code === "401")
        return { data: [] };
      throw e;
    });
    if (zodTypes) ZGetResponse(zodTypes).parse(data);
    return data;
  }

  /**
   * Helper method for `find`. Will only return the first result or throw error if there is more than 1 result.
   */
  async function findOne<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & Partial<WithLayout>
      : FindArgs<T, U> & WithLayout
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
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout>
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout
  ): Promise<GetResponseOne<T, U>> {
    const res = await find<T, U>(args);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    return { ...res, data: res.data[0] };
  }

  return {
    baseUrl, // returned only for testing purposes
    list,
    create,
    get,
    update,
    delete: deleteRecord,
    metadata,
    disconnect,
    find,
    findOne,
    findFirst,
  };
}

export default DataApi;
export { DataApi, FileMakerError };
