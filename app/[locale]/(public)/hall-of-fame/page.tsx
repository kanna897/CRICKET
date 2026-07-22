import { HallOfFameDashboard } from "@/components/hall-of-fame-dashboard";
import { PublicNav } from "@/components/public-nav";

export default function PublicHallOfFamePage() {
  return <><PublicNav /><main className="min-h-screen p-4 py-7 sm:p-7"><HallOfFameDashboard /></main></>;
}
