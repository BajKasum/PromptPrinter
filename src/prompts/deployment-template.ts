import type { GenerationInput } from "./types";

export function deploymentTemplate(input: GenerationInput): string {
  return `Generate a deployment guide for "${input.name}".

## Source idea
${input.idea}

## Stack hints
- Database: ${input.tools.database}
- Backend tool: ${input.tools.backend}
- Frontend tool: ${input.tools.frontend}

## Output (Markdown)
1. **Provisioning** — which managed services to create and in what order.
2. **Environment variables** — exhaustive list with which scope (server / public).
3. **Migrations** — how to run the schema initially and on subsequent deploys.
4. **Webhooks** — Stripe and any others, with the exact URL paths.
5. **Smoke test** — 5-step manual check after first deploy.
6. **Runbook** — common operational tasks (rotating keys, restoring from backup, etc.).`;
}
