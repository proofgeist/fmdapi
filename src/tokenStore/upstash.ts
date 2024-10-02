import type { TokenStoreDefinitions } from "./types.js";
import type { RedisConfigNodejs } from "@upstash/redis";

export function upstashTokenStore(
  config: RedisConfigNodejs,
  options: { prefix?: string } = {},
): TokenStoreDefinitions {
  const { prefix = "" } = options;

  const getRedis = async () => {
    const redis = await import("@upstash/redis");
    return new redis.Redis(config);
  };

  return {
    getToken: async (key: string) => {
      const redis = await getRedis();
      return redis.get(prefix + key);
    },
    setToken: async (key: string, value: string) => {
      const redis = await getRedis();
      await redis.set(prefix + key, value);
    },
    clearToken: async (key: string) => {
      const redis = await getRedis();
      await redis.del(prefix + key);
    },
  };
}

export default upstashTokenStore;
