import BottomNav from "@/components/BottomNav";

// Auth is already enforced by proxy.ts (redirects signed-out requests before
// they reach here) and by each page's own requireProfile() call, which they
// need anyway to load their data. Checking again here would just double
// every navigation's round trip to Supabase for no extra safety.
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
