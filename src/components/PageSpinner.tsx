import { Loader2 } from "lucide-react";

// Shown by each route's loading.tsx while its Server Component fetches data,
// so a click gets instant feedback instead of a frozen screen.
export default function PageSpinner() {
  return (
    <div className="flex min-h-[50dvh] w-full items-center justify-center">
      <Loader2 className="animate-spin text-sage" size={28} strokeWidth={2} />
    </div>
  );
}
