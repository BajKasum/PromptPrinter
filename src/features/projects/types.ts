// Loose shape for a project's stored `tools` jsonb, every field optional,
// since a general-pack row only ever carries `{ target }`. Used by
// projects/page.tsx to render each project's tool badges. It describes what
// is stored on a specific project, not a user's tool defaults (there are none).
export type ProjectTools = {
  master?: string;
  frontend?: string;
  backend?: string;
  database?: string;
};
