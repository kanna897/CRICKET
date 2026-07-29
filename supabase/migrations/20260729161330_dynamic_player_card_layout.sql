-- Reusable 1080x1080 player-card layout configuration.
-- Existing template images and relationships remain unchanged.

update public.card_templates
set layout = '{
  "version": 1,
  "width": 1080,
  "height": 1080,
  "photo": {"x":85,"y":294,"width":348,"height":543,"borderRadius":50},
  "name": {"x":560,"y":392,"fontSize":58,"fontFamily":"Arial","fontColour":"#ffffff","textAlignment":"left","maxWidth":440,"fontWeight":900,"italic":true},
  "role": {"x":650,"y":515,"fontSize":40,"fontFamily":"Arial","fontColour":"#071936","textAlignment":"left","maxWidth":390,"fontWeight":900,"italic":true},
  "batting": {"x":650,"y":626,"fontSize":40,"fontFamily":"Arial","fontColour":"#071936","textAlignment":"left","maxWidth":390,"fontWeight":900,"italic":true},
  "bowling": {"x":650,"y":737,"fontSize":40,"fontFamily":"Arial","fontColour":"#071936","textAlignment":"left","maxWidth":390,"fontWeight":900,"italic":true},
  "phone": {"x":646,"y":848,"fontSize":40,"fontFamily":"Arial","fontColour":"#071936","textAlignment":"left","maxWidth":390,"fontWeight":900,"italic":true},
  "serial": {"x":194,"y":900,"fontSize":79,"fontFamily":"Arial","fontColour":"#ffffff","textAlignment":"left","maxWidth":190,"fontWeight":900,"italic":true}
}'::jsonb
where template_type = 'player'
  and (layout is null or layout = '{}'::jsonb);

revoke all on function public.get_registration_card_payload(uuid, text) from public, anon, authenticated;
drop function public.get_registration_card_payload(uuid, text);

create function public.get_registration_card_payload(
  p_registration_id uuid,
  p_tracking_code text
)
returns table (
  registration_id uuid,
  tournament_id uuid,
  player_name text,
  contact_number text,
  photo_url text,
  playing_role text,
  batting_style text,
  bowling_style text,
  registration_number integer,
  template_url text,
  template_layout jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    registration.id,
    registration.tournament_id,
    registration.player_name,
    registration.contact_number,
    registration.photo_url,
    registration.playing_role,
    registration.batting_style,
    registration.bowling_style,
    registration.registration_number,
    template.image_url,
    template.layout
  from public.player_registrations registration
  left join public.tournament_card_templates choice
    on choice.tournament_id = registration.tournament_id
  left join public.card_templates template
    on template.id = choice.player_template_id
   and template.is_visible
  where registration.id = p_registration_id
    and registration.tracking_code = upper(trim(p_tracking_code))
  limit 1;
$$;

revoke all on function public.get_registration_card_payload(uuid, text) from public;
grant execute on function public.get_registration_card_payload(uuid, text) to anon, authenticated;
