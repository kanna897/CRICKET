import { asLocale, staticPageMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return staticPageMetadata(asLocale((await params).locale), "rankings");
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
