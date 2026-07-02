import { redirect } from "next/navigation";

type SearchParams = Promise<{ id?: string }>;

// Legacy route (REDESIGN.md, Phase 2): chats live at /chats/[id] now, a fresh
// chat starts at /chats/new. Old bookmarks like /chat?id=X are rewritten to
// the canonical URL; the ?mode=/?target= params are gone with the mode UI —
// there is only one chat.
export default async function LegacyChatRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { id } = await searchParams;
  redirect(id ? `/chats/${id}` : "/chats/new");
}
