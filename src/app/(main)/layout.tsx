import BottomNav from "@/components/BottomNav";
import { requireProfile } from "@/lib/session";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProfile();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
