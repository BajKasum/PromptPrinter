ToolLogo — inline brand marks (no network requests) for every build-target tool the product lets a user pick (master AI, frontend, backend, database). `TOOL_VISUAL`/`toolVisual()` carry each tool's real accent color + a one-line German blurb for picker cards.

```jsx
<ToolLogo name="Claude" size={20} />
<ToolLogo name="Supabase" size={20} />

const { color, blurb } = toolVisual("Lovable");
```

Real provider brand colors are the deliberate exception to "no raw hex" — logos must keep their own colors. Unknown names render a generic accent-blue spark fallback.
