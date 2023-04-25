# @proofgeist/fmdapi

## 3.0.8

- fix: file return types to conform to zod validator
- fix: if no token store is provided, default memory store was not being imported correctly
- fix: memory token store would throw error during zod validation
- add back default export
- support commonJS and module imports in codegen cli
- improve cli, supports .mjs config file by default
- 129f9a6: fix codegen import

## 3.0.0

### Major Changes

- 5c2f0d2: Use native fetch (Node 18+).

  This package now requires Node 18+ and no longer relys on the `node-fetch` package.
  Each method supports passing additional options to the `fetch` function via the `fetch` parameter. This is useful if used within a framework that overrides the global `fetch` function (such as Next.js).

### Minor Changes

- 5c2f0d2: Custom functions to override where the temporary access token is stored
- add LocalStorage and Upstash helper methods for token store
