import { TokenStoreDefinitions } from "./types.js";
import { Redis, RedisConfigNodejs } from "@upstash/redis";

export function upstashTokenStore(
  config: RedisConfigNodejs,
  options: { prefix?: string } = {}
): TokenStoreDefinitions {
  const redis = new Redis(config);
  const { prefix = "" } = options;
  return {
    getToken: async (key: string) => {
      return redis.get(prefix + key);
    },
    setToken: async (key: string, value: string) => {
      await redis.set(prefix + key, value);
    },
    clearToken: async (key: string) => {
      await redis.del(prefix + key);
    },
  };
}

export default upstashTokenStore;
