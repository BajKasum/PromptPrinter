Mascot / AnimatedMascot — Finn, the product's guide character (see readme → Content Fundamentals and MASCOT.md for the full 14-state system and section-by-section journey). One character, swapped expression + idle motion per moment; never two Finns visible at once.

```jsx
<Mascot state="idle" size={96} />
<AnimatedMascot state="welcoming" size={184} priority />
<AnimatedMascot state="thinking" motion="think" size={52} />
```

`state` resolves both artwork and default idle-motion via `MASCOT_STATES`; `AnimatedMascot` adds the looping motion (skipped under `prefers-reduced-motion`, handled globally by tokens/motion.css). Pass `assetsBase` matching the consuming page's relative depth to `assets/mascot` (default assumes this component's own card depth).
