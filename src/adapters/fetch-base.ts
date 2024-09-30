import {
  AllLayoutsMetadataResponse,
  CreateResponse,
  DeleteResponse,
  GetResponse,
  LayoutMetadataResponse,
  PortalRanges,
  RawFMResponse,
  ScriptResponse,
  ScriptsMetadataResponse,
  UpdateResponse,
} from '../client-types.js';
import { FileMakerError } from '../index.js';
import {
  Adapter,
  BaseRequest,
  CreateOptions,
  DeleteOptions,
  FindOptions,
  GetOptions,
  LayoutMetadataOptions,
  ListOptions,
  UpdateOptions,
} from './core.js';
import {
  BaseFetchAdapterOptions,
  GetTokenArguments,
} from './fetch-base-types.js';

export type ExecuteScriptOptions = BaseRequest & {
  script: string;
  scriptParam?: string;
};

export class BaseFetchAdapter implements Adapter {
  protected server: string;
  protected db: string;
  private refreshToken: boolean;
  baseUrl: URL;

  constructor(options: BaseFetchAdapterOptions & { refreshToken?: boolean }) {
    this.server = options.server;
    this.db = options.db;
    this.refreshToken = options.refreshToken ?? false;
    this.baseUrl = new URL(
      `${this.server}/fmi/data/vLatest/databases/${this.db}`,
    );

    if (this.db === '') throw new Error('Database name is required');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getToken = async (args?: GetTokenArguments): Promise<string> => {
    // method must be implemented in subclass
    throw new Error('getToken method not implemented by Fetch Adapter');
  };

  protected request = async (params: {
    url: string;
    body?: object;
    query?: Record<string, string>;
    method?: string;
    retry?: boolean;
    portalRanges?: PortalRanges;
    timeout?: number;
    fetchOptions?: RequestInit;
  }): Promise<unknown> => {
    const {
      query,
      body,
      method = 'GET',
      retry = false,
      fetchOptions = {},
    } = params;
    const url = new URL(`${this.baseUrl}${params.url}`);

    if (query) {
      const searchParams = new URLSearchParams(query);
      if (query.portalRanges && typeof query.portalRanges === 'object') {
        for (const [portalName, value] of Object.entries(
          query.portalRanges as PortalRanges,
        )) {
          if (value) {
            value.offset &&
              value.offset > 0 &&
              searchParams.set(
                `_offset.${portalName}`,
                value.offset.toString(),
              );
            value.limit &&
              searchParams.set(`_limit.${portalName}`, value.limit.toString());
          }
        }
      }
      searchParams.delete('portalRanges');
      url.search = searchParams.toString();
    }

    if (body && 'portalRanges' in body) {
      for (const [portalName, value] of Object.entries(
        body.portalRanges as PortalRanges,
      )) {
        if (value) {
          value.offset &&
            value.offset > 0 &&
            url.searchParams.set(
              `_offset.${portalName}`,
              value.offset.toString(),
            );
          value.limit &&
            url.searchParams.set(
              `_limit.${portalName}`,
              value.limit.toString(),
            );
        }
      }
      delete body.portalRanges;
    }

    const controller = new AbortController();
    let timeout: NodeJS.Timeout | null = null;
    if (params.timeout)
      timeout = setTimeout(() => controller.abort(), params.timeout);

    const token = await this.getToken({ refresh: retry });
    const res = await fetch(url.toString(), {
      ...fetchOptions,
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...fetchOptions?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
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
      if (
        respData?.messages?.[0].code === '952' &&
        !retry &&
        this.refreshToken
      ) {
        // token expired, get new token and retry once
        return this.request({ ...params, retry: true });
      } else {
        throw new FileMakerError(
          respData?.messages?.[0].code ?? '500',
          `Filemaker Data API failed with (${res.status}): ${JSON.stringify(
            respData,
            null,
            2,
          )}`,
        );
      }
    }

    return respData.response;
  };

  public list = async (opts: ListOptions): Promise<GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/records`,
      query: data as Record<string, string>,
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as GetResponse;
  };

  public get = async (opts: GetOptions): Promise<GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/records/${data.recordId}`,
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as GetResponse;
  };

  public find = async (opts: FindOptions): Promise<GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/_find`,
      body: data,
      method: 'POST',
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as GetResponse;
  };

  public create = async (opts: CreateOptions): Promise<CreateResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/records`,
      body: data,
      method: 'POST',
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as CreateResponse;
  };

  public update = async (opts: UpdateOptions): Promise<UpdateResponse> => {
    const {
      data: { recordId, ...data },
      layout,
    } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/records/${recordId}`,
      body: data,
      method: 'PATCH',
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as UpdateResponse;
  };

  public delete = async (opts: DeleteOptions): Promise<DeleteResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/records/${data.recordId}`,
      method: 'DELETE',
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as DeleteResponse;
  };

  public layoutMetadata = async (
    opts: LayoutMetadataOptions,
  ): Promise<LayoutMetadataResponse> => {
    return (await this.request({
      url: `/layouts/${opts.layout}`,
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    })) as LayoutMetadataResponse;
  };

  /**
   * Execute a script within the database
   */
  public executeScript = async (opts: ExecuteScriptOptions) => {
    const { script, scriptParam, layout } = opts;
    const resp = await this.request({
      url: `/layouts/${layout}/script/${script}`,
      query: scriptParam ? { 'script.param': scriptParam } : undefined,
      fetchOptions: opts.fetch,
      timeout: opts.timeout,
    });
    return resp as ScriptResponse;
  };

  /**
   * Returns a list of available layouts on the database.
   */
  public layouts = async (opts?: Omit<BaseRequest, 'layout'>) => {
    return (await this.request({
      url: '/layouts',
      fetchOptions: opts?.fetch,
      timeout: opts?.timeout,
    })) as AllLayoutsMetadataResponse;
  };

  /**
   * Returns a list of available scripts on the database.
   */
  public scripts = async (opts?: Omit<BaseRequest, 'layout'>) => {
    return (await this.request({
      url: '/scripts',
      fetchOptions: opts?.fetch,
      timeout: opts?.timeout,
    })) as ScriptsMetadataResponse;
  };

  /**
   * Set global fields for the current session
   */
  public globals = async (
    opts: Omit<BaseRequest, 'layout'> & {
      globalFields: Record<string, string | number>;
    },
  ) => {
    return (await this.request({
      url: '/globals',
      method: 'PATCH',
      body: { globalFields: opts.globalFields },
      fetchOptions: opts?.fetch,
      timeout: opts?.timeout,
    })) as Record<string, never>;
  };
}
