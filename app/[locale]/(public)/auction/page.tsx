import { LiveAuctionDashboard } from "@/components/live-auction-dashboard";
import { PublicNav } from "@/components/public-nav";

export default function PublicAuctionPage() {
  return <><PublicNav /><main className="p-4 py-7 sm:p-7"><LiveAuctionDashboard /></main></>;
}
