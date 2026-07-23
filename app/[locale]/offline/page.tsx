import Link from "next/link";
import { RefreshCw, Trophy, WifiOff } from "lucide-react";
import { CrickpulseLogo } from "@/components/crickpulse-logo";

export default function OfflinePage() {
  return <main className="offline-page">
    <section>
      <div className="offline-logo"><CrickpulseLogo className="h-full w-full object-contain" /></div>
      <span className="offline-icon"><WifiOff /></span>
      <p>Connection unavailable</p>
      <h1>You’re offline, but CrickPulse is still ready.</h1>
      <p className="offline-copy">Previously opened public pages remain available. Live data will update automatically when your connection returns.</p>
      <div className="offline-actions"><a href="."><RefreshCw />Reconnect</a><Link href="/en/points"><Trophy />Saved points table</Link></div>
    </section>
  </main>;
}
