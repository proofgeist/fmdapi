import fetch from "node-fetch";
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
} from "./client-types";

type OttoAuth = {
  apiKey: string;
  ottoPort?: number;
};
type UserPasswordAuth = { username: string; password: string };
type ClientObjectProps = {
  server: string;
  db: string;
  auth: OttoAuth | UserPasswordAuth;
  /**
   * The layout to use by default for all requests. Can be overrridden on each request.
   */
  layout?: string;
};

class FileMakerError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function DataApi<Opts extends ClientObjectProps>(options: Opts) {
  const baseUrl = new URL(
    `${options.server}/fmi/data/vLatest/databases/${options.db}`
  );
  let token: string | null = null;
  if ("apiKey" in options.auth) {
    baseUrl.port = (options.auth.ottoPort ?? 3030).toString();
    token = options.auth.apiKey;
  }

  async function getToken(refresh = false): Promise<string> {
    if ("apiKey" in options.auth) return options.auth.apiKey;
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
  type CreateArgs<
    T extends FieldData = FieldData,
    U extends GenericPortalData = GenericPortalData
  > = CreateParams<U> & {
    fieldData: Partial<T>;
  };
  type GetArgs<U extends GenericPortalData = GenericPortalData> =
    GetParams<U> & {
      recordId: number;
    };
  type UpdateArgs<
    T extends FieldData = FieldData,
    U extends GenericPortalData = GenericPortalData
  > = UpdateParams<U> & {
    fieldData: Partial<T>;
    recordId: number;
  };
  type DeleteArgs = DeleteParams & {
    recordId: number;
  };
  type FindArgs<
    T extends FieldData = FieldData,
    U extends GenericPortalData = GenericPortalData
  > = ListParams<T, U> & {
    query: Query<T> | Array<Query<T>>;
    /**
     * If true, a find that returns no results will retun an empty array instead of throwing an error.
     * @default false
     */
    ignoreEmptyResult?: boolean;
  };

  return {
    /**
     * List all records from a given layout, no find criteria applied.
     */
    async list<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      args: Opts["layout"] extends string
        ? ListParams<T, U> & Partial<WithLayout>
        : ListParams<T, U> & WithLayout
    ): Promise<GetResponse<T, U>> {
      const { layout = options.layout, ...params } = args;
      return await request({
        url: `/layouts/${layout}/records`,
        method: "GET",
        // @ts-ignore
        query: params,
      });
    },
    /**
     * Create a new record in a given layout
     */
    async create<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      args: Opts["layout"] extends string
        ? CreateArgs<T, U> & Partial<WithLayout>
        : CreateArgs<T, U> & WithLayout
    ): Promise<CreateResponse> {
      const { fieldData, layout = options.layout, ...params } = args;
      return await request({
        url: `/layouts/${layout}/records`,
        body: { fieldData, ...(params ?? {}) },
      });
    },
    /**
     * Get a single record by Internal RecordId
     */
    async get<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      args: Opts["layout"] extends string
        ? GetArgs<U> & Partial<WithLayout>
        : GetArgs<U> & WithLayout
    ): Promise<GetResponse<T, U>> {
      const { recordId, layout = options.layout, ...params } = args;
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        method: "GET",
        // @ts-ignore
        query: params,
      });
    },
    /**
     * Update a single record by internal RecordId
     */
    async update<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
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
    },
    /**
     * Delete a single record by internal RecordId
     */
    async delete<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
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
    },
    /**
     * Find records in a given layout
     */
    async find<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      args: Opts["layout"] extends string
        ? FindArgs<T, U> & Partial<WithLayout>
        : FindArgs<T, U> & WithLayout
    ): Promise<GetResponse<T, U>> {
      const {
        query: queryInput,
        layout = options.layout,
        ignoreEmptyResult = false,
        ...params
      } = args;
      const query = !Array.isArray(queryInput) ? [queryInput] : queryInput;
      return await request({
        url: `/layouts/${layout}/_find`,
        body: { query, ...params },
        method: "POST",
      }).catch((e) => {
        if (
          ignoreEmptyResult &&
          e instanceof FileMakerError &&
          e.code === "401"
        )
          return { data: [] };
        throw e;
      });
    },
    /**
     * Get the metadata for a given layout
     */
    async metadata(
      args: Opts["layout"] extends string ? Partial<WithLayout> : WithLayout
    ): Promise<MetadataResponse> {
      const { layout = options.layout } = args;
      return await request({ method: "GET", url: `/layouts/${layout}` });
    },
    /**
     * Forcibly logout of the Data API session
     */
    disconnect(): Opts["auth"] extends OttoAuth ? never : Promise<void> {
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
    },
  };
}

export default DataApi;
export { DataApi, FileMakerError };
