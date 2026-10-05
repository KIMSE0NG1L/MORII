import { redirect } from "next/navigation";

// 미술활동 was merged into 마음기록's composer.
export default function ActivityPage() {
  redirect("/diary/new");
}
