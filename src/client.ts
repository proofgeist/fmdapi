import { z } from "zod";
import type { Adapter } from "./adapters/core.js";
import type {
  CreateParams,
  CreateResponse,
  DeleteParams,
  DeleteResponse,
  FMRecord,
  FieldData,
  GenericPortalData,
  GetParams,
  GetResponse,
  GetResponseOne,
  ListParams,
  Query,
  UpdateParams,
  UpdateResponse,
} from "./client-types.js";
import { ZGetResponse } from "./client-types.js";
import { FileMakerError } from "./index.js";

function asNumber(input: string | number): number {
  return typeof input === "string" ? parseInt(input) : input;
}

export type ClientObjectProps = {
  /**
   * The layout to use by default for all requests. Can be overrridden on each request.
   */
  layout?: string;
  zodValidators?: {
    fieldData: z.AnyZodObject;
    portalData?: z.AnyZodObject;
  };
};

type WithLayout = {
  /**
   * The layout to use for the request.
   */
  layout: string;
};

type FetchOptions = {
  fetch?: RequestInit;
};

function DataApi<
  Opts extends ClientObjectProps = ClientObjectProps,
  Td extends FieldData = FieldData,
  Ud extends GenericPortalData = GenericPortalData,
  Adp extends Adapter = Adapter,
>(options: Opts & { adapter: Adp }) {
  const zodTypes = options.zodValidators;
  const {
    create,
    delete: _adapterDelete,
    find,
    get,
    list,
    update,
    layoutMetadata,
    ...otherMethods
  } = options.adapter;

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

  /**
   * List all records from a given layout, no find criteria applied.
   */
  async function _list(): Promise<GetResponse<Td, Ud>>;
  async function _list<T extends FieldData = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions,
  ): Promise<GetResponse<T, U>>;
  async function _list<T extends FieldData = Td, U extends Ud = Ud>(
    args?: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions,
  ): Promise<GetResponse<T, U>> {
    const { layout = options.layout, fetch, timeout, ...params } = args ?? {};
    if (layout === undefined) throw new Error("Layout is required");

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

    const result = await list({
      layout,
      data: params,
      fetch,
      timeout,
    });

    if (result.dataInfo.foundCount > result.dataInfo.returnedCount) {
      // more records found than returned
      if (args?.limit === undefined && args?.offset === undefined) {
        // and the user didn't specify a limit or offset, so we should warn them
        console.warn(
          `🚨 @proofgeist/fmdapi: Loaded only ${result.dataInfo.returnedCount} of the ${result.dataInfo.foundCount} records from your "${layout}" layout. Use the "listAll" method to automatically paginate through all records, or specify a "limit" and "offset" to handle pagination yourself.`,
        );
      }
    }

    if (zodTypes) ZGetResponse(zodTypes).parse(result);
    return result as GetResponse<T, U>;
  }

  /**
   * Paginate through all records from a given layout, no find criteria applied.
   * ⚠️ WARNING: Use this method with caution, as it can be slow with large datasets
   */
  async function listAll<
    T extends FieldData = Td,
    U extends Ud = Ud,
  >(): Promise<FMRecord<T, U>[]>;
  async function listAll<T extends FieldData = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions,
  ): Promise<FMRecord<T, U>[]>;
  async function listAll<T extends FieldData = Td, U extends Ud = Ud>(
    args?: Opts["layout"] extends string
      ? ListParams<T, U> & Partial<WithLayout> & FetchOptions
      : ListParams<T, U> & WithLayout & FetchOptions,
  ): Promise<FMRecord<T, U>[]> {
    let runningData: GetResponse<T, U>["data"] = [];
    const limit = args?.limit ?? 100;
    let offset = args?.offset ?? 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = (await _list({
        ...args,
        offset,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  async function _create<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? CreateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : CreateArgs<T, U> & WithLayout & FetchOptions,
  ): Promise<CreateResponse> {
    const { layout = options.layout, fetch, timeout, ...params } = args ?? {};
    if (layout === undefined) throw new Error("Layout is required");
    return await create({ layout, data: params, fetch, timeout });
  }

  /**
   * Get a single record by Internal RecordId
   */
  async function _get<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? GetArgs<U> & Partial<WithLayout> & FetchOptions
      : GetArgs<U> & WithLayout & FetchOptions,
  ): Promise<GetResponse<T, U>> {
    args.recordId = asNumber(args.recordId);
    const {
      recordId,
      layout = options.layout,
      fetch,
      timeout,
      ...params
    } = args;
    if (layout === undefined) throw new Error("Layout is required");

    const data = await get({
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
    if (zodTypes)
      return ZGetResponse(zodTypes).parse(data) as GetResponse<T, U>;
    return data as GetResponse<T, U>;
  }

  /**
   * Update a single record by internal RecordId
   */
  async function _update<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? UpdateArgs<T, U> & Partial<WithLayout> & FetchOptions
      : UpdateArgs<T, U> & WithLayout & FetchOptions,
  ): Promise<UpdateResponse> {
    args.recordId = asNumber(args.recordId);
    const {
      recordId,
      layout = options.layout,
      fetch,
      timeout,
      ...params
    } = args;
    if (layout === undefined) throw new Error("Layout is required");
    return await update({
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
  }

  /**
   * Delete a single record by internal RecordId
   */
  async function deleteRecord(
    args: Opts["layout"] extends string
      ? DeleteArgs & Partial<WithLayout> & FetchOptions
      : DeleteArgs & WithLayout & FetchOptions,
  ): Promise<DeleteResponse> {
    args.recordId = asNumber(args.recordId);
    const {
      recordId,
      layout = options.layout,
      fetch,
      timeout,
      ...params
    } = args;
    if (layout === undefined) throw new Error("Layout is required");

    return _adapterDelete({
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
  }

  /**
   * Find records in a given layout
   */
  async function _find<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout & FetchOptions,
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
    if (layout === undefined) throw new Error("Layout is required");

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
    const data = (await find({
      data: { ...params, query },
      layout,
      fetch,
      timeout,
    }).catch((e: unknown) => {
      if (ignoreEmptyResult && e instanceof FileMakerError && e.code === "401")
        return { data: [] };
      throw e;
    })) as GetResponse<T, U>;

    if (data.dataInfo.foundCount > data.dataInfo.returnedCount) {
      // more records found than returned
      if (args?.limit === undefined && args?.offset === undefined) {
        console.warn(
          `🚨 @proofgeistfmdapi: Loaded only ${data.dataInfo.returnedCount} of the ${data.dataInfo.foundCount} records from your "${layout}" layout. Use the "findAll" method to automatically paginate through all records, or specify a "limit" and "offset" to handle pagination yourself.`,
        );
      }
    }

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
      : FindArgs<T, U> & WithLayout & FetchOptions,
  ): Promise<GetResponseOne<T, U>> {
    const res = await _find<T, U>(args);
    if (res.data.length !== 1)
      throw new Error(`${res.data.length} records found; expecting exactly 1`);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    if (!res.data[0]) throw new Error("No data found");
    return { ...res, data: res.data[0] };
  }

  /**
   * Helper method for `find`. Will only return the first result instead of an array.
   */
  async function findFirst<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout & FetchOptions,
  ): Promise<GetResponseOne<T, U>> {
    const res = await _find<T, U>(args);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    if (!res.data[0]) throw new Error("No data found");
    return { ...res, data: res.data[0] };
  }

  /**
   * Helper method for `find`. Will return the first result or null if no results are found.
   */
  async function maybeFindFirst<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & IgnoreEmptyResult & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & IgnoreEmptyResult & WithLayout & FetchOptions,
  ): Promise<GetResponseOne<T, U> | null> {
    const res = await _find<T, U>(args);
    if (zodTypes) ZGetResponse(zodTypes).parse(res);
    if (!res.data[0]) return null;
    return { ...res, data: res.data[0] };
  }

  /**
   * Helper method for `find` to page through all found results.
   * ⚠️ WARNING: Use with caution as this can be a slow operation with large datasets
   */
  async function findAll<T extends Td = Td, U extends Ud = Ud>(
    args: Opts["layout"] extends string
      ? FindArgs<T, U> & Partial<WithLayout> & FetchOptions
      : FindArgs<T, U> & WithLayout & FetchOptions,
  ): Promise<FMRecord<T, U>[]> {
    let runningData: GetResponse<T, U>["data"] = [];
    const limit = args.limit ?? 100;
    let offset = args.offset ?? 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = await _find<T, U>({
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

  async function _layoutMetadata(
    args: Opts["layout"] extends string
      ? { timeout?: number } & Partial<WithLayout> & FetchOptions
      : { timeout?: number } & WithLayout & FetchOptions,
  ) {
    const { layout, ...params } = args;
    if (layout === undefined) throw new Error("Layout is required");
    return await layoutMetadata({
      layout,
      fetch: params.fetch,
      timeout: params.timeout,
    });
  }

  return {
    ...otherMethods,
    layout: options.layout as Opts["layout"],
    list: _list,
    listAll,
    create: _create,
    get: _get,
    update: _update,
    delete: deleteRecord,
    find: _find,
    findOne,
    findFirst,
    maybeFindFirst,
    findAll,
    layoutMetadata: _layoutMetadata,
  };
}

export default DataApi;
export { DataApi };
