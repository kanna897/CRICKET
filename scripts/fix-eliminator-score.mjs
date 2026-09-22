import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) env[key.trim()] = values.join('=').trim();
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const ADMIN_EMAIL = 'crickpulse2026@gmail.com';
const ADMIN_PASSWORD = 'CrickAdmin26@#';

async function fixEliminator() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  if (authError) throw authError;
  console.log('✅ Authenticated as Admin');

  const { data: match } = await supabase.from('matches').select('*').eq('title', 'Eliminator').single();
  console.log('Match ID:', match.id);

  const { data: inn1 } = await supabase.from('innings')
    .select('*')
    .eq('match_id', match.id)
    .eq('innings_number', 1)
    .single();
  console.log('Innings 1 ID:', inn1.id, 'Current total runs:', inn1.total_runs);

  // Find the last ball
  const { data: balls } = await supabase.from('ball_by_ball')
    .select('*')
    .eq('innings_id', inn1.id)
    .order('created_at');

  const lastBall = balls[balls.length - 1];
  console.log('Last ball before update:', {
    id: lastBall.id,
    over: `${lastBall.over_number}.${lastBall.ball_number}`,
    runs: lastBall.runs,
    is_wicket: lastBall.is_wicket,
    dismissal_type: lastBall.dismissal_type
  });

  // Update last ball runs to 3
  const { error: ballUpdateErr } = await supabase.from('ball_by_ball')
    .update({ runs: 3 })
    .eq('id', lastBall.id);
  if (ballUpdateErr) throw ballUpdateErr;
  console.log('✅ Last ball runs updated to 3');

  // Update Innings 1 total runs to 64
  const { error: innUpdateErr } = await supabase.from('innings')
    .update({ total_runs: 64 })
    .eq('id', inn1.id);
  if (innUpdateErr) throw innUpdateErr;
  console.log('✅ Innings 1 total_runs updated to 64');

  // Verify Innings 2 target
  const { data: inn2 } = await supabase.from('innings')
    .select('*')
    .eq('match_id', match.id)
    .eq('innings_number', 2)
    .maybeSingle();

  if (inn2 && inn2.target !== 65) {
    await supabase.from('innings').update({ target: 65 }).eq('id', inn2.id);
    console.log('✅ Innings 2 target set to 65');
  } else if (inn2) {
    console.log('✅ Innings 2 target is already 65');
  }

  console.log('🎉 Eliminator match 1st innings successfully updated to 64/4 (Target: 65)!');
}
fixEliminator();
