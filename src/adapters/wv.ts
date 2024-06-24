import { fmFetch } from "@proofgeist/fm-webviewer-fetch";
import {
  CreateResponse,
  DeleteResponse,
  GetResponse,
  LayoutMetadataResponse,
  RawFMResponse,
  UpdateResponse,
} from "../client-types.js";
import { FileMakerError } from "../index.js";
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
} from "./core.js";

export type ExecuteScriptOptions = BaseRequest & {
  data: { script: string; scriptParam?: string };
};

export type WebViewerAdapterOptions = {
  scriptName: string;
};

export class WebViewerAdapter implements Adapter {
  protected scriptName: string;

  constructor(options: WebViewerAdapterOptions & { refreshToken?: boolean }) {
    this.scriptName = options.scriptName;
  }

  protected async request(params: {
    layout: string;
    body: object;
    action?: "read" | "metaData" | "create" | "update" | "delete" | "duplicate";
  }): Promise<unknown> {
    const { action = "read", layout, body } = params;

    const resp = await fmFetch<RawFMResponse>(this.scriptName, {
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

  public async list(opts: ListOptions): Promise<GetResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as GetResponse;
  }

  public async get(opts: GetOptions): Promise<GetResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as GetResponse;
  }

  public async find(opts: FindOptions): Promise<GetResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as GetResponse;
  }

  public async create(opts: CreateOptions): Promise<CreateResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "create",
      body: data,
      layout,
    });
    return resp as CreateResponse;
  }

  public async update(opts: UpdateOptions): Promise<UpdateResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "update",
      layout,
      body: data,
    });
    return resp as UpdateResponse;
  }

  public async delete(opts: DeleteOptions): Promise<DeleteResponse> {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "delete",
      body: data,
      layout,
    });
    return resp as DeleteResponse;
  }

  public async layoutMetadata(
    opts: LayoutMetadataOptions
  ): Promise<LayoutMetadataResponse> {
    return (await this.request({
      action: "metaData",
      layout: opts.layout,
      body: {},
    })) as LayoutMetadataResponse;
  }
}
