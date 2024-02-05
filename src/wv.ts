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
  FMRecord,
  RawFMResponse,
} from "./client-types.js";

function asNumber(input: string | number): number {
  return typeof input === "string" ? parseInt(input) : input;
}

const ZodOptions = z.object({
  scriptName: z.string(),
  layout: z.string().optional(),
});
export type ClientObjectProps = z.infer<typeof ZodOptions>;

class FileMakerError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * A client intended to be used in a webviewer. This client uses the `fm-webviewer-fetch` package to make requests.
 * It requires that you have a script in your FM file that passes the parameter to the `Execute Data API` script step
 * and returns the result back to the webviewer, according to the `fm-webviewer-fetch` spec.
 * @link https://fm-webviewer-fetch.proofgeist.com/
 */
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

  async function request(params: {
    layout: string;
    body: object;
    action?: "read" | "metaData";
  }): Promise<unknown> {
    const { action = "read", layout, body } = params;
    const { fmFetch } = await import("@proofgeist/fm-webviewer-fetch").catch(
      () => {
        throw new Error(
          "@proofgeist/fm-webviewer-fetch not found. Make sure you have it installed in your project."
        );
      }
    );

    const resp = await fmFetch<RawFMResponse>(options.scriptName, {
      ...body,
      layouts: layout,
      action,
      version: "vLatest",
    });

    if (resp.messages?.[0].code !== "0") {
      throw new FileMakerError(
        resp?.messages?.[0].code ?? "500",
        `Filemaker Data API failed with (${
          resp.messages?.[0].code
        }): ${JSON.stringify(resp, null, 2)}`
      );
    }

    return resp.response;
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
    if ("offset" in params && params.offset !== undefined)
      delete Object.assign(params, { _offset: params.offset })["offset"];
    if ("sort" in params && params.sort !== undefined)
      delete Object.assign(params, {
        _sort: Array.isArray(params.sort) ? params.sort : [params.sort],
      })["sort"];

    const data = await request({
      layout,
      body: {},
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
    const myArgs = args ?? {};

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = (await list(myArgs as any)) as unknown as GetResponse<T, U>;
      runningData = [...runningData, ...data.data];
      if (runningData.length >= data.dataInfo.foundCount) break;
      offset = offset + limit;
    }
    return runningData;
  }
  /**
   * Create a new record in a given layout
   * @deprecated Not supported by Execute Data API script step
   * @throws {Error} Always
   */
  async function create<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? CreateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : CreateArgs<T, U> & WithLayout & FetchOptions
  ): Promise<CreateResponse> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fieldData, layout = options.layout, ...params } = args;
    throw new Error("Not supported by Execute Data API script step");
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
    if (!layout) throw new Error("Must specify layout");
    const data = await request({
      layout,
      body: { recordId },
    });
    if (zodTypes)
      return ZGetResponse(zodTypes).parse(data) as GetResponse<T, U>;
    return data as GetResponse<T, U>;
  }
  /**
   * Update a single record by internal RecordId
   * @deprecated Not supported by Execute Data API script step
   * @throws {Error} Always
   */
  async function update<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? UpdateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : UpdateArgs<T, U> & WithLayout & FetchOptions
  ): Promise<UpdateResponse> {
    args.recordId = asNumber(args.recordId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { recordId, fieldData, layout = options.layout, ...params } = args;
    throw new Error("Not supported by Execute Data API script step");
  }
  /**
   * Delete a single record by internal RecordId
   * @deprecated Not supported by Execute Data API script step
   * @throws {Error} Always
   */
  async function deleteRecord(
    args: Opts["layout"] extends string
      ? DeleteArgs & Partial<WithLayout> & FetchOptions
      : DeleteArgs & WithLayout & FetchOptions
  ): Promise<DeleteResponse> {
    args.recordId = asNumber(args.recordId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { recordId, layout = options.layout, fetch, ...params } = args;
    throw new Error("Not supported by Execute Data API script step");
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
    if (!layout) throw new Error("Must specify layout");
    return (await request({
      layout,
      action: "metaData",
      body: {},
    })) as MetadataResponse;
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
    if (!layout) throw new Error("Must specify layout");
    const data = (await request({
      layout,
      body: { query, ...params },
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
      console.log(data.dataInfo);
      if (
        runningData.length === 0 ||
        runningData.length >= data.dataInfo.foundCount
      )
        break;
      offset = offset + limit;
    }
    return runningData;
  }

  return {
    list,
    listAll,
    // create,
    get,
    // update,
    // delete: deleteRecord,
    // metadata,
    find,
    findOne,
    findFirst,
    findAll,
  };
}

export default DataApi;
export { DataApi, FileMakerError };
