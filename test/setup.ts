import { OttoFMSAPIKey } from "../src/adapters/otto";
import { DataApi, FetchAdapter, OttoAdapter } from "../src/index";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (
  !process.env.FM_SERVER ||
  !process.env.FM_DATABASE ||
  !process.env.OTTO_API_KEY
)
  throw new Error(
    "FM_SERVER, FM_DATABASE, and OTTO_API_KEY must be set in the environment",
  );

if (!process.env.FM_USERNAME || !process.env.FM_PASSWORD)
  throw new Error("FM_USERNAME and FM_PASSWORD must be set in the environment");

export const config = {
  auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
};

export const client = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
});
export const layoutClient = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
  layout: "layout",
});
export const weirdPortalClient = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
  layout: "Weird Portals",
});

export const containerClient = DataApi<
  any,
  { myContainer: string; repeatingContainer: string }
>({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
  layout: "container",
});

export const fetchClient = DataApi({
  adapter: new FetchAdapter({
    auth: {
      password: process.env.FM_PASSWORD as string,
      username: process.env.FM_USERNAME as string,
    },
    db: config.db,
    server: config.server,
  }),
});
