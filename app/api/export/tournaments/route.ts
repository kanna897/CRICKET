import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // 1. Fetch Data
    const { data: tournaments, error: tourneyError } = await supabase
      .from('tournaments')
      .select('id, name, venue, start_date, status');

    if (tourneyError) throw tourneyError;

    // 2. Format Data for Excel
    const worksheetData = (tournaments || []).map((t: { id: string; name: string; venue: string; start_date: string; status: string }) => ({
      'Tournament ID': t.id,
      'Name': t.name,
      'Venue': t.venue,
      'Start Date': new Date(t.start_date).toLocaleDateString(),
      'Status': t.status.toUpperCase()
    })) || [];

    // 3. Create Workbook
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tournaments');

    // 4. Generate Buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // 5. Return File Download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="crickpulse_tournaments.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    });

  } catch (error: unknown) {
    console.error("Export Engine Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
