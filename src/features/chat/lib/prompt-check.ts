// Die Prompt-Prüfung liegt in shared/lib/prompt-check.ts, weil sie auch vor dem Teilen eines gespeicherten Prompts
// läuft (features/prompts/components/share-prompt.tsx). Der Chat importiert sie weiter über diesen Pfad.
export { checkPrompt, type PromptRisk, type PromptRiskKind } from "@/shared/lib/prompt-check";
