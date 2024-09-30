import { BaseFetchAdapter } from './fetch-base.js';
import type { BaseFetchAdapterOptions } from './fetch-base-types.js';

export type Otto3APIKey = `KEY_${string}`;
export type OttoFMSAPIKey = `dk_${string}`;
export type OttoAPIKey = Otto3APIKey | OttoFMSAPIKey;

export function isOtto3APIKey(key: string): key is Otto3APIKey {
  return key.startsWith('KEY_');
}
export function isOttoFMSAPIKey(key: string): key is OttoFMSAPIKey {
  return key.startsWith('dk_');
}
export function isOttoAPIKey(key: string): key is OttoAPIKey {
  return isOtto3APIKey(key) || isOttoFMSAPIKey(key);
}

export function isOttoAuth(auth: unknown): auth is OttoAuth {
  if (typeof auth !== 'object' || auth === null) return false;
  return 'apiKey' in auth;
}

type OttoAuth =
  | {
      apiKey: Otto3APIKey;
      ottoPort?: number;
    }
  | { apiKey: OttoFMSAPIKey; ottoPort?: never };

export type OttoAdapterOptions = BaseFetchAdapterOptions & {
  auth: OttoAuth;
};

export class OttoAdapter extends BaseFetchAdapter {
  private apiKey: OttoAPIKey | Otto3APIKey;
  private port: number | undefined;

  constructor(options: OttoAdapterOptions) {
    super({ ...options, refreshToken: false });
    this.apiKey = options.auth.apiKey;
    this.port = options.auth.ottoPort;

    if (this.apiKey.startsWith('KEY_')) {
      // otto v3 uses port 3030
      this.baseUrl.port = (this.port ?? 3030).toString();
    } else if (this.apiKey.startsWith('dk_')) {
      // otto v4 uses default port, but with /otto prefix
      this.baseUrl.pathname = `/otto/${this.baseUrl.pathname}`;
    } else {
      throw new Error(
        "Invalid Otto API key format. Must start with 'KEY_' (Otto v3) or 'dk_' (OttoFMS)",
      );
    }
  }

  protected override getToken = async (): Promise<string> => {
    return this.apiKey;
  };
}
