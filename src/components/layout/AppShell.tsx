import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />

      {/* Main content area — offset by sidebar (260px) and top bar (56px) */}
      <main className="lg:pl-[260px] pt-14">
        <div className="mx-auto max-w-[1100px] px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
