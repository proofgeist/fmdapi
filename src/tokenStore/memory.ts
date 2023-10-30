import { TokenStoreDefinitions } from "./types.js";

export function memoryStore(): TokenStoreDefinitions {
  const data: Record<string, string> = {};
  return {
    getToken: (key: string): string | null => {
      try {
        return data[key] ?? null;
      } catch {
        return null;
      }
    },
    clearToken: (key: string) => delete data[key],
    setToken: (key: string, value: string): void => {
      data[key] = value;
    },
  };
}

export default memoryStore;
