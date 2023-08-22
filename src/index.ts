import { DataApi, FileMakerError } from "./client";
import { DataApi as DataApiWV } from "./wv";

export { FileMakerError, DataApi, DataApiWV };
export { removeFMTableNames } from "./utils/utils";
export default DataApi;
