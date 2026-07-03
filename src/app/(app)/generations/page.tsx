import { redirect } from "next/navigation";

// Dissolved: each project now shows its own build history in a "Verlauf"
// section under its Ergebnisse-Bereich (see projects/[id]/results/page.tsx).
// This route only exists so old links/bookmarks land somewhere real;
// middleware still gates it, so an unauthenticated visit goes to /login first.
export default function GenerationsPage() {
  redirect("/projects");
}
