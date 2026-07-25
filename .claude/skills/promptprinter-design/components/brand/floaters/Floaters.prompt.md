Floaters — ambient rising bubbles + a few accent-warm sparks, Finn's ocean. Decoration only; always give the parent `position: relative` (and usually `overflow: hidden`).

```jsx
<section style={{ position: "relative", overflow: "hidden" }}>
  <Floaters items={FLOATER_PRESETS.hero} />
  …
</section>
```

Write a fixed, deterministic `items` array per section (not randomized) so density/spread matches that section's size — `FLOATER_PRESETS` has two ready-made layouts to start from.
