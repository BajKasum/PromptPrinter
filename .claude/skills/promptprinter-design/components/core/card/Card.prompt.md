Card — the product's one card shape (flat, hairline border, very subtle shadow). "Cards are the lazy answer" (PRODUCT.md): reach for real layout/hierarchy first, use Card only when content genuinely wants a bounded surface.

```jsx
<Card>
  <CardHeader>
    <CardTitle>Produktplan</CardTitle>
    <CardDescription>Dein App-Konzept als strukturierter Plan.</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>
    <span>3 Chats</span>
    <Button size="sm">Öffnen</Button>
  </CardFooter>
</Card>
```

All six pieces are optional except `Card` itself — compose only the parts a given card needs.
