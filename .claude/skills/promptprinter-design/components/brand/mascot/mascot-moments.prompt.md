DolphinLoader / SuccessCelebration — the two "moment" pieces built on Finn. `DolphinLoader` is any in-progress wait; `SuccessCelebration` is a full-screen "it worked" overlay.

```jsx
<DolphinLoader size={30} label="Schreibt…" />

<SuccessCelebration
  message="Erfolgreich eingeloggt"
  onDone={() => router.push("/chats")}
/>
```
