// Loose shape for a project's stored `tools` jsonb, every field optional,
// since a general-pack row only ever carries `{ target }`. Deliberately
// distinct from lib/tools.ts's ProjectTools (all fields required), which
// describes a user's tool *defaults* (settings), not what ended up stored
// on any one project. Used by projects/page.tsx to render each project's
// tool badges; the ProjectCard component this file was named for is gone
// (Wahrheits-Pass, 2026-07), only this type survived.
export type ProjectTools = {
  master?: string;
  frontend?: string;
  backend?: string;
  database?: string;
};
