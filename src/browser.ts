import { type ClientObjectProps, DataApi, FileMakerError } from "./client";
import { localStorageStore } from "./tokenStore/localStorage";

export default function createDataAPI(
  args: Omit<ClientObjectProps, "tokenStore"> &
    Partial<Pick<ClientObjectProps, "tokenStore">>
) {
  return DataApi({ tokenStore: localStorageStore(), ...args });
}
export { FileMakerError, createDataAPI as DataApi };
