import { Loader2 } from "lucide-react";

// Shown by each route's loading.tsx while its Server Component fetches data,
// so a slow navigation gets feedback instead of a frozen screen. Fades in
// only after a short delay (see .spinner-delayed in globals.css) - most
// navigations finish before that and the spinner never flickers into view.
export default function PageSpinner() {
  return (
    <div className="flex min-h-[50dvh] w-full items-center justify-center">
      <Loader2 className="spinner-delayed animate-spin text-sage" size={28} strokeWidth={2} />
    </div>
  );
}
