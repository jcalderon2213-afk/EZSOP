export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 lg:left-[260px] right-0 z-20 flex h-14 items-center border-b border-card-border bg-card px-6">
      {/* Breadcrumb placeholder */}
      <span className="text-sm font-500 text-text">Dashboard</span>

      {/* Right side — org switcher / user menu will go here */}
      <div className="ml-auto" />
    </header>
  );
}
