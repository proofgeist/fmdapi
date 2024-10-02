import { generateTypedClients } from "./typegen/index.js";
import { getLayoutMetadata } from "./typegen/getLayoutMetadata.js";
export type {
  ValueListsOptions,
  GenerateSchemaOptions,
} from "./typegen/types.js";

/**
 * @deprecated Use `getLayoutMetadata` from `@proofgeist/fmdapi/typegen` instead.
 */
export const getSchema: typeof getLayoutMetadata = async (...args) => {
  return await getLayoutMetadata(...args);
};

/**
 * @deprecated Use `generateTypedClients` from `@proofgeist/fmdapi/typegen` instead.
 */
export const generateSchemas: typeof generateTypedClients = async (...args) => {
  generateTypedClients(...args);
  return;
};
