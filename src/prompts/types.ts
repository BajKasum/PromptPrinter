// The software-build pack: a project described as a product idea, generating the
// full 10-artifact build packet. `type` discriminates it from other packs.
export interface GenerationInput {
  type: "software";
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

// The general pack: a freeform goal turned into one ready-to-use prompt plus a
// few stylistic variants. Not tied to software — works for study material,
// writing, planning, anything. `target` is the assistant the prompt is written
// for (Claude / ChatGPT / Gemini or a custom name).
export interface GeneralInput {
  type: "general";
  name: string;
  idea: string;
  target: string;
}

export interface GeneralOutputs {
  prompt: string;
  variant_a: string;
  variant_b: string;
  variant_c: string;
}
