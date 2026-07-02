import { redirect } from "next/navigation";

// "Start" ist als eigener Raum gestrichen (REDESIGN.md, Phase 1): die Sidebar
// trägt Resume/Recents selbst, gearbeitet wird in Chats und Projekten. Der
// Redirect hält alte Links und Bookmarks am Leben; ab Phase 2 zeigt er auf das
// Neuer-Chat-Home (/chats/new).
export default function DashboardRedirect() {
  redirect("/chats");
}
