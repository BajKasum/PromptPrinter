export type MasterTarget = "Claude" | "ChatGPT" | "Gemini";
export type FrontendTarget = "Lovable" | "Stitch" | "Figma" | "v0";
export type BackendTarget = "Claude Code" | "Cursor" | "Windsurf";
export type DatabaseTarget = "PostgreSQL" | "MySQL" | "Supabase";

export interface GenerationInput {
  name: string;
  idea: string;
  audience: string;
  tools: {
    // A preset target (see the aliases above) or a user-supplied custom name.
    master: string;
    frontend: string;
    backend: string;
    database: string;
  };
}

export interface GenerationOutputs {
  brief: string;
  prd: string;
  master: string;
  frontend: string;
  backend: string;
  schema: string;
  security: string;
  marketing: string;
  seo: string;
  deployment: string;
}
