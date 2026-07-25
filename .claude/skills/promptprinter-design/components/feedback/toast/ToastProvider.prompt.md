Toast — bottom-right notification stack. Wrap the app once in `<ToastProvider>`, then call `useToast()` anywhere beneath it. `variant="success"`/`"error"` show Finn (celebrating / sad); `"default"` shows a plain info glyph.

```jsx
function SaveButton() {
  const { toast } = useToast();
  return (
    <Button onClick={() => toast({ title: "Gespeichert", variant: "success" })}>
      Speichern
    </Button>
  );
}

<ToastProvider mascotBase="../../assets/mascot">
  <SaveButton />
</ToastProvider>
```

Auto-dismisses after 4s. Pass `mascotBase` matching the consuming page's relative depth to `assets/mascot`.
