import { TokenStoreDefinitions } from "./types";

export function memoryStore(): TokenStoreDefinitions {
  const data: Record<string, string> = {};
  return {
    getToken: (key: string): string | null => {
      try {
        return data[key];
      } catch {
        return null;
      }
    },
    clearToken: (key: string) => delete data[key],
    setToken: (key: string, value: string) => (data[key] = value),
  };
}

export default memoryStore;
