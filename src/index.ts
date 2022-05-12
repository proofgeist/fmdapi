import fetch from "node-fetch";
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

type ClientObjectProps = {
  server: string;
  db: string;
  auth:
    | {
        apiKey: string;
        ottoPort?: number;
      }
    | { username: string; password: string };
  layout?: string;
};

class FileMakerError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function DataApi(options: ClientObjectProps) {
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

  return {
    /**
     * List all records from a given layout, no find criteria applied.
     * @param layout The layout to use
     * @param params Options for sorting, pagination
     * @returns
     */
    async list<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(layout: string, params?: ListParams<T, U>): Promise<GetResponse<T, U>> {
      return await request({
        url: `/layouts/${layout}/records`,
        method: "GET",
        // @ts-ignore
        query: params,
      });
    },
    /**
     * Create a new record in a given layout
     * @param layout The layout to use
     * @param fieldData Data to set into the new record
     * @param params Additional options, including portal data if present on the layout
     * @returns
     */
    async create<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      fieldData: Partial<T>,
      params?: CreateParams<U>
    ): Promise<CreateResponse> {
      return await request({
        url: `/layouts/${layout}/records`,
        body: { fieldData, ...params },
      });
    },
    /**
     * Get a single record by Internal RecordId
     * @param layout The layout to use
     * @param recordId Internal FileMaker record ID to retrieve
     * @param params @deprecated Not working currently
     * @returns
     */
    async get<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      params?: GetParams<U>
    ): Promise<GetResponse<T, U>> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        method: "GET",
      });
    },
    /**
     * Update a single record by internal RecordId
     * @param layout The layout to use
     * @param recordId Internal FileMaker record ID to update
     * @param fieldData Data to set into the record
     * @param params Portal data, modId, etc
     * @returns
     */
    async update<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      fieldData: Partial<T>,
      params?: UpdateParams<U>
    ): Promise<UpdateResponse> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        body: { fieldData, ...params },
        method: "PATCH",
      });
    },
    /**
     * Delete a single record by internal RecordId
     * @param layout The layout to use
     * @param recordId Internal FileMaker record ID to delete
     * @param params Additional script params
     * @returns
     */
    async delete<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      params?: DeleteParams
    ): Promise<DeleteResponse> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        query: params,
        method: "DELETE",
      });
    },
    /**
     * Find records in a given layout
     * @param layout The layout to use
     * @param query Array or object of FileMaker find criteria
     * @param params params for portal data, etc
     * @param ignoreEmptyResult If true, will NOT throw an error if the find returns no results
     * @returns
     */
    async find<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      query: Query<T> | Array<Query<T>>,
      params: ListParams<T, U> = {},
      ignoreEmptyResult = false
    ): Promise<GetResponse<T, U>> {
      if (!Array.isArray(query)) {
        query = [query];
      }
      try {
        return await request({
          url: `/layouts/${layout}/_find`,
          body: { query, ...params },
          method: "POST",
        });
      } catch (e) {
        if (
          ignoreEmptyResult &&
          e instanceof FileMakerError &&
          e.code === "401"
        )
          return { data: [] };
        throw e;
      }
    },
    /**
     * Get the metadata for a given layout
     */
    async metadata(args: {
      /**
       * The layout to use
       */
      layout: string;
    }): Promise<MetadataResponse> {
      const { layout } = args;
      const resp = await request({ method: "GET", url: `/layouts/${layout}` });
      return resp;
    },
    /**
     * Forcibly logout of the Data API session
     * @returns
     */
    async disconnect() {
      if ("apiKey" in options.auth)
        throw new Error("Cannot disconnect when using Otto API key.");

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
    },
  };
}

export default DataApi;
export { DataApi, FileMakerError };
