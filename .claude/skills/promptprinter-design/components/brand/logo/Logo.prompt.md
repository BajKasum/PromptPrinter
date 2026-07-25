Logo / LogoMark — the brand lockup. No separate logo file exists in the source (see readme → Iconography): the mark IS `assets/mascot/dolphin.png`, and the wordmark is live text, not baked into an image.

```jsx
<Logo />
<Logo accentWordmark />
<Logo iconOnly size={26} />
<LogoMark size={26} />
<Logo collapsed={scrolled} />
```

`collapsed` (boolean, only pass it on scroll-driven navbars) animates the wordmark's width away, leaving just the mark.
