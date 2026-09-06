// Loose shape for a project's stored `tools` jsonb, every field optional,
// since a general-pack row only ever carries `{ target }`. Used by
// projects/page.tsx to render each project's tool badges; the ProjectCard
// component this file was named for is gone (Wahrheits-Pass, 2026-07), only
// this type survived. Was deliberately distinct from settings/lib/tools.ts's
// own (removed) ProjectTools, which described a user's tool *defaults*
// (M-18, Audit 06.09.2026) — that settings feature is gone, this one (what
// ended up stored on a specific project) is untouched by that removal.
export type ProjectTools = {
  master?: string;
  frontend?: string;
  backend?: string;
  database?: string;
};
