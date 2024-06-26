<p align="center" style="display:flex;justify-content:center; align-items:center;">
   <img height="64px" src="logo-fm.png" style="margin-right:10px;" />
   <img height="50px" src="logo-ts.png" />   
</p>

# Claris FileMaker Data API Client for TypeScript

This package is designed to make working with the FileMaker Data API much easier. Here's just a few key features:

- [Otto](https://ottofms.com/) Data API proxy support
- TypeScript support for easy auto-completion of your fields
- Automated type generation based on layout metadata
- Supports both node and edge runtimes (v3.0+)

## Installation

This library requires zod as a peer depenency and Node 18 or later

```sh
npm install @proofgeist/fmdapi zod
```

```sh
yarn add @proofgeist/fmdapi zod
```

## Upgrading to v4

Version 4 changes the way the client is created to allow for Custom Adapters, but the methods on the client remain the same. If you are using the codegen CLI tool, simply re-run codegen after upgrading to apply the changes.

- adapters
- pass layout into some functions (exposed from client)

## Quick Start

> Note: For the best experience, use the [codegen tool](#automatic-type-generation) to generate layout-specific clients and get autocomplete hints in your IDE with your actual field names. This minimal example just demonstrates the basic setup

Add the following envnironment variables to your project's `.env` file:

```sh
FM_DATABASE=filename.fmp12
FM_SERVER=https://filemaker.example.com

# if you want to use the Otto Data API Proxy
OTTO_API_KEY=KEY_123456...789
# otherwise
FM_USERNAME=admin
FM_PASSWORD=password
```

Initialize the client with credentials, depending on your adapter

```typescript
// to use the Otto Data API Proxy
import { DataApi, OttoAdapter } from "@proofgeist/fmdapi";
const client = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
});
```

```typescript
// to use the raw Data API
import { DataApi, FetchAdapter } from "@proofgeist/fmdapi";
const client = DataApi({
  adapter: new FetchAdapter({
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  }),
});
```

Then, use the client to query your FileMaker database. View all available methods here.

Basic Example:

```typescript
const result = await client.list({ layout: "Contacts" });
```

### Client Setup Options

| Option       | Type         | Description                                                                                                                                                                                                  |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth`       | `object`     | Authentication object. Must contain either `apiKey` or `username` and `password`                                                                                                                             |
| `db`         | `string`     | FileMaker database name                                                                                                                                                                                      |
| `server`     | `string`     | FileMaker server URL (must include `https://`)                                                                                                                                                               |
| `layout`     | `string`     | _(optional)_ If provided, will be the default layout used for all methods (can be overridden on a per-call basis)                                                                                            |
| `tokenStore` | `TokenStore` | _(optional)_ If provided, will use the custom set of functions to store and retrieve the short-lived access token. This only used for the username/password authenication method. See below for more details |

## TypeScript Support

The basic client will return the generic FileMaker response object by default. You can also create a type for your exepcted response and get a fully typed response that includes your own fields.

```typescript
type TContact = {
  name: string;
  email: string;
  phone: string;
};
const result = await client.list<TContact>({ layout: "Contacts" });
```

💡 TIP: For a more ergonomic TypeScript experience, use the [included codegen tool](#automatic-type-generation) to generate these types based on your FileMaker layout metadata.

For full docs, see the [wiki](https://github.com/proofgeist/fmdapi/wiki)

## Edge Runtime Support (v3.0+)

Since version 3.0 uses the native `fetch` API, it is compatible with edge runtimes, but there are some additional considerations to avoid overwhelming your FileMaker server with too many connections. If you are developing for the edge, be sure to implement one of the following strategies:

- ✅ Use a custom token store (see above) with a persistent storage method such as Upstash
- ✅ Use a proxy such as the [Otto Data API Proxy](https://www.ottofms.com/docs/otto/working-with-otto/proxy-api-keys/data-api) which handles management of the access tokens itself.
  - Providing an API key to the client instead of username/password will automatically use the Otto proxy
- ⚠️ Call the `disconnect` method on the client after each request to avoid leaving open sessions on your server
  - this method works, but is not recommended in most scenarios as it reuires a new session to be created for each request
