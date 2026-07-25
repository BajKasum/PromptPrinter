Badge / PlanBadge — small pills. `Badge` is the generic uppercase-mono tag ("Neu", "Beta", "Pro" — the product's `.chip` utility); `PlanBadge` is the specific free/pro/team + admin pill reused across sidebar, settings and billing.

```jsx
<Badge>Beta</Badge>
<Badge accent>Neu</Badge>
<PlanBadge plan="pro" />
<PlanBadge plan="free" isAdmin />
```
