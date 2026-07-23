import { PerformanceComparison } from "@/components/performance-comparison";
import { PublicNav } from "@/components/public-nav";

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
