---
"@proofgeist/fmdapi": minor
---

Rewrote codegen command to use ts-morph instead of typescript. This allows for the script to be run directly from npm, and increses maintainability.
Added a new alias `typegen` command. Same as `codegen`
Update tests to vitest
