// @cloudflare/vitest-pool-workers >= 0.13 no longer exposes the "cloudflare:test"
// ambient module via its package.json "types" field. This type reference resolves
// through normal node_modules lookup, so it works regardless of hoist layout.
/// <reference types="@cloudflare/vitest-pool-workers/types/cloudflare-test" />
