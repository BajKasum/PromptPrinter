import { redirect } from "next/navigation";

// "Start" ist als eigener Raum gestrichen (REDESIGN.md, Phasen 1+2): die
// Sidebar trägt Resume/Recents selbst, der Einstieg ist der neue Chat. Der
// Redirect hält alte Links und Bookmarks am Leben.
export default function DashboardRedirect() {
  redirect("/chats/new");
}
