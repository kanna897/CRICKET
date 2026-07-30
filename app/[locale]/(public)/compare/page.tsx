import dynamic from "next/dynamic";
import { PublicNav } from "@/components/public-nav";

const PerformanceComparison = dynamic(
  () => import("@/components/performance-comparison").then((module) => module.PerformanceComparison),
  { loading: () => <LoadingPanel label="Loading comparison tools…" /> },
);

export default function ComparePage() {
  return (
    <>
      <PublicNav />
      <main className="public-comparison-shell">
        <PerformanceComparison audience="public" />
      </main>
    </>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return <div role="status" className="grid min-h-80 place-items-center text-muted-foreground">{label}</div>;
}
