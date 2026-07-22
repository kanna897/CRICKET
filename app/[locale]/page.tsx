import PublicHome from "./(public)/page";
import { PublicMobileNav } from "@/components/public-mobile-nav";

// The locale root is the public CRICKPULSE landing page. Admin tools remain
// behind /[locale]/admin, while visitors can enter the view-only portal here.
export default function Home() {
  return <div className="pb-20 md:pb-0"><PublicHome /><PublicMobileNav /></div>;
}
