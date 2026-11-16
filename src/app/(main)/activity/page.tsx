import { redirect } from "next/navigation";

// 미술활동 was merged into 아카이브's composer.
export default function ActivityPage() {
  redirect("/diary/new");
}
