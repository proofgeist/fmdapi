import { TokenStoreDefinitions } from "./types";

export function localStorageStore(keyPrefix = ""): TokenStoreDefinitions {
  return {
    getToken: (key: string) => {
      return window.localStorage.getItem(`${keyPrefix}${key}`);
    },
    clearToken: (key: string) => {
      window.localStorage.removeItem(`${keyPrefix}${key}`);
    },
    setToken: (key: string, value: string) => {
      window.localStorage.setItem(`${keyPrefix}${key}`, value);
    },
  };
}

export default localStorageStore;
