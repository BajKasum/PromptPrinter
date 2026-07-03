// Loose shape for a project's stored `tools` jsonb — every field optional,
// since a general-pack row only ever carries `{ target }`. Deliberately
// distinct from lib/tools.ts's ProjectTools (all fields required), which
// validates an outgoing /api/generate request instead of describing
// whatever ended up stored.
export type ProjectTools = {
  master?: string;
  frontend?: string;
  backend?: string;
  database?: string;
};
