export type MasterTarget = "Claude" | "ChatGPT" | "Gemini";
export type FrontendTarget = "Lovable" | "Stitch" | "Figma" | "v0";
export type BackendTarget = "Claude Code" | "Cursor" | "Windsurf";
export type DatabaseTarget = "PostgreSQL" | "MySQL" | "Supabase";

export interface GenerationInput {
  name: string;
  idea: string;
  audience: string;
  tools: {
    master: MasterTarget;
    frontend: FrontendTarget;
    backend: BackendTarget;
    database: DatabaseTarget;
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
