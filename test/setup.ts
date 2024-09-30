import { OttoFMSAPIKey } from '../src/adapters/otto';
import { DataApi, OttoAdapter } from '../src/index';

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (
  !process.env.FM_SERVER ||
  !process.env.FM_DATABASE ||
  !process.env.OTTO_API_KEY
)
  throw new Error(
    'FM_SERVER, FM_DATABASE, and OTTO_API_KEY must be set in the environment',
  );

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
  layout: 'layout',
});
export const weirdPortalClient = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as OttoFMSAPIKey },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
  layout: 'Weird Portals',
});
