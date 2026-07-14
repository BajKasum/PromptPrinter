import type { GenerateRequest } from "@/lib/schemas";
import {
  SYSTEM_PROMPT,
  GENERAL_SYSTEM_PROMPT,
  briefTemplate,
  prdTemplate,
  masterPromptTemplate,
  frontendPromptTemplate,
  backendPromptTemplate,
  schemaTemplate,
  securityTemplate,
  marketingTemplate,
  seoTemplate,
  deploymentTemplate,
  generalPromptTemplate,
  generalVariantTemplate,
  GENERAL_VARIANTS,
} from "@/prompts";

export type PromptSet = { prompts: Record<string, string>; systemInstruction: string };

/** The prompt set + system instruction for the chosen pack, pure, no I/O. */
export function buildPromptSet(input: GenerateRequest): PromptSet {
  if (input.type === "general") {
    return {
      prompts: {
        prompt: generalPromptTemplate(input),
        ...Object.fromEntries(
          GENERAL_VARIANTS.map((v) => [v.key, generalVariantTemplate(input, v.angle)])
        ),
      },
      systemInstruction: GENERAL_SYSTEM_PROMPT,
    };
  }
  return {
    prompts: {
      brief: briefTemplate(input),
      prd: prdTemplate(input),
      master: masterPromptTemplate(input),
      frontend: frontendPromptTemplate(input),
      backend: backendPromptTemplate(input),
      schema: schemaTemplate(input),
      security: securityTemplate(input),
      marketing: marketingTemplate(input),
      seo: seoTemplate(input),
      deployment: deploymentTemplate(input),
    },
    systemInstruction: SYSTEM_PROMPT,
  };
}

/**
 * The overview is a faithful summary of this run's actual input, not a model
 * call, a project can now carry several generations over time (workspace-
 * native handoff), so reconstructing it later from the project row (which
 * only holds the latest/legacy values) would drift. Deterministic and
 * un-timestamped so it never goes stale once stored.
 */
export function buildOverview(input: GenerateRequest): string {
  return input.type === "general" ? buildGeneralOverview(input) : buildSoftwareOverview(input);
}

function buildSoftwareOverview(input: Extract<GenerateRequest, { type: "software" }>): string {
  return `# ${input.name}, Übersicht

**Zielgruppe** ${input.audience}

## Idee
${input.idea}

## Stack
- **Master-Prompt**, ${input.tools.master}
- **Frontend**, ${input.tools.frontend}
- **Backend**, ${input.tools.backend}
- **Datenbank**, ${input.tools.database}

## Nächste Schritte
- **Master-Prompt**, in deinen KI-Assistenten einfügen, um das Scaffolding zu starten
- **Datenbank-Schema**, zuerst im Supabase SQL-Editor ausführen
- **Frontend-Prompt**, in Lovable oder v0 einfügen
`;
}

function buildGeneralOverview(input: Extract<GenerateRequest, { type: "general" }>): string {
  return `# ${input.name}, Übersicht

**Typ** Prompt  •  **Ziel-KI** ${input.target}

## Ziel
${input.idea}

## Enthalten
- **Haupt-Prompt**, die ausgewogene, fertige Version
- **Varianten**, knapp & direkt, ausführlich & geführt, rollenbasiert

## So nutzt du es
Kopiere den Haupt-Prompt und füge ihn in ${input.target} ein. Greif zu einer Variante, wenn du einen anderen Ton oder mehr Führung brauchst.
`;
}
