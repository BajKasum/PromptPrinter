import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:ml-[240px] px-6 md:px-10 pt-0 pb-16">
        <Topbar />
        <div className="pt-6 md:pt-8">{children}</div>
      </div>
    </div>
  );
}
