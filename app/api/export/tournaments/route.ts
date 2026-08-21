import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rowsToCsv } from '@/lib/csv';
import { withApiMonitoring } from '@/lib/monitoring/api';

export const GET = withApiMonitoring("/api/export/tournaments", async () => {
  try {
    const supabase = await createSupabaseServerClient();
    // 1. Fetch Data
    const { data: tournaments, error: tourneyError } = await supabase
      .from('tournaments')
      .select('id, name, venue, start_date, status');

    if (tourneyError) throw tourneyError;

    const csv = rowsToCsv(
      ["Tournament ID", "Name", "Venue", "Start Date", "Status"],
      (tournaments || []).map((t: { id: string; name: string; venue: string | null; start_date: string; status: string }) => [
        t.id,
        t.name,
        t.venue,
        new Date(t.start_date).toISOString().slice(0, 10),
        t.status.toUpperCase(),
      ]),
    );

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="crickpulse_tournaments.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
      }
    });

  } catch (error: unknown) {
    console.error("Export Engine Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
