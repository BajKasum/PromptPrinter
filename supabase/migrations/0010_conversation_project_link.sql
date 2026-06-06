-- PromptPrinter — link a chat to the project it refines (Phase 3)
-- Prompt Code now produces the build packet AND a chat to refine it. A
-- conversation can belong to a project so reopening the project shows the same
-- refine-chat. Chats from the standalone Prompt-Chat flow keep project_id null;
-- when a project is deleted its refine-chat goes with it.

alter table public.conversations
  add column if not exists project_id uuid
    references public.projects(id) on delete cascade;

create index if not exists conversations_project_idx
  on public.conversations(project_id);
