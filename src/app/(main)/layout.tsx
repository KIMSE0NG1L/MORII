import SideNav from "@/components/SideNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh bg-bg">
      <SideNav />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
