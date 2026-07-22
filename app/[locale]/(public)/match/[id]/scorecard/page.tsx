"use client";

import { MatchScorecardPage } from "@/app/[locale]/admin/matches/scorecard/[id]/page";

export default function PublicMatchScorecardPage() {
  return <main className="mx-auto max-w-5xl p-4 sm:p-6"><MatchScorecardPage publicMode /></main>;
}
