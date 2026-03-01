import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import BabifiedTopBar from "./BabifiedTopBar";
import { CreateSOPProvider, useCreateSOP } from "../../contexts/CreateSOPContext";
import CreateSOPModal from "../CreateSOPModal";

function AppShellContent() {
  const { pathname } = useLocation();
  const { isOpen, closeCreateSOP } = useCreateSOP();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <BabifiedTopBar />

      {/* Main content area — offset by sidebar (260px) and top bar (60px) */}
      <main className="lg:pl-[260px]" style={{ paddingTop: 60 }}>
        <div className="mx-auto max-w-[900px] px-6 py-8">
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      <CreateSOPModal
        isOpen={isOpen}
        onClose={closeCreateSOP}
      />
    </div>
  );
}

export default function AppShell() {
  return (
    <CreateSOPProvider>
      <AppShellContent />
    </CreateSOPProvider>
  );
}
