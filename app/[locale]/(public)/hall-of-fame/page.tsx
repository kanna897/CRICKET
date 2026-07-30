import dynamic from "next/dynamic";
import { PublicNav } from "@/components/public-nav";

const HallOfFameDashboard = dynamic(
  () => import("@/components/hall-of-fame-dashboard").then((module) => module.HallOfFameDashboard),
  { loading: () => <div role="status" className="grid min-h-80 place-items-center text-muted-foreground">Loading hall of fame…</div> },
);

export default function PublicHallOfFamePage() {
  return <><PublicNav /><main className="min-h-screen p-4 py-7 sm:p-7"><HallOfFameDashboard /></main></>;
}
