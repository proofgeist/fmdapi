---
"@proofgeist/fmdapi": major
---

Use native fetch (Node 18+).

This package now requires Node 18+ and no longer relys on the `node-fetch` package.
Each method supports passing additional options to the `fetch` function via the `fetch` parameter. This is useful if used within a framework that overrides the global `fetch` function (such as Next.js).
