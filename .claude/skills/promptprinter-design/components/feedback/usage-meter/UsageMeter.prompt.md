UsageMeter — a metric's real relationship to its cap (Settings, Billing). "A billing page's job is orientation, not marketing" (PRODUCT.md) — always show the bar, never a bare number.

```jsx
<UsageMeter label="Projekte" used={2} limit={5} />
<UsageMeter label="Chat-Nachrichten (Monat)" used={140} limit={Infinity} />
```

Turns amber ≥80%, red at 100%; `limit={Infinity}` renders "Unbegrenzt".
