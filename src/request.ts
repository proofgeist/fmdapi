import { PortalRanges, RawFMResponse } from "./client-types.js";
import { ClientObjectProps, FileMakerError } from "./client-old.js";
import memoryStore from "./tokenStore/memory.js";

export function getBaseUrl(options: ClientObjectProps) {
  const baseUrl = new URL(
    `${options.server}/fmi/data/vLatest/databases/${options.db}`
  );
  if ("apiKey" in options.auth) {
    if (options.auth.apiKey.startsWith("KEY_")) {
      // otto v3 uses port 3030
      baseUrl.port = (options.auth.ottoPort ?? 3030).toString();
    } else if (options.auth.apiKey.startsWith("dk_")) {
      // otto v4 uses default port, but with /otto prefix
      baseUrl.pathname = `/otto/fmi/data/vLatest/databases/${options.db}`;
    } else {
      throw new Error(
        "Invalid Otto API key format. Must start with 'KEY_' (Otto v3) or 'dk_' (OttoFMS)"
      );
    }
  }
  return baseUrl;
}

export async function getToken({
  refresh = false,
  options,
  fetchOptions,
}: {
  options: ClientObjectProps;
  refresh?: boolean;
  fetchOptions?: Omit<RequestInit, "method">;
}): Promise<string> {
  if ("apiKey" in options.auth) return options.auth.apiKey;

  const tokenStore = options.tokenStore ?? memoryStore();
  if (!tokenStore) throw new Error("No token store provided");

  if (!tokenStore.getKey) {
    tokenStore.getKey = () => `${options.server}/${options.db}`;
  }

  if (tokenStore === undefined) throw new Error("No token store provided");
  if (!tokenStore.getKey) throw new Error("No token store key provided");

  let token = await tokenStore.getToken(tokenStore.getKey());

  if (refresh) token = null; // clear token so are forced to get a new one

  const baseUrl = getBaseUrl(options);
  if (!token) {
    const res = await fetch(`${baseUrl}/sessions`, {
      ...fetchOptions,
      method: "POST",
      headers: {
        ...fetchOptions?.headers,
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${options.auth.username}:${options.auth.password}`
        ).toString("base64")}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new FileMakerError(data.messages[0].code, data.messages[0].message);
    }
    token = res.headers.get("X-FM-Data-Access-Token");
    if (!token) throw new Error("Could not get token");
  }

  tokenStore.setToken(tokenStore.getKey(), token);
  return token;
}

export async function request(params: {
  url: string;
  options: ClientObjectProps;
  body?: object;
  query?: Record<string, string>;
  method?: string;
  retry?: boolean;
  portalRanges?: PortalRanges;
  timeout?: number;
  fetchOptions?: RequestInit;
}): Promise<unknown> {
  const {
    query,
    body,
    method = "POST",
    retry = false,
    fetchOptions = {},
    options,
  } = params;
  const baseUrl = getBaseUrl(options);
  const url = new URL(`${baseUrl}${params.url}`);

  if (query) {
    const searchParams = new URLSearchParams(query);
    if (query.portalRanges && typeof query.portalRanges === "object") {
      for (const [portalName, value] of Object.entries(
        query.portalRanges as PortalRanges
      )) {
        if (value) {
          value.offset &&
            value.offset > 0 &&
            searchParams.set(`_offset.${portalName}`, value.offset.toString());
          value.limit &&
            searchParams.set(`_limit.${portalName}`, value.limit.toString());
        }
      }
    }
    searchParams.delete("portalRanges");
    url.search = searchParams.toString();
  }

  if (body && "portalRanges" in body) {
    for (const [portalName, value] of Object.entries(
      body.portalRanges as PortalRanges
    )) {
      if (value) {
        value.offset &&
          value.offset > 0 &&
          url.searchParams.set(
            `_offset.${portalName}`,
            value.offset.toString()
          );
        value.limit &&
          url.searchParams.set(`_limit.${portalName}`, value.limit.toString());
      }
    }
    delete body.portalRanges;
  }

  const controller = new AbortController();
  let timeout: NodeJS.Timeout | null = null;
  if (params.timeout)
    timeout = setTimeout(() => controller.abort(), params.timeout);

  const token = await getToken({ refresh: retry, options });
  const res = await fetch(url.toString(), {
    ...fetchOptions,
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...fetchOptions?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    signal: controller.signal,
  });

  if (timeout) clearTimeout(timeout);

  let respData: RawFMResponse;
  try {
    respData = await res.json();
  } catch {
    respData = {};
  }

  if (!res.ok) {
    if (respData?.messages?.[0].code === "952" && !retry) {
      // token expired, get new token and retry once
      return request({ ...params, retry: true });
    } else {
      throw new FileMakerError(
        respData?.messages?.[0].code ?? "500",
        `Filemaker Data API failed with (${res.status}): ${JSON.stringify(
          respData,
          null,
          2
        )}`
      );
    }
  }

  return respData.response;
}
