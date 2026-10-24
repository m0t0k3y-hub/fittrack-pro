-- 基本設計 (docs/design-specs/design.md) 第3〜4章に対応する初期スキーマ

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- 共通: updated_at 自動更新
-- ---------------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  height_cm   numeric(4,1) check (height_cm between 50 and 250),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- サインアップ時に profiles を自動作成
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------
-- exercises (user_id NULL = デフォルト種目)
-- ---------------------------------------------------------------
create table exercises (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  target_muscle  text not null
    check (target_muscle in ('chest','back','legs','shoulders','arms','abs','other')),
  archived_at    timestamptz,
  created_at     timestamptz not null default now()
);
create unique index exercises_name_unique
  on exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  where archived_at is null;
create index exercises_user_idx on exercises (user_id);

-- ---------------------------------------------------------------
-- workout_logs / workout_sets
-- ---------------------------------------------------------------
create table workout_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date        date not null,
  status      text not null check (status in ('planned','done')),
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workout_logs_user_date_idx on workout_logs (user_id, date);
create trigger workout_logs_updated_at before update on workout_logs
  for each row execute function set_updated_at();

create table workout_sets (
  id              uuid primary key default gen_random_uuid(),
  workout_log_id  uuid not null references workout_logs(id) on delete cascade,
  exercise_id     uuid not null references exercises(id),
  set_order       int not null,
  weight_kg       numeric(5,1) not null
    check (weight_kg >= 0 and weight_kg * 2 = trunc(weight_kg * 2)),
  reps            int not null check (reps > 0),
  is_done         boolean not null default false
);
create index workout_sets_log_order_idx on workout_sets (workout_log_id, set_order);
create index workout_sets_exercise_idx on workout_sets (exercise_id);

-- ---------------------------------------------------------------
-- body_metrics
-- ---------------------------------------------------------------
create table body_metrics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date          date not null,
  weight_kg     numeric(4,1) check (weight_kg between 20 and 300),
  body_fat_pct  numeric(3,1) check (body_fat_pct between 1 and 70),
  unique (user_id, date),
  check (weight_kg is not null or body_fat_pct is not null)
);

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table profiles      enable row level security;
alter table exercises     enable row level security;
alter table workout_logs  enable row level security;
alter table workout_sets  enable row level security;
alter table body_metrics  enable row level security;

create policy profiles_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy exercises_select on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy exercises_insert on exercises
  for insert with check (user_id = auth.uid());
create policy exercises_update on exercises
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_delete on exercises
  for delete using (user_id = auth.uid());

create policy workout_logs_own on workout_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy workout_sets_own on workout_sets
  for all
  using (exists (select 1 from workout_logs l
                 where l.id = workout_sets.workout_log_id and l.user_id = auth.uid()))
  with check (exists (select 1 from workout_logs l
                      where l.id = workout_sets.workout_log_id and l.user_id = auth.uid()));

create policy body_metrics_own on body_metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 集計 VIEW (RLS を効かせるため security_invoker)
-- 実績ログ かつ 完了チェック済みのセットのみ対象
-- ---------------------------------------------------------------
create view exercise_daily_stats with (security_invoker = true) as
select
  l.user_id,
  s.exercise_id,
  l.date,
  max(s.weight_kg)             as max_weight_kg,
  sum(s.weight_kg * s.reps)    as total_volume
from workout_logs l
join workout_sets s on s.workout_log_id = l.id
where l.status = 'done' and s.is_done
group by l.user_id, s.exercise_id, l.date;

-- ---------------------------------------------------------------
-- RPC: ワークアウト保存 (ログ + セット全入替を1トランザクションで)
-- security invoker のため RLS がそのまま適用される
-- p_sets: [{"exercise_id": "...", "weight_kg": 60, "reps": 10, "is_done": false}, ...]
--         配列順を set_order とする
-- ---------------------------------------------------------------
create function save_workout(
  p_id      uuid,
  p_date    date,
  p_status  text,
  p_memo    text,
  p_sets    jsonb
) returns uuid
language plpgsql security invoker as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into workout_logs (user_id, date, status, memo)
    values (auth.uid(), p_date, p_status, p_memo)
    returning id into v_id;
  else
    update workout_logs
       set date = p_date, status = p_status, memo = p_memo
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'workout_log not found' using errcode = 'P0002';
    end if;
    delete from workout_sets where workout_log_id = v_id;
  end if;

  insert into workout_sets (workout_log_id, exercise_id, set_order, weight_kg, reps, is_done)
  select v_id,
         (e.value ->> 'exercise_id')::uuid,
         e.ordinality::int,
         (e.value ->> 'weight_kg')::numeric,
         (e.value ->> 'reps')::int,
         coalesce((e.value ->> 'is_done')::boolean, false)
    from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as e(value, ordinality);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- デフォルト種目 (user_id = NULL)
-- ---------------------------------------------------------------
insert into exercises (user_id, name, target_muscle) values
  (null, 'ベンチプレス',               'chest'),
  (null, 'ダンベルプレス',             'chest'),
  (null, 'インクラインベンチプレス',   'chest'),
  (null, 'ダンベルフライ',             'chest'),
  (null, 'デッドリフト',               'back'),
  (null, '懸垂',                       'back'),
  (null, 'ラットプルダウン',           'back'),
  (null, 'ベントオーバーロウ',         'back'),
  (null, 'スクワット',                 'legs'),
  (null, 'レッグプレス',               'legs'),
  (null, 'レッグカール',               'legs'),
  (null, 'カーフレイズ',               'legs'),
  (null, 'ショルダープレス',           'shoulders'),
  (null, 'サイドレイズ',               'shoulders'),
  (null, 'アームカール',               'arms'),
  (null, 'トライセプスエクステンション','arms'),
  (null, 'クランチ',                   'abs'),
  (null, 'レッグレイズ',               'abs');
