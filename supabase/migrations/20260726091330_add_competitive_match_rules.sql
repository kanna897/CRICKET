alter table public.matches
  add column if not exists balls_per_over integer not null default 6,
  add column if not exists wickets_per_innings integer not null default 10,
  add column if not exists last_man_stands boolean not null default false,
  add column if not exists allow_wides boolean not null default true,
  add column if not exists allow_no_balls boolean not null default true,
  add column if not exists revised_overs integer,
  add column if not exists target_method text,
  add column if not exists interruption_notes text;

alter table public.matches
  drop constraint if exists matches_balls_per_over_check,
  add constraint matches_balls_per_over_check check (balls_per_over between 4 and 10),
  drop constraint if exists matches_wickets_per_innings_check,
  add constraint matches_wickets_per_innings_check check (wickets_per_innings between 1 and 10),
  drop constraint if exists matches_revised_overs_check,
  add constraint matches_revised_overs_check check (revised_overs is null or revised_overs between 1 and 100),
  drop constraint if exists matches_target_method_check,
  add constraint matches_target_method_check check (target_method is null or target_method in ('manual', 'dls'));

comment on column public.matches.balls_per_over is 'Legal deliveries required to complete an over.';
comment on column public.matches.wickets_per_innings is 'Maximum wickets before an innings is all out.';
comment on column public.matches.last_man_stands is 'Allows the final available batter to continue after the normal last wicket.';
comment on column public.matches.allow_wides is 'Whether wide extras may be recorded for this match.';
comment on column public.matches.allow_no_balls is 'Whether no-ball extras may be recorded for this match.';
comment on column public.matches.revised_overs is 'Rain/interruption-adjusted innings length approved by the scorer.';
comment on column public.matches.target_method is 'Method used for a revised chase target: manual or DLS.';
comment on column public.matches.interruption_notes is 'Operational notes explaining a rain or play interruption adjustment.';
