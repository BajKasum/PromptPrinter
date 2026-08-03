// The shapes the BYOK settings UI needs to describe a user's custom endpoint.
//
// Lives here rather than next to the logic in server/byok.ts because the
// settings components are client components: importing the type from a module
// carrying `import "server-only"` works (types are erased before the bundler
// sees them) but reads as a client→server dependency in every boundary check,
// and the erasure is the only reason it is harmless. A type that both sides
// need belongs to neither side.

/** The user's custom-endpoint BYOK config, without the key itself. */
export type CustomProviderMeta = { label: string; baseUrl: string; model: string };
