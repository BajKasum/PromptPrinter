export interface GenerationInput {
  name: string;
  idea: string;
  audience: string;
  tools: {
    // A preset tool name (e.g. Claude, Lovable) or a user-supplied custom name.
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
