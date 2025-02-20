import type {
  CreateParams,
  CreateResponse,
  DeleteParams,
  DeleteResponse,
  FieldData,
  GetParams,
  GetResponse,
  ListParamsRaw,
  LayoutMetadataResponse,
  Query,
  UpdateParams,
  UpdateResponse,
} from "../client-types.js";

export type BaseRequest = {
  layout: string;
  fetch?: RequestInit;
  timeout?: number;
};

export type ListOptions = BaseRequest & { data: ListParamsRaw };
export type GetOptions = BaseRequest & {
  data: GetParams & { recordId: number };
};
export type FindOptions = BaseRequest & {
  data: ListParamsRaw & { query: Array<Query> };
};
export type CreateOptions = BaseRequest & {
  data: CreateParams & { fieldData: Partial<FieldData> };
};
export type UpdateOptions = BaseRequest & {
  data: UpdateParams & { recordId: number; fieldData: Partial<FieldData> };
};
export type DeleteOptions = BaseRequest & {
  data: DeleteParams & { recordId: number };
};
export type ContainerUploadOptions = BaseRequest & {
  data: {
    containerFieldName: string;
    repetition?: string | number;
    file: Blob;
    recordId: string | number;
    modId?: number;
  };
};

export type LayoutMetadataOptions = BaseRequest;

export interface Adapter {
  list: (opts: ListOptions) => Promise<GetResponse>;
  get: (opts: GetOptions) => Promise<GetResponse>;
  find: (opts: FindOptions) => Promise<GetResponse>;
  create: (opts: CreateOptions) => Promise<CreateResponse>;
  update: (opts: UpdateOptions) => Promise<UpdateResponse>;
  delete: (opts: DeleteOptions) => Promise<DeleteResponse>;
  containerUpload: (opts: ContainerUploadOptions) => Promise<void>;

  layoutMetadata: (
    opts: LayoutMetadataOptions,
  ) => Promise<LayoutMetadataResponse>;
}
