Button — the product's one interactive-action primitive, seven variants over one shape (never a second button component for a "special" case).

```jsx
<Button variant="primary" size="md">Jetzt starten</Button>
<Button variant="accent"><Icon name="arrow-right" />Leg los</Button>
<Button variant="ghost" size="sm">Abbrechen</Button>
<Button asChild variant="primary"><a href="/signup">Registrieren</a></Button>
```

Variants: `primary` (monochrome, the default action), `accent` (the one baby-blue brand moment — use once per screen, never as the default CTA), `ghost` (hairline border, transparent fill), `outline` (stronger border, transparent), `subtle` (filled with `surface`, no border), `destructive` (red, irreversible actions), `link` (inline text-only, no box).
Sizes: `sm` 36px, `md` 44px (default, meets the 44px tap-target minimum), `lg` 48px, `icon` 40×40 square (icon-only — always pair with `aria-label`).
`asChild` clones the style onto a single child element (typically an anchor) instead of wrapping it in a `<button>`.
