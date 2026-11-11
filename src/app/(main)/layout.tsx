import SideNav from "@/components/SideNav";
import BottomNav from "@/components/BottomNav";
import Canopy from "@/components/Canopy";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <SideNav />
      <main className="flex flex-1 flex-col overflow-y-auto pb-24 md:pb-0">
        <Canopy />
        {children}
      </main>
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
