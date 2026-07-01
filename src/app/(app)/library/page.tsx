import { redirect } from "next/navigation";

// Folded into Projekte (search + filters over the same project/artifact data,
// see projects/page.tsx). This route only exists so old links/bookmarks land
// somewhere real; middleware still gates it, so an unauthenticated visit goes
// to /login first.
export default function LibraryPage() {
  redirect("/projects");
}
