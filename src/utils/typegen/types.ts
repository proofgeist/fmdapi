import { type FetchAdapterOptions } from "../../adapters/fetch.js";
import { type OttoAdapterOptions } from "../../adapters/otto.js";
import { type TokenStoreDefinitions } from "../../tokenStore/types.js";

export type ClientObjectProps = OttoAdapterOptions | FetchAdapterOptions;

export type ValueListsOptions = "strict" | "allowEmpty" | "ignore";

export type GenerateSchemaOptions = {
  envNames?: Partial<Omit<ClientObjectProps, "layout">>;
  schemas: Array<{
    layout: string;
    schemaName: string;
    valueLists?: ValueListsOptions;
    /**
     * If `true`, the generated files will include a layout-specific client. Set this to `false` if you only want to use the types. Overrides the top-level generateClient option for this specific schema.
     * @default true
     */
    generateClient?: boolean;
    /** If `true`, number fields will be typed as `number | null` instead of `number | string`. If the data cannot be parsed as a number, it will be set to `null`.
     * @default false
     */
    strictNumbers?: boolean;
  }>;
  /**
   * If `true`, the generated files will include a layout-specific client. Set this to `false` if you only want to use the types
   * @default true
   */
  generateClient?: boolean;
  /**
   * The path to the directory where the generated files will be saved.
   * @default `schema`
   */
  path?: string;
  /**
   * If `true`, the generated files will also generate a `Zod` schema and validate the data returned from FileMaker using the zod schemas to give you runtime checks for your data.
   * @default true
   */
  useZod?: boolean;
  /**
   * @deprecated This function was only relevant for the FetchAdapter and will not be included in your generated layout client anyway.
   */
  tokenStore?: () => TokenStoreDefinitions;
  /**
   * If set, the generated files will include the webviewer client instead of the standard REST API client.
   * This script should pass the parameter to the Execute Data API Script step and return the result to the webviewer per the "@proofgeist/fm-webviewer-fetch" documentation.
   * Requires "@proofgeist/fm-webviewer-fetch" installed as a peer dependency.
   * The REST API client (and related credentials) is still needed to generate the types.
   *
   * @link https://fm-webviewer-fetch.proofgeist.com/
   */
  webviewerScriptName?: string;

  /**
   * The suffix to add at the end of the generated layout-specific Data API client name.
   * @default `Client`
   */
  clientSuffix?: string;
  /**
   * If `true`, the directory specified in `path` will be cleared before generating the new files, ensuring that old schema files are removed from your project.
   * @default false
   */
  clearOldFiles?: boolean;
};

export type TSchema = {
  name: string;
  type: "string" | "fmnumber" | "valueList";
  values?: string[];
};

export type BuildSchemaArgs = {
  schemaName: string;
  schema: Array<TSchema>;
  type: "zod" | "ts";
  portalSchema?: { schemaName: string; schema: Array<TSchema> }[];
  valueLists?: { name: string; values: string[] }[];
  envNames: Omit<ClientObjectProps, "layout" | "tokenStore">;
  layoutName: string;
  strictNumbers?: boolean;
  configLocation?: string;
  webviewerScriptName?: string;
} & Pick<GenerateSchemaOptions, "tokenStore">;
