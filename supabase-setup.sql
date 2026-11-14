-- =====================================================================
--  ILM International — Learning Portal
--  Supabase setup. Paste this whole file into Supabase > SQL Editor > Run.
--  Safe to run more than once. Everything is prefixed with "ilm_" so it
--  will not touch any other tables in the project.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists ilm_settings (
  key text primary key,
  value jsonb not null
);

create table if not exists ilm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role text not null default 'teacher' check (role in ('admin','teacher')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ilm_levels (
  id int primary key,
  code text unique not null,
  name text not null,
  arabic text,
  age_min int,
  age_max int,
  tagline text,
  about text,
  psychology text
);

create table if not exists ilm_units (
  id serial primary key,
  level_id int not null references ilm_levels(id) on delete cascade,
  sort int not null default 1,
  title text not null,
  summary text,
  goal text
);

create table if not exists ilm_lessons (
  id serial primary key,
  unit_id int not null references ilm_units(id) on delete cascade,
  sort int not null default 1,
  title text not null,
  minutes int not null default 8,
  hook text,
  body text,
  arabic text,
  translit text,
  meaning text,
  action text,
  teacher_note text,
  published boolean not null default true
);

create table if not exists ilm_questions (
  id serial primary key,
  lesson_id int not null references ilm_lessons(id) on delete cascade,
  sort int not null default 1,
  prompt text not null,
  options jsonb not null,
  answer int not null,
  explain text
);

create table if not exists ilm_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level_id int references ilm_levels(id),
  teacher_id uuid references ilm_profiles(id) on delete set null,
  plan text,
  schedule text,
  meet_link text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ilm_students (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  pin_hash text not null,
  full_name text not null,
  gender text,
  birth_year int,
  level_id int references ilm_levels(id),
  class_id uuid references ilm_classes(id) on delete set null,
  parent_name text,
  parent_whatsapp text,
  country text,
  plan text,
  monthly_fee numeric(10,2) not null default 0,
  parent_token text unique not null,
  avatar int not null default 1,
  active boolean not null default true,
  failed_logins int not null default 0,
  locked_until timestamptz,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ilm_student_sessions (
  token_hash text primary key,
  student_id uuid not null references ilm_students(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists ilm_progress (
  student_id uuid not null references ilm_students(id) on delete cascade,
  lesson_id int not null references ilm_lessons(id) on delete cascade,
  read_at timestamptz,
  best_score int,
  total int,
  attempts int not null default 0,
  passed_at timestamptz,
  primary key (student_id, lesson_id)
);

create table if not exists ilm_unit_exams (
  student_id uuid not null references ilm_students(id) on delete cascade,
  unit_id int not null references ilm_units(id) on delete cascade,
  best_score int,
  total int,
  attempts int not null default 0,
  passed_at timestamptz,
  last_at timestamptz,
  primary key (student_id, unit_id)
);

create table if not exists ilm_attempts (
  id bigserial primary key,
  student_id uuid not null references ilm_students(id) on delete cascade,
  kind text not null,
  ref_id int not null,
  title text,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);

create table if not exists ilm_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references ilm_students(id) on delete cascade,
  teacher_id uuid references ilm_profiles(id) on delete set null,
  teacher_name text,
  skill text not null,
  score int not null check (score between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists ilm_attendance (
  student_id uuid not null references ilm_students(id) on delete cascade,
  day date not null,
  class_id uuid references ilm_classes(id) on delete set null,
  status text not null check (status in ('present','late','absent')),
  primary key (student_id, day)
);

create table if not exists ilm_homework (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references ilm_classes(id) on delete cascade,
  title text not null,
  details text,
  due_date date,
  created_by uuid references ilm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ilm_submissions (
  homework_id uuid not null references ilm_homework(id) on delete cascade,
  student_id uuid not null references ilm_students(id) on delete cascade,
  answer text,
  submitted_at timestamptz not null default now(),
  stars int,
  feedback text,
  reviewed_at timestamptz,
  primary key (homework_id, student_id)
);

create table if not exists ilm_stars (
  id bigserial primary key,
  student_id uuid not null references ilm_students(id) on delete cascade,
  amount int not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists ilm_badges (
  student_id uuid not null references ilm_students(id) on delete cascade,
  code text not null,
  awarded_at timestamptz not null default now(),
  primary key (student_id, code)
);

create table if not exists ilm_certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references ilm_students(id) on delete cascade,
  title text not null,
  detail text,
  issued_by text,
  issued_at timestamptz not null default now()
);

create table if not exists ilm_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references ilm_students(id) on delete cascade,
  period text not null,
  description text not null,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  due_date date,
  status text not null default 'due' check (status in ('due','paid','waived','cancelled')),
  method text,
  paid_at timestamptz,
  rzp_order_id text,
  rzp_payment_id text,
  note text,
  reminded_at timestamptz,
  reminders int not null default 0,
  created_at timestamptz not null default now(),
  unique (student_id, period)
);

create index if not exists ilm_students_class_idx on ilm_students(class_id);
create index if not exists ilm_stars_student_idx on ilm_stars(student_id);
create index if not exists ilm_attempts_student_idx on ilm_attempts(student_id);
create index if not exists ilm_invoices_order_idx on ilm_invoices(rzp_order_id);
create index if not exists ilm_lessons_unit_idx on ilm_lessons(unit_id);
create index if not exists ilm_questions_lesson_idx on ilm_questions(lesson_id);

-- Lock every table. Nobody can read or write a table directly from the
-- website; all access goes through the checked functions below.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'ilm\_%' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

insert into ilm_settings(key, value) values ('main', jsonb_build_object(
  'academy', 'ILM International',
  'whatsapp', '905518881481',
  'currency', 'USD',
  'plans', jsonb_build_object('weekend', 80, 'group', 150, 'personal', 500),
  'pay_api', 'https://ilm-international.shabeehminnath.workers.dev',
  'portal_url', 'https://ilminternational.web.app/portal.html'
)) on conflict (key) do nothing;

-- ------------------------------------------------------ internal helpers
create or replace function ilm__staff() returns ilm_profiles
language plpgsql stable security definer set search_path = public, extensions as $$
declare p ilm_profiles;
begin
  select * into p from ilm_profiles where id = auth.uid();
  if p.id is null then raise exception 'Please sign in again.'; end if;
  if not p.approved then raise exception 'Your account is waiting for approval by the academy admin.'; end if;
  return p;
end $$;

create or replace function ilm__admin() returns ilm_profiles
language plpgsql stable security definer set search_path = public, extensions as $$
declare p ilm_profiles;
begin
  p := ilm__staff();
  if p.role <> 'admin' then raise exception 'Only the academy admin can do this.'; end if;
  return p;
end $$;

-- Teachers may only touch students in their own classes. Admin: everyone.
create or replace function ilm__staff_student(p_student uuid) returns ilm_students
language plpgsql stable security definer set search_path = public, extensions as $$
declare p ilm_profiles; s ilm_students;
begin
  p := ilm__staff();
  select * into s from ilm_students where id = p_student;
  if s.id is null then raise exception 'Student not found.'; end if;
  if p.role <> 'admin' and not exists (
    select 1 from ilm_classes c where c.id = s.class_id and c.teacher_id = p.id) then
    raise exception 'This student is not in one of your classes.';
  end if;
  return s;
end $$;

create or replace function ilm__staff_class(p_class uuid) returns ilm_classes
language plpgsql stable security definer set search_path = public, extensions as $$
declare p ilm_profiles; c ilm_classes;
begin
  p := ilm__staff();
  select * into c from ilm_classes where id = p_class;
  if c.id is null then raise exception 'Class not found.'; end if;
  if p.role <> 'admin' and c.teacher_id is distinct from p.id then
    raise exception 'This is not one of your classes.';
  end if;
  return c;
end $$;

create or replace function ilm__student(p_token text) returns ilm_students
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students;
begin
  select st.* into s from ilm_student_sessions ss
    join ilm_students st on st.id = ss.student_id
   where ss.token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
     and ss.expires_at > now() and st.active;
  if s.id is null then raise exception 'SESSION_EXPIRED'; end if;
  return s;
end $$;

create or replace function ilm__new_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := 'ILM-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    exit when not exists (select 1 from ilm_students where code = c);
  end loop;
  return c;
end $$;

create or replace function ilm__new_pin() returns text
language sql security definer set search_path = public, extensions as $$
  select lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;

create or replace function ilm__stars(p_student uuid, p_amount int, p_reason text) returns void
language sql security definer set search_path = public, extensions as $$
  insert into ilm_stars(student_id, amount, reason) values (p_student, p_amount, p_reason)
$$;

-- Gives any badges the student has newly earned; returns their codes.
create or replace function ilm__award_badges(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s ilm_students; reads int; stars int; subs int; units_total int; units_passed int;
  earned text[] := '{}'; c text; fresh text[] := '{}';
begin
  select * into s from ilm_students where id = p_student;
  select count(*) into reads from ilm_progress where student_id = p_student and read_at is not null;
  select coalesce(sum(amount), 0) into stars from ilm_stars where student_id = p_student;
  select count(*) into subs from ilm_submissions where student_id = p_student;
  select count(*) into units_total from ilm_units where level_id = s.level_id;
  select count(*) into units_passed from ilm_unit_exams e join ilm_units u on u.id = e.unit_id
   where e.student_id = p_student and e.passed_at is not null and u.level_id = s.level_id;

  if reads >= 1 then earned := array_append(earned, 'first_step'); end if;
  if reads >= 5 then earned := array_append(earned, 'steady_learner'); end if;
  if reads >= 15 then earned := array_append(earned, 'book_lover'); end if;
  if exists (select 1 from ilm_progress where student_id = p_student and total > 0 and best_score = total)
    then earned := array_append(earned, 'bright_star'); end if;
  if units_passed >= 1 then earned := array_append(earned, 'unit_champion'); end if;
  if units_total > 0 and units_passed >= units_total then earned := array_append(earned, 'level_graduate'); end if;
  if subs >= 3 then earned := array_append(earned, 'homework_hero'); end if;
  if stars >= 25 then earned := array_append(earned, 'stars_25'); end if;
  if stars >= 50 then earned := array_append(earned, 'stars_50'); end if;
  if stars >= 100 then earned := array_append(earned, 'stars_100'); end if;

  foreach c in array earned loop
    insert into ilm_badges(student_id, code) values (p_student, c) on conflict do nothing;
    if found then fresh := array_append(fresh, c); end if;
  end loop;
  return to_jsonb(fresh);
end $$;

create or replace function ilm__student_card(s ilm_students, p_fees boolean) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', s.id, 'code', s.code, 'full_name', s.full_name, 'gender', s.gender, 'birth_year', s.birth_year,
    'level_id', s.level_id, 'class_id', s.class_id, 'parent_name', s.parent_name,
    'parent_whatsapp', s.parent_whatsapp, 'country', s.country, 'plan', s.plan,
    'monthly_fee', s.monthly_fee, 'avatar', s.avatar, 'active', s.active,
    'parent_token', s.parent_token, 'last_seen', s.last_seen, 'created_at', s.created_at,
    'stars', (select coalesce(sum(amount), 0) from ilm_stars where student_id = s.id),
    'lessons_read', (select count(*) from ilm_progress where student_id = s.id and read_at is not null),
    'lessons_total', (select count(*) from ilm_lessons l join ilm_units u on u.id = l.unit_id
                       where u.level_id = s.level_id and l.published),
    'quiz_avg', (select round(avg(best_score * 100.0 / nullif(total, 0)))
                   from ilm_progress where student_id = s.id and total > 0),
    'attendance', (select round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*), 0))
                     from ilm_attendance where student_id = s.id),
    'due', case when p_fees then
             (select coalesce(sum(amount), 0) from ilm_invoices where student_id = s.id and status = 'due') end
  )
$$;

-- A student's whole learning path with their progress on it.
create or replace function ilm__path(p_student uuid, p_level int) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'title', u.title, 'summary', u.summary, 'goal', u.goal,
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title, 'minutes', l.minutes,
        'read', pr.read_at is not null, 'passed', pr.passed_at is not null,
        'best_score', pr.best_score, 'total', pr.total, 'attempts', coalesce(pr.attempts, 0)
      ) order by l.sort, l.id), '[]'::jsonb)
      from ilm_lessons l
      left join ilm_progress pr on pr.lesson_id = l.id and pr.student_id = p_student
      where l.unit_id = u.id and l.published),
    'exam', (select jsonb_build_object('best_score', e.best_score, 'total', e.total,
                    'passed', e.passed_at is not null, 'attempts', e.attempts)
               from ilm_unit_exams e where e.unit_id = u.id and e.student_id = p_student)
  ) order by u.sort, u.id), '[]'::jsonb)
  from ilm_units u where u.level_id = p_level
$$;

-- ------------------------------------------------------------ staff: me
create or replace function ilm_me() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u record; p ilm_profiles; n int;
begin
  if auth.uid() is null then return null; end if;
  select * into p from ilm_profiles where id = auth.uid();
  if p.id is null then
    select email, raw_user_meta_data as meta into u from auth.users where id = auth.uid();
    perform pg_advisory_xact_lock(727001);
    select count(*) into n from ilm_profiles;
    -- The very first person to sign up becomes the academy admin.
    insert into ilm_profiles(id, full_name, email, role, approved)
    values (auth.uid(),
            coalesce(nullif(trim(u.meta->>'full_name'), ''), split_part(coalesce(u.email, 'Teacher'), '@', 1)),
            u.email,
            case when n = 0 then 'admin' else 'teacher' end,
            n = 0)
    returning * into p;
  end if;
  return to_jsonb(p);
end $$;

create or replace function ilm_staff_bootstrap() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare p ilm_profiles; adm boolean;
begin
  p := ilm__staff();
  adm := p.role = 'admin';
  return jsonb_build_object(
    'me', to_jsonb(p),
    'settings', (select value from ilm_settings where key = 'main'),
    'levels', (select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]'::jsonb) from ilm_levels l),
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'full_name', t.full_name, 'email', case when adm or t.id = p.id then t.email end,
        'role', t.role, 'approved', t.approved, 'created_at', t.created_at) order by t.created_at), '[]'::jsonb)
      from ilm_profiles t where adm or t.approved),
    'classes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'level_id', c.level_id, 'teacher_id', c.teacher_id, 'plan', c.plan,
        'schedule', c.schedule, 'meet_link', c.meet_link, 'active', c.active,
        'students', (select count(*) from ilm_students s where s.class_id = c.id and s.active)
      ) order by c.created_at), '[]'::jsonb)
      from ilm_classes c where adm or c.teacher_id = p.id),
    'students', (select coalesce(jsonb_agg(ilm__student_card(s, adm) order by s.full_name), '[]'::jsonb)
      from ilm_students s
      where adm or exists (select 1 from ilm_classes c where c.id = s.class_id and c.teacher_id = p.id)),
    'homework_to_review', (select count(*) from ilm_submissions sb
        join ilm_homework h on h.id = sb.homework_id join ilm_classes c on c.id = h.class_id
       where sb.reviewed_at is null and (adm or c.teacher_id = p.id)),
    'fees', case when adm then (select jsonb_build_object(
        'due_total', coalesce(sum(amount) filter (where status = 'due'), 0),
        'due_count', count(*) filter (where status = 'due'),
        'overdue_count', count(*) filter (where status = 'due' and due_date < current_date),
        'paid_this_month', coalesce(sum(amount) filter (where status = 'paid'
              and paid_at >= date_trunc('month', now())), 0)) from ilm_invoices) end
  );
end $$;

-- ------------------------------------------------------- admin: people
create or replace function ilm_admin_set_teacher(p_id uuid, p_approved boolean, p_role text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a ilm_profiles;
begin
  a := ilm__admin();
  if p_id = a.id then raise exception 'You cannot change your own admin account here.'; end if;
  if p_role not in ('admin','teacher') then raise exception 'Unknown role.'; end if;
  update ilm_profiles set approved = p_approved, role = p_role where id = p_id;
end $$;

create or replace function ilm_admin_save_class(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare a ilm_profiles; v_id uuid;
begin
  a := ilm__admin();
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'Please give the class a name.'; end if;
  if nullif(p->>'id', '') is null then
    insert into ilm_classes(name, level_id, teacher_id, plan, schedule, meet_link)
    values (trim(p->>'name'), nullif(p->>'level_id', '')::int, nullif(p->>'teacher_id', '')::uuid,
            nullif(p->>'plan', ''), nullif(trim(p->>'schedule'), ''), nullif(trim(p->>'meet_link'), ''))
    returning id into v_id;
  else
    v_id := (p->>'id')::uuid;
    update ilm_classes set name = trim(p->>'name'), level_id = nullif(p->>'level_id', '')::int,
           teacher_id = nullif(p->>'teacher_id', '')::uuid, plan = nullif(p->>'plan', ''),
           schedule = nullif(trim(p->>'schedule'), ''), meet_link = nullif(trim(p->>'meet_link'), ''),
           active = coalesce((p->>'active')::boolean, true)
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function ilm_admin_save_student(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a ilm_profiles; v_id uuid; v_pin text; v_code text; v_level int; v_class uuid;
begin
  a := ilm__admin();
  if coalesce(trim(p->>'full_name'), '') = '' then raise exception 'Please enter the student''s name.'; end if;
  v_class := nullif(p->>'class_id', '')::uuid;
  v_level := coalesce(nullif(p->>'level_id', '')::int, (select level_id from ilm_classes where id = v_class), 1);
  if nullif(p->>'id', '') is null then
    v_pin := ilm__new_pin();
    v_code := ilm__new_code();
    insert into ilm_students(code, pin_hash, full_name, gender, birth_year, level_id, class_id, parent_name,
                             parent_whatsapp, country, plan, monthly_fee, parent_token, avatar)
    values (v_code, crypt(v_pin, gen_salt('bf', 8)), trim(p->>'full_name'), nullif(p->>'gender', ''),
            nullif(p->>'birth_year', '')::int, v_level, v_class, nullif(trim(p->>'parent_name'), ''),
            nullif(regexp_replace(coalesce(p->>'parent_whatsapp', ''), '[^0-9+]', '', 'g'), ''),
            nullif(trim(p->>'country'), ''), nullif(p->>'plan', ''),
            coalesce(nullif(p->>'monthly_fee', '')::numeric, 0),
            encode(gen_random_bytes(18), 'hex'), 1 + floor(random() * 8)::int)
    returning id into v_id;
  else
    v_id := (p->>'id')::uuid;
    update ilm_students set full_name = trim(p->>'full_name'), gender = nullif(p->>'gender', ''),
           birth_year = nullif(p->>'birth_year', '')::int, level_id = v_level, class_id = v_class,
           parent_name = nullif(trim(p->>'parent_name'), ''),
           parent_whatsapp = nullif(regexp_replace(coalesce(p->>'parent_whatsapp', ''), '[^0-9+]', '', 'g'), ''),
           country = nullif(trim(p->>'country'), ''), plan = nullif(p->>'plan', ''),
           monthly_fee = coalesce(nullif(p->>'monthly_fee', '')::numeric, 0),
           active = coalesce((p->>'active')::boolean, true)
     where id = v_id;
    if coalesce((p->>'active')::boolean, true) = false then
      delete from ilm_student_sessions where student_id = v_id;
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'code', coalesce(v_code, (select code from ilm_students where id = v_id)), 'pin', v_pin);
end $$;

create or replace function ilm_admin_delete_student(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  delete from ilm_students where id = p_id;
end $$;

create or replace function ilm_staff_reset_pin(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; v_pin text;
begin
  s := ilm__staff_student(p_student);
  v_pin := ilm__new_pin();
  update ilm_students set pin_hash = crypt(v_pin, gen_salt('bf', 8)), failed_logins = 0, locked_until = null
   where id = s.id;
  delete from ilm_student_sessions where student_id = s.id;
  return jsonb_build_object('code', s.code, 'pin', v_pin);
end $$;

create or replace function ilm_admin_save_settings(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  update ilm_settings set value = value || p where key = 'main';
end $$;

-- ---------------------------------------------- staff: one student view
create or replace function ilm_staff_student(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare p ilm_profiles; s ilm_students;
begin
  p := ilm__staff();
  s := ilm__staff_student(p_student);
  return jsonb_build_object(
    'student', ilm__student_card(s, p.role = 'admin'),
    'path', ilm__path(s.id, s.level_id),
    'attempts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select kind, title, score, total, created_at from ilm_attempts
         where student_id = s.id order by created_at desc limit 30) x),
    'assessments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, skill, score, note, teacher_name, created_at from ilm_assessments
         where student_id = s.id order by created_at desc limit 60) x),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select day, status from ilm_attendance where student_id = s.id order by day desc limit 40) x),
    'homework', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select h.id, h.title, h.due_date, sb.answer, sb.submitted_at, sb.stars, sb.feedback
          from ilm_homework h left join ilm_submissions sb on sb.homework_id = h.id and sb.student_id = s.id
         where h.class_id = s.class_id order by h.created_at desc limit 20) x),
    'stars_log', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select amount, reason, created_at from ilm_stars where student_id = s.id order by created_at desc limit 20) x),
    'badges', (select coalesce(jsonb_agg(code order by awarded_at), '[]'::jsonb) from ilm_badges where student_id = s.id),
    'certificates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, title, detail, issued_by, issued_at from ilm_certificates
         where student_id = s.id order by issued_at desc) x),
    'invoices', case when p.role = 'admin' then (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, period, description, amount, currency, due_date, status, method, paid_at
          from ilm_invoices where student_id = s.id order by period desc) x) end
  );
end $$;

create or replace function ilm_staff_assess(p_student uuid, p_skill text, p_score int, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare p ilm_profiles; s ilm_students;
begin
  p := ilm__staff();
  s := ilm__staff_student(p_student);
  if p_score not between 1 and 5 then raise exception 'Please choose a mark from 1 to 5.'; end if;
  insert into ilm_assessments(student_id, teacher_id, teacher_name, skill, score, note)
  values (s.id, p.id, p.full_name, p_skill, p_score, nullif(trim(p_note), ''));
end $$;

create or replace function ilm_staff_give_stars(p_student uuid, p_amount int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students;
begin
  s := ilm__staff_student(p_student);
  if p_amount not between 1 and 10 then raise exception 'You can give 1 to 10 stars at a time.'; end if;
  perform ilm__stars(s.id, p_amount, coalesce(nullif(trim(p_reason), ''), 'A gift from your teacher'));
  return ilm__award_badges(s.id);
end $$;

create or replace function ilm_staff_certificate(p_student uuid, p_title text, p_detail text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare p ilm_profiles; s ilm_students; v_id uuid;
begin
  p := ilm__staff();
  s := ilm__staff_student(p_student);
  if coalesce(trim(p_title), '') = '' then raise exception 'Please write what the certificate is for.'; end if;
  insert into ilm_certificates(student_id, title, detail, issued_by)
  values (s.id, trim(p_title), nullif(trim(p_detail), ''), p.full_name) returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------ staff: attendance
create or replace function ilm_staff_attendance(p_class uuid, p_day date) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c ilm_classes;
begin
  c := ilm__staff_class(p_class);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'full_name', s.full_name, 'avatar', s.avatar,
            'status', a.status) order by s.full_name), '[]'::jsonb)
            from ilm_students s left join ilm_attendance a on a.student_id = s.id and a.day = p_day
           where s.class_id = c.id and s.active);
end $$;

create or replace function ilm_staff_attendance_save(p_class uuid, p_day date, p_marks jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare c ilm_classes; k text; v text; n int := 0;
begin
  c := ilm__staff_class(p_class);
  for k, v in select * from jsonb_each_text(p_marks) loop
    if v in ('present','late','absent')
       and exists (select 1 from ilm_students where id = k::uuid and class_id = c.id) then
      insert into ilm_attendance(student_id, day, class_id, status) values (k::uuid, p_day, c.id, v)
      on conflict (student_id, day) do update set status = excluded.status, class_id = excluded.class_id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- -------------------------------------------------------- staff: homework
create or replace function ilm_staff_homework(p_class uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c ilm_classes;
begin
  c := ilm__staff_class(p_class);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'title', h.title, 'details', h.details, 'due_date', h.due_date, 'created_at', h.created_at,
      'class_size', (select count(*) from ilm_students s where s.class_id = c.id and s.active),
      'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
          'student_id', sb.student_id, 'full_name', s.full_name, 'answer', sb.answer,
          'submitted_at', sb.submitted_at, 'stars', sb.stars, 'feedback', sb.feedback,
          'reviewed', sb.reviewed_at is not null) order by sb.submitted_at), '[]'::jsonb)
        from ilm_submissions sb join ilm_students s on s.id = sb.student_id where sb.homework_id = h.id)
    ) order by h.created_at desc), '[]'::jsonb)
    from ilm_homework h where h.class_id = c.id);
end $$;

create or replace function ilm_staff_save_homework(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare p_me ilm_profiles; c ilm_classes; v_id uuid;
begin
  p_me := ilm__staff();
  c := ilm__staff_class((p->>'class_id')::uuid);
  if coalesce(trim(p->>'title'), '') = '' then raise exception 'Please give the homework a title.'; end if;
  if nullif(p->>'id', '') is null then
    insert into ilm_homework(class_id, title, details, due_date, created_by)
    values (c.id, trim(p->>'title'), nullif(trim(p->>'details'), ''), nullif(p->>'due_date', '')::date, p_me.id)
    returning id into v_id;
  else
    v_id := (p->>'id')::uuid;
    update ilm_homework set title = trim(p->>'title'), details = nullif(trim(p->>'details'), ''),
           due_date = nullif(p->>'due_date', '')::date
     where id = v_id and class_id = c.id;
  end if;
  return v_id;
end $$;

create or replace function ilm_staff_delete_homework(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h ilm_homework;
begin
  select * into h from ilm_homework where id = p_id;
  if h.id is null then return; end if;
  perform ilm__staff_class(h.class_id);
  delete from ilm_homework where id = p_id;
end $$;

create or replace function ilm_staff_review(p_homework uuid, p_student uuid, p_stars int, p_feedback text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h ilm_homework; sb ilm_submissions; v_stars int;
begin
  select * into h from ilm_homework where id = p_homework;
  if h.id is null then raise exception 'Homework not found.'; end if;
  perform ilm__staff_class(h.class_id);
  select * into sb from ilm_submissions where homework_id = p_homework and student_id = p_student;
  if sb.student_id is null then raise exception 'This student has not sent an answer yet.'; end if;
  v_stars := greatest(0, least(5, coalesce(p_stars, 0)));
  -- Only the difference is added, so marking again never double-counts.
  if v_stars - coalesce(sb.stars, 0) <> 0 then
    perform ilm__stars(p_student, v_stars - coalesce(sb.stars, 0), 'Homework: ' || h.title);
  end if;
  update ilm_submissions set stars = v_stars, feedback = nullif(trim(p_feedback), ''), reviewed_at = now()
   where homework_id = p_homework and student_id = p_student;
  perform ilm__award_badges(p_student);
end $$;

-- -------------------------------------------------------- staff: syllabus
create or replace function ilm_syllabus() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__staff();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', lv.id, 'code', lv.code, 'name', lv.name, 'arabic', lv.arabic, 'age_min', lv.age_min,
      'age_max', lv.age_max, 'tagline', lv.tagline, 'about', lv.about, 'psychology', lv.psychology,
      'units', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', u.id, 'sort', u.sort, 'title', u.title, 'summary', u.summary, 'goal', u.goal,
          'lessons', (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object(
              'questions', (select coalesce(jsonb_agg(to_jsonb(q) order by q.sort, q.id), '[]'::jsonb)
                              from ilm_questions q where q.lesson_id = l.id)) order by l.sort, l.id), '[]'::jsonb)
            from ilm_lessons l where l.unit_id = u.id)
        ) order by u.sort, u.id), '[]'::jsonb) from ilm_units u where u.level_id = lv.id)
    ) order by lv.id), '[]'::jsonb) from ilm_levels lv);
end $$;

create or replace function ilm_admin_save_unit(p jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_id int;
begin
  perform ilm__admin();
  if coalesce(trim(p->>'title'), '') = '' then raise exception 'Please give the unit a title.'; end if;
  if nullif(p->>'id', '') is null then
    insert into ilm_units(level_id, sort, title, summary, goal)
    values ((p->>'level_id')::int,
            coalesce(nullif(p->>'sort', '')::int,
                     (select coalesce(max(sort), 0) + 1 from ilm_units where level_id = (p->>'level_id')::int)),
            trim(p->>'title'), nullif(trim(p->>'summary'), ''), nullif(trim(p->>'goal'), ''))
    returning id into v_id;
  else
    v_id := (p->>'id')::int;
    update ilm_units set title = trim(p->>'title'), summary = nullif(trim(p->>'summary'), ''),
           goal = nullif(trim(p->>'goal'), ''), sort = coalesce(nullif(p->>'sort', '')::int, sort)
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function ilm_admin_save_lesson(p jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_id int; q jsonb; i int := 0;
begin
  perform ilm__admin();
  if coalesce(trim(p->>'title'), '') = '' then raise exception 'Please give the lesson a title.'; end if;
  if nullif(p->>'id', '') is null then
    insert into ilm_lessons(unit_id, sort, title, minutes, hook, body, arabic, translit, meaning, action, teacher_note, published)
    values ((p->>'unit_id')::int,
            coalesce(nullif(p->>'sort', '')::int,
                     (select coalesce(max(sort), 0) + 1 from ilm_lessons where unit_id = (p->>'unit_id')::int)),
            trim(p->>'title'), coalesce(nullif(p->>'minutes', '')::int, 8), nullif(trim(p->>'hook'), ''),
            nullif(trim(p->>'body'), ''), nullif(trim(p->>'arabic'), ''), nullif(trim(p->>'translit'), ''),
            nullif(trim(p->>'meaning'), ''), nullif(trim(p->>'action'), ''), nullif(trim(p->>'teacher_note'), ''),
            coalesce((p->>'published')::boolean, true))
    returning id into v_id;
  else
    v_id := (p->>'id')::int;
    update ilm_lessons set title = trim(p->>'title'), minutes = coalesce(nullif(p->>'minutes', '')::int, 8),
           hook = nullif(trim(p->>'hook'), ''), body = nullif(trim(p->>'body'), ''),
           arabic = nullif(trim(p->>'arabic'), ''), translit = nullif(trim(p->>'translit'), ''),
           meaning = nullif(trim(p->>'meaning'), ''), action = nullif(trim(p->>'action'), ''),
           teacher_note = nullif(trim(p->>'teacher_note'), ''),
           published = coalesce((p->>'published')::boolean, true),
           sort = coalesce(nullif(p->>'sort', '')::int, sort)
     where id = v_id;
  end if;
  if p ? 'questions' then
    delete from ilm_questions where lesson_id = v_id;
    for q in select * from jsonb_array_elements(p->'questions') loop
      if coalesce(trim(q->>'prompt'), '') <> '' and jsonb_array_length(q->'options') >= 2 then
        i := i + 1;
        insert into ilm_questions(lesson_id, sort, prompt, options, answer, explain)
        values (v_id, i, trim(q->>'prompt'), q->'options',
                least(greatest(coalesce((q->>'answer')::int, 0), 0), jsonb_array_length(q->'options') - 1),
                nullif(trim(q->>'explain'), ''));
      end if;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function ilm_admin_delete_lesson(p_id int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  delete from ilm_lessons where id = p_id;
end $$;

-- ------------------------------------------------------------ admin: fees
create or replace function ilm_admin_fees() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'student_id', i.student_id, 'student', s.full_name, 'code', s.code,
      'parent_name', s.parent_name, 'parent_whatsapp', s.parent_whatsapp, 'parent_token', s.parent_token,
      'period', i.period, 'description', i.description, 'amount', i.amount, 'currency', i.currency,
      'due_date', i.due_date, 'status', i.status, 'method', i.method, 'paid_at', i.paid_at,
      'rzp_payment_id', i.rzp_payment_id, 'note', i.note, 'reminded_at', i.reminded_at, 'reminders', i.reminders
    ) order by i.period desc, s.full_name), '[]'::jsonb)
    from ilm_invoices i join ilm_students s on s.id = i.student_id);
end $$;

-- One click: a fee invoice for every active student who has a monthly fee.
create or replace function ilm_admin_generate_invoices(p_period text, p_due date) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int; cur text;
begin
  perform ilm__admin();
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'Please choose a month.'; end if;
  select coalesce(value->>'currency', 'USD') into cur from ilm_settings where key = 'main';
  insert into ilm_invoices(student_id, period, description, amount, currency, due_date)
  select s.id, p_period,
         'Tuition fee — ' || to_char(to_date(p_period || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'),
         s.monthly_fee, cur, p_due
    from ilm_students s where s.active and s.monthly_fee > 0
  on conflict (student_id, period) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function ilm_admin_save_invoice(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; cur text;
begin
  perform ilm__admin();
  if coalesce(nullif(p->>'amount', '')::numeric, 0) <= 0 then raise exception 'Please enter the fee amount.'; end if;
  select coalesce(value->>'currency', 'USD') into cur from ilm_settings where key = 'main';
  if nullif(p->>'id', '') is null then
    if exists (select 1 from ilm_invoices where student_id = (p->>'student_id')::uuid and period = p->>'period') then
      raise exception 'This student already has a fee for that month. Edit that one instead.';
    end if;
    insert into ilm_invoices(student_id, period, description, amount, currency, due_date, note)
    values ((p->>'student_id')::uuid, p->>'period', coalesce(nullif(trim(p->>'description'), ''), 'Tuition fee'),
            (p->>'amount')::numeric, coalesce(nullif(p->>'currency', ''), cur), nullif(p->>'due_date', '')::date,
            nullif(trim(p->>'note'), ''))
    returning id into v_id;
  else
    v_id := (p->>'id')::uuid;
    update ilm_invoices set description = coalesce(nullif(trim(p->>'description'), ''), description),
           amount = (p->>'amount')::numeric, due_date = nullif(p->>'due_date', '')::date,
           note = nullif(trim(p->>'note'), ''), rzp_order_id = null
     where id = v_id and status = 'due';
  end if;
  return v_id;
end $$;

create or replace function ilm_admin_set_invoice(p_id uuid, p_status text, p_method text, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  if p_status not in ('due','paid','waived','cancelled') then raise exception 'Unknown status.'; end if;
  update ilm_invoices set status = p_status,
         method = case when p_status = 'paid' then coalesce(nullif(p_method, ''), 'cash') end,
         paid_at = case when p_status = 'paid' then now() end,
         note = coalesce(nullif(trim(p_note), ''), note)
   where id = p_id;
end $$;

create or replace function ilm_admin_delete_invoice(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  delete from ilm_invoices where id = p_id and status <> 'paid';
end $$;

create or replace function ilm_admin_reminded(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ilm__admin();
  update ilm_invoices set reminded_at = now(), reminders = reminders + 1 where id = p_id;
end $$;

-- --------------------------------------------------------------- student
create or replace function ilm_student_login(p_code text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; v_code text; tok text;
begin
  v_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if v_code ~ '^\d+$' then v_code := 'ILM' || v_code; end if;
  select * into s from ilm_students where replace(code, '-', '') = v_code and active;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'That Student ID or PIN is not right. Please check and try again.');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Too many tries. Please wait 10 minutes, or ask your teacher for a new PIN.');
  end if;
  if s.pin_hash <> crypt(coalesce(p_pin, ''), s.pin_hash) then
    update ilm_students set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= 6 then now() + interval '10 minutes' end
     where id = s.id;
    return jsonb_build_object('ok', false, 'error', 'That Student ID or PIN is not right. Please check and try again.');
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  delete from ilm_student_sessions where expires_at < now();
  insert into ilm_student_sessions(token_hash, student_id, expires_at)
  values (encode(digest(tok, 'sha256'), 'hex'), s.id, now() + interval '30 days');
  update ilm_students set failed_logins = 0, locked_until = null, last_seen = now() where id = s.id;
  return jsonb_build_object('ok', true, 'token', tok, 'name', s.full_name);
end $$;

create or replace function ilm_student_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from ilm_student_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function ilm_student_home(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students;
begin
  s := ilm__student(p_token);
  update ilm_students set last_seen = now() where id = s.id;
  return jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'code', s.code, 'full_name', s.full_name, 'avatar', s.avatar,
        'gender', s.gender, 'parent_token', s.parent_token),
    'level', (select jsonb_build_object('id', l.id, 'name', l.name, 'arabic', l.arabic, 'tagline', l.tagline,
        'age_min', l.age_min, 'age_max', l.age_max) from ilm_levels l where l.id = s.level_id),
    'class', (select jsonb_build_object('name', c.name, 'schedule', c.schedule, 'meet_link', c.meet_link,
        'teacher', (select full_name from ilm_profiles where id = c.teacher_id))
        from ilm_classes c where c.id = s.class_id and c.active),
    'stars', (select coalesce(sum(amount), 0) from ilm_stars where student_id = s.id),
    'stars_log', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select amount, reason, created_at from ilm_stars where student_id = s.id order by created_at desc limit 8) x),
    'badges', (select coalesce(jsonb_agg(code order by awarded_at), '[]'::jsonb) from ilm_badges where student_id = s.id),
    'units', ilm__path(s.id, s.level_id),
    'homework', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select h.id, h.title, h.details, h.due_date, sb.answer, sb.submitted_at, sb.stars, sb.feedback,
               sb.reviewed_at is not null as reviewed
          from ilm_homework h left join ilm_submissions sb on sb.homework_id = h.id and sb.student_id = s.id
         where h.class_id = s.class_id order by h.created_at desc limit 12) x),
    'certificates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, title, detail, issued_by, issued_at from ilm_certificates
         where student_id = s.id order by issued_at desc) x),
    'notes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select skill, score, note, teacher_name, created_at from ilm_assessments
         where student_id = s.id and note is not null and score >= 4 order by created_at desc limit 3) x),
    'fees_due', (select count(*) from ilm_invoices where student_id = s.id and status = 'due'),
    'academy', (select value->>'academy' from ilm_settings where key = 'main')
  );
end $$;

create or replace function ilm_student_avatar(p_token text, p_avatar int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students;
begin
  s := ilm__student(p_token);
  update ilm_students set avatar = least(greatest(p_avatar, 1), 8) where id = s.id;
end $$;

-- A lesson to read. Quiz answers are never sent to the child's device.
create or replace function ilm_student_lesson(p_token text, p_lesson int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; l ilm_lessons; u ilm_units;
begin
  s := ilm__student(p_token);
  select * into l from ilm_lessons where id = p_lesson and published;
  select * into u from ilm_units where id = l.unit_id;
  if l.id is null or u.level_id is distinct from s.level_id then raise exception 'This lesson is not in your level.'; end if;
  return jsonb_build_object(
    'id', l.id, 'unit_id', u.id, 'unit', u.title, 'title', l.title, 'minutes', l.minutes, 'hook', l.hook,
    'body', l.body, 'arabic', l.arabic, 'translit', l.translit, 'meaning', l.meaning, 'action', l.action,
    'read', exists (select 1 from ilm_progress where student_id = s.id and lesson_id = l.id and read_at is not null),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options)
                    order by q.sort, q.id), '[]'::jsonb) from ilm_questions q where q.lesson_id = l.id));
end $$;

create or replace function ilm_student_read(p_token text, p_lesson int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; first_time boolean := false;
begin
  s := ilm__student(p_token);
  if not exists (select 1 from ilm_lessons l join ilm_units u on u.id = l.unit_id
                  where l.id = p_lesson and u.level_id = s.level_id and l.published) then
    raise exception 'This lesson is not in your level.';
  end if;
  insert into ilm_progress(student_id, lesson_id, read_at) values (s.id, p_lesson, now())
  on conflict (student_id, lesson_id) do update set read_at = now() where ilm_progress.read_at is null;
  if found then
    first_time := true;
    perform ilm__stars(s.id, 1, 'Finished reading a lesson');
  end if;
  return jsonb_build_object('stars', case when first_time then 1 else 0 end, 'badges', ilm__award_badges(s.id));
end $$;

create or replace function ilm_student_exam(p_token text, p_unit int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; u ilm_units;
begin
  s := ilm__student(p_token);
  select * into u from ilm_units where id = p_unit;
  if u.id is null or u.level_id is distinct from s.level_id then raise exception 'This exam is not in your level.'; end if;
  if exists (select 1 from ilm_lessons l where l.unit_id = u.id and l.published and not exists (
        select 1 from ilm_progress pr where pr.lesson_id = l.id and pr.student_id = s.id and pr.read_at is not null)) then
    raise exception 'Finish reading all the lessons in this unit first.';
  end if;
  return jsonb_build_object('id', u.id, 'title', u.title,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options)
                    order by random()), '[]'::jsonb)
                    from ilm_questions q join ilm_lessons l on l.id = q.lesson_id
                   where l.unit_id = u.id and l.published));
end $$;

-- Marks a lesson quiz ('lesson') or a unit exam ('unit') on the server.
create or replace function ilm_student_submit(p_token text, p_kind text, p_ref int, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s ilm_students; v_score int; v_total int; v_results jsonb; v_title text; v_unit ilm_units;
  v_pass boolean; v_stars int := 0; old_best int; old_passed boolean; v_cert jsonb;
begin
  s := ilm__student(p_token);
  if p_kind = 'lesson' then
    select l.title into v_title from ilm_lessons l join ilm_units u on u.id = l.unit_id
     where l.id = p_ref and u.level_id = s.level_id and l.published;
  elsif p_kind = 'unit' then
    select * into v_unit from ilm_units where id = p_ref and level_id = s.level_id;
    v_title := v_unit.title;
  end if;
  if v_title is null then raise exception 'This quiz is not in your level.'; end if;

  with qs as (
    select q.* from ilm_questions q join ilm_lessons l on l.id = q.lesson_id
     where (p_kind = 'lesson' and q.lesson_id = p_ref) or (p_kind = 'unit' and l.unit_id = p_ref and l.published)
  )
  select count(*) filter (where (p_answers->>(id::text))::int = answer), count(*),
         coalesce(jsonb_agg(jsonb_build_object('id', id, 'answer', answer, 'explain', explain,
                  'chosen', (p_answers->>(id::text))::int,
                  'correct', coalesce((p_answers->>(id::text))::int = answer, false))), '[]'::jsonb)
    into v_score, v_total, v_results from qs;
  if v_total = 0 then raise exception 'This quiz has no questions yet.'; end if;
  v_pass := v_score * 3 >= v_total * 2;

  insert into ilm_attempts(student_id, kind, ref_id, title, score, total)
  values (s.id, p_kind, p_ref, v_title, v_score, v_total);

  if p_kind = 'lesson' then
    select best_score, passed_at is not null into old_best, old_passed
      from ilm_progress where student_id = s.id and lesson_id = p_ref;
    if v_pass and not coalesce(old_passed, false) then v_stars := v_stars + 2; end if;
    if v_score = v_total and coalesce(old_best, -1) < v_total then v_stars := v_stars + 1; end if;
    insert into ilm_progress(student_id, lesson_id, read_at, best_score, total, attempts, passed_at)
    values (s.id, p_ref, now(), v_score, v_total, 1, case when v_pass then now() end)
    on conflict (student_id, lesson_id) do update set
      best_score = greatest(coalesce(ilm_progress.best_score, 0), excluded.best_score),
      total = excluded.total, attempts = ilm_progress.attempts + 1,
      passed_at = coalesce(ilm_progress.passed_at, excluded.passed_at);
    if v_stars > 0 then
      perform ilm__stars(s.id, v_stars, case when v_score = v_total then 'Perfect quiz: ' else 'Quiz passed: ' end || v_title);
    end if;
  else
    select passed_at is not null into old_passed from ilm_unit_exams where student_id = s.id and unit_id = p_ref;
    insert into ilm_unit_exams(student_id, unit_id, best_score, total, attempts, passed_at, last_at)
    values (s.id, p_ref, v_score, v_total, 1, case when v_pass then now() end, now())
    on conflict (student_id, unit_id) do update set
      best_score = greatest(coalesce(ilm_unit_exams.best_score, 0), excluded.best_score),
      total = excluded.total, attempts = ilm_unit_exams.attempts + 1,
      passed_at = coalesce(ilm_unit_exams.passed_at, excluded.passed_at), last_at = now();
    if v_pass and not coalesce(old_passed, false) then
      v_stars := 5;
      perform ilm__stars(s.id, 5, 'Unit exam passed: ' || v_title);
      insert into ilm_certificates(student_id, title, detail, issued_by)
      values (s.id, v_title, 'For completing this unit and passing the unit exam with ' || v_score || ' out of ' || v_total || '.',
              (select value->>'academy' from ilm_settings where key = 'main'))
      returning jsonb_build_object('id', id, 'title', title) into v_cert;
    end if;
  end if;

  return jsonb_build_object('score', v_score, 'total', v_total, 'passed', v_pass, 'stars', v_stars,
                            'results', v_results, 'badges', ilm__award_badges(s.id), 'certificate', v_cert);
end $$;

create or replace function ilm_student_homework(p_token text, p_homework uuid, p_answer text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; first_time boolean;
begin
  s := ilm__student(p_token);
  if coalesce(trim(p_answer), '') = '' then raise exception 'Please write your answer first.'; end if;
  if not exists (select 1 from ilm_homework where id = p_homework and class_id = s.class_id) then
    raise exception 'This homework is not for your class.';
  end if;
  first_time := not exists (select 1 from ilm_submissions where homework_id = p_homework and student_id = s.id);
  insert into ilm_submissions(homework_id, student_id, answer) values (p_homework, s.id, left(trim(p_answer), 4000))
  on conflict (homework_id, student_id) do update set answer = excluded.answer, submitted_at = now()
   where ilm_submissions.reviewed_at is null;
  if first_time then perform ilm__stars(s.id, 1, 'Homework handed in'); end if;
  return jsonb_build_object('stars', case when first_time then 1 else 0 end, 'badges', ilm__award_badges(s.id));
end $$;

-- ---------------------------------------------------------------- parent
-- Opened with the private link the academy sends to each parent.
create or replace function ilm_parent_report(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s ilm_students; cfg jsonb;
begin
  select * into s from ilm_students where parent_token = p_token and length(coalesce(p_token, '')) >= 20;
  if s.id is null then raise exception 'This report link is not valid. Please ask the academy for a new one.'; end if;
  select value into cfg from ilm_settings where key = 'main';
  return jsonb_build_object(
    'student', ilm__student_card(s, true) - 'parent_token',
    'academy', jsonb_build_object('name', cfg->>'academy', 'whatsapp', cfg->>'whatsapp', 'pay_api', cfg->>'pay_api'),
    'level', (select jsonb_build_object('name', l.name, 'arabic', l.arabic, 'tagline', l.tagline,
              'age_min', l.age_min, 'age_max', l.age_max, 'about', l.about) from ilm_levels l where l.id = s.level_id),
    'class', (select jsonb_build_object('name', c.name, 'schedule', c.schedule,
              'teacher', (select full_name from ilm_profiles where id = c.teacher_id))
              from ilm_classes c where c.id = s.class_id),
    'path', ilm__path(s.id, s.level_id),
    'assessments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select skill, score, note, teacher_name, created_at from ilm_assessments
         where student_id = s.id order by created_at desc limit 40) x),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select day, status from ilm_attendance where student_id = s.id order by day desc limit 24) x),
    'homework', (select jsonb_build_object('set', count(h.id), 'done', count(sb.student_id))
        from ilm_homework h left join ilm_submissions sb on sb.homework_id = h.id and sb.student_id = s.id
       where h.class_id = s.class_id),
    'badges', (select coalesce(jsonb_agg(code order by awarded_at), '[]'::jsonb) from ilm_badges where student_id = s.id),
    'certificates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, title, detail, issued_by, issued_at from ilm_certificates
         where student_id = s.id order by issued_at desc) x),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, period, description, amount, currency, due_date, status, method, paid_at
          from ilm_invoices where student_id = s.id and status in ('due','paid')
         order by (status = 'due') desc, period desc limit 18) x)
  );
end $$;

-- ------------------------------------------------- payments (server only)
-- These three are called only by the academy's payment server (the
-- Cloudflare Worker) using the secret key. The website cannot call them.
create or replace function ilm_pay_start(p_invoice uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare i ilm_invoices; s ilm_students;
begin
  select * into i from ilm_invoices where id = p_invoice;
  select * into s from ilm_students where id = i.student_id;
  if i.id is null or s.parent_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'error', 'This fee was not found.');
  end if;
  if i.status <> 'due' then
    return jsonb_build_object('ok', false, 'error', 'This fee is already settled. Thank you!');
  end if;
  return jsonb_build_object('ok', true, 'invoice', i.id, 'amount_minor', round(i.amount * 100)::bigint,
    'currency', i.currency, 'description', i.description, 'student', s.full_name, 'code', s.code,
    'parent_name', s.parent_name, 'parent_whatsapp', s.parent_whatsapp,
    'academy', (select value->>'academy' from ilm_settings where key = 'main'));
end $$;

create or replace function ilm_pay_set_order(p_invoice uuid, p_order text) returns void
language sql security definer set search_path = public, extensions as $$
  update ilm_invoices set rzp_order_id = p_order where id = p_invoice and status = 'due'
$$;

create or replace function ilm_pay_confirm(p_order text, p_payment text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare i ilm_invoices;
begin
  if coalesce(p_order, '') = '' then return jsonb_build_object('ok', false); end if;
  update ilm_invoices set status = 'paid', method = 'razorpay', paid_at = now(), rzp_payment_id = p_payment
   where rzp_order_id = p_order and status = 'due' returning * into i;
  if i.id is null then
    select * into i from ilm_invoices where rzp_order_id = p_order;
  end if;
  return jsonb_build_object('ok', i.id is not null and i.status = 'paid', 'invoice', i.id);
end $$;

-- ------------------------------------------------------------ permissions
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ilm\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname like 'ilm\_\_%' then
      null;                                                   -- internal helpers: nobody
    elsif f.proname like 'ilm\_pay\_%' then
      execute format('grant execute on function %s to service_role', f.sig);
    elsif f.proname like 'ilm\_student\_%' or f.proname = 'ilm_parent_report' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------- syllabus
-- Loads the three levels, their units, lessons and quiz questions.
-- Runs only once: if the syllabus is already there it is left untouched,
-- so lessons you edit in the portal are never overwritten.
do $seed$
declare
  d jsonb := $ilm$[{"id":1,"code":"noor","name":"Noor","arabic":"نور","age_min":5,"age_max":7,"tagline":"Little lights — falling in love with Allah","about":"Children meet Allah as the One who made them and loves them, learn the beautiful words Muslims say every day, get ready for wudu and salah, hear their first prophet stories and practise kind manners.","psychology":"How children aged 5–7 learn\n- They think in pictures and real things, not ideas. Show, point, act out. \"Allah made the rain\" works; \"Allah is the Sustainer\" does not yet.\n- Attention lasts about 5–8 minutes. One small idea per lesson, then move, sing or draw.\n- They learn by copying and repeating. Say the phrase together three times, every lesson, with the same tune.\n- Love comes before rules. Lead with \"Allah loves you\" and \"Allah made this for you\". Never use fear of punishment at this age.\n- Praise the effort straight away and by name: \"Maryam, you said Bismillah so clearly!\" Stars are for trying, not for being the best.\n- No comparing children with each other. Each child only races their own path.\n- Mistakes are safe. A wrong quiz answer shows the right one kindly and the child may try again as many times as they like.\n- Every lesson ends with one tiny action to do at home the same day, so faith becomes something they do, not just hear.\n- Involve the parent: ask the child to \"teach Mama or Baba\" the phrase of the day.","units":[{"title":"Allah Made Me and Loves Me","summary":"Looking at the world and ourselves and finding Allah's gifts everywhere.","goal":"The child can say \"Allah made me, Allah loves me\" and names three things Allah made.","lessons":[{"title":"Allah Made Everything","minutes":5,"hook":"Look out of your window. What can you see?","body":"The big blue sky. The warm yellow sun. The birds that sing. Who made them all?\n\nAllah made them!\n\nAllah made the tall trees and the tiny ants. Allah made the sea and all the fish. Allah made the moon and every star.\n\nNobody helped Allah. Allah is the only One who can make everything. When we see something beautiful, we say \"SubhanAllah!\" It means: Allah is perfect.","arabic":"سُبْحَانَ اللهِ","translit":"SubhanAllah","meaning":"Allah is perfect","action":"Find three beautiful things today. Each time, say \"SubhanAllah!\"","teacher_note":"Bring a leaf, a shell or a picture of the night sky. Let each child name something Allah made. Keep it joyful, not a test.","questions":[{"prompt":"Who made the sun and the moon?","options":["Allah","A man","Nobody"],"answer":0,"explain":"Allah made the sun, the moon and everything."},{"prompt":"What do we say when we see something beautiful?","options":["SubhanAllah","Goodbye","Oh no"],"answer":0,"explain":"SubhanAllah means Allah is perfect."},{"prompt":"Did anyone help Allah make the world?","options":["Yes, many helpers","No, Allah made it alone","The birds helped"],"answer":1,"explain":"Allah is One. He needs no helper."}]},{"title":"Allah Made Me Special","minutes":5,"hook":"Hold up your hands and wiggle your fingers!","body":"Allah gave you two eyes to see. Two ears to hear. A nose to smell flowers. A mouth to say kind words. Two hands to help. Two feet to run and play.\n\nNobody in the whole world is just like you. Allah made you special.\n\nAllah knows your name. Allah sees you all the time. Allah loves you very, very much.\n\nWe use our eyes, hands and mouth for good things, because they are gifts from Allah.","arabic":null,"translit":null,"meaning":null,"action":"Use your hands to help someone at home today.","teacher_note":"Play \"Touch your… eyes! ears!\" and after each one say together \"Allah gave me this\". Finish with every child saying: \"Allah made me. Allah loves me.\"","questions":[{"prompt":"Who gave you your eyes and ears?","options":["The shop","Allah","My toys"],"answer":1,"explain":"Our body is a gift from Allah."},{"prompt":"Does Allah love you?","options":["Only sometimes","No","Yes, very much"],"answer":2,"explain":"Allah loves you very much."},{"prompt":"What should we do with our hands?","options":["Hit","Take things","Help and do good"],"answer":2,"explain":"Our hands are a gift. We use them to help."}]},{"title":"Saying Alhamdulillah","minutes":5,"hook":"What is your favourite food? Yum!","body":"Allah gives us so many gifts. Food to eat. Water to drink. A home. A family who loves us.\n\nWhen someone gives you a gift, you say \"Thank you\".\n\nTo thank Allah, we say \"Alhamdulillah\". It means: all thanks are for Allah.\n\nWe say Alhamdulillah after we eat. We say it when we are happy. We say it when we wake up in the morning. Allah loves it when we say thank you.","arabic":"الْحَمْدُ لِلَّهِ","translit":"Alhamdulillah","meaning":"All thanks are for Allah","action":"After you eat today, say \"Alhamdulillah\" out loud.","teacher_note":"Make a \"thank you tree\": each child names one gift and you draw a leaf for it. Say Alhamdulillah together after every leaf.","questions":[{"prompt":"What does Alhamdulillah mean?","options":["All thanks are for Allah","Good night","I am hungry"],"answer":0,"explain":"Alhamdulillah is how we thank Allah."},{"prompt":"When do we say Alhamdulillah?","options":["Only at school","After we eat","Never"],"answer":1,"explain":"We thank Allah after eating and whenever we are happy."},{"prompt":"Who gives us our food and our family?","options":["Allah","Nobody","The TV"],"answer":0,"explain":"Every good thing is a gift from Allah."}]}]},{"title":"My Beautiful Words","summary":"The short, lovely phrases Muslims say every day.","goal":"The child uses Bismillah, Salam and JazakAllahu khayran without being reminded.","lessons":[{"title":"Bismillah — I Start with Allah's Name","minutes":5,"hook":"What is the first thing you do before you eat?","body":"Before we start something good, we say \"Bismillah\". It means: in the name of Allah.\n\nWe say Bismillah before we eat. Before we drink. Before we read. Before we go out to play.\n\nWhen we say Bismillah, we remember Allah, and Allah puts goodness in what we do.\n\nIt is a small word, but it is very big with Allah!","arabic":"بِسْمِ اللهِ","translit":"Bismillah","meaning":"In the name of Allah","action":"Say \"Bismillah\" before every meal today. Can you remember all of them?","teacher_note":"Mime actions (eating, opening a book, putting on shoes). The children shout \"Bismillah!\" before each one.","questions":[{"prompt":"What do we say before we eat?","options":["Nothing","Bye bye","Bismillah"],"answer":2,"explain":"We begin with Bismillah."},{"prompt":"What does Bismillah mean?","options":["In the name of Allah","I am full","See you later"],"answer":0,"explain":"Bismillah means in the name of Allah."},{"prompt":"When can we say Bismillah?","options":["Before we start something good","Only on Friday","Only at night"],"answer":0,"explain":"We say it before any good thing we start."}]},{"title":"Assalamu Alaykum — Peace for You","minutes":5,"hook":"How do you say hello to your friend?","body":"Muslims have a special hello. We say \"Assalamu alaykum\". It means: peace be on you.\n\nIt is like giving a little gift of peace to the person you meet.\n\nWhen someone says it to us, we answer \"Wa alaykumus-salam\". It means: and peace be on you too.\n\nWe say salam when we come home. We say salam to our teacher. We say it with a big smile. The Prophet Muhammad, peace be upon him, taught us that a smile is a good deed!","arabic":"السَّلَامُ عَلَيْكُمْ","translit":"Assalamu alaykum","meaning":"Peace be on you","action":"Say \"Assalamu alaykum\" with a smile to everyone at home today.","teacher_note":"Start and end every class with salam. Let children practise in pairs, one greets and one answers, then swap.","questions":[{"prompt":"What is the Muslim hello?","options":["Assalamu alaykum","Alhamdulillah","Bismillah"],"answer":0,"explain":"We greet with Assalamu alaykum."},{"prompt":"What does it mean?","options":["I am sleepy","Peace be on you","Thank you"],"answer":1,"explain":"It is a wish of peace."},{"prompt":"What do we answer?","options":["Bismillah","No thank you","Wa alaykumus-salam"],"answer":2,"explain":"We answer: and peace be on you too."}]},{"title":"Kind Words Make Hearts Happy","minutes":5,"hook":"How do you feel when someone says \"Well done!\" to you?","body":"Kind words are like sunshine. They make hearts warm and happy.\n\nWhen someone helps us, we say \"JazakAllahu khayran\". It means: may Allah give you good.\n\nWhen we make a mistake, we say \"I am sorry\".\n\nWhen we want something, we say \"Please\".\n\nAllah loves kind words. Mean words hurt, so we keep them away. A good Muslim uses a soft voice and kind words with everyone.","arabic":"جَزَاكَ اللهُ خَيْرًا","translit":"JazakAllahu khayran","meaning":"May Allah give you good","action":"Say \"JazakAllahu khayran\" to someone who helps you today.","teacher_note":"Use two faces (happy and sad). Say a phrase; children point to the face it makes. Role-play passing a toy and saying JazakAllahu khayran.","questions":[{"prompt":"What do we say when someone helps us?","options":["Nothing","Go away","JazakAllahu khayran"],"answer":2,"explain":"It means may Allah give you good."},{"prompt":"What do we say when we make a mistake?","options":["It was not me","Ha ha","I am sorry"],"answer":2,"explain":"Saying sorry is brave and kind."},{"prompt":"Which words does Allah love?","options":["Shouting","Mean words","Kind words"],"answer":2,"explain":"Allah loves kind and gentle words."}]}]},{"title":"Clean and Ready to Pray","summary":"Being clean, making wudu and meeting the five daily prayers.","goal":"The child can show the wudu steps with help and name the five prayers.","lessons":[{"title":"Allah Loves Those Who Are Clean","minutes":5,"hook":"What do you do after you play in the mud?","body":"Allah loves people who are clean.\n\nWe wash our hands before we eat and after we eat. We brush our teeth in the morning and before bed. We wear clean clothes. We keep our room tidy.\n\nBeing clean keeps us healthy and it makes Allah happy with us.\n\nThe Prophet Muhammad, peace be upon him, was always clean and smelled lovely.","arabic":null,"translit":null,"meaning":null,"action":"Wash your hands before you eat today and say \"Bismillah\".","teacher_note":"Sort picture cards into \"clean\" and \"not clean\". Link every clean habit to \"Allah loves this\".","questions":[{"prompt":"Who loves people who are clean?","options":["Only the teacher","Nobody","Allah"],"answer":2,"explain":"Allah loves those who keep clean."},{"prompt":"When do we wash our hands?","options":["Before and after eating","Never","Only on Eid"],"answer":0,"explain":"We wash before and after we eat."},{"prompt":"When do we brush our teeth?","options":["Morning and before bed","Once a year","Only when it rains"],"answer":0,"explain":"Clean teeth every morning and night."}]},{"title":"Wudu — Washing for Prayer","minutes":6,"hook":"Splash! Do you like water?","body":"Before we pray, we wash in a special way. It is called wudu.\n\nFirst we say Bismillah. Then:\n- Wash your hands\n- Rinse your mouth\n- Rinse your nose\n- Wash your face\n- Wash your arms up to the elbows\n- Wipe your head and ears\n- Wash your feet\n\nWe start with the right side. We do not waste water, even a little.\n\nAfter wudu we are clean and ready to stand in front of Allah.","arabic":null,"translit":null,"meaning":null,"action":"Make wudu with Mama or Baba today. Can you remember what comes after washing your face?","teacher_note":"Do a \"dry wudu\" together with actions and a simple chant. Do not worry about counts of three yet; the order and the love of it come first.","questions":[{"prompt":"What is wudu?","options":["A kind of food","Washing before we pray","A game"],"answer":1,"explain":"Wudu is the special wash before prayer."},{"prompt":"What do we say before we start wudu?","options":["Goodbye","Bismillah","Nothing"],"answer":1,"explain":"We begin with Bismillah."},{"prompt":"Should we waste water in wudu?","options":["It does not matter","Yes, lots","No, we use a little"],"answer":2,"explain":"Water is a gift. We never waste it."}]},{"title":"My Five Prayers","minutes":6,"hook":"Can you count to five on one hand?","body":"Muslims pray five times every day. Praying is how we talk to Allah.\n\nHere are their names:\n- Fajr — before the sun comes up\n- Dhuhr — in the middle of the day\n- Asr — in the afternoon\n- Maghrib — when the sun goes down\n- Isha — at night\n\nWhen we pray, we stand, we bow and we put our head on the ground. Allah is very close to us then. We say \"Allahu Akbar\". It means: Allah is the Greatest.","arabic":"اللهُ أَكْبَرُ","translit":"Allahu Akbar","meaning":"Allah is the Greatest","action":"Stand next to Mama or Baba for one prayer today and copy them.","teacher_note":"Use five fingers for five prayers and a sun moving across the sky. Sing the names in order. Children this age are only getting familiar; no pressure to perform.","questions":[{"prompt":"How many times do Muslims pray each day?","options":["Two","Ten","Five"],"answer":2,"explain":"We pray five times every day."},{"prompt":"Which prayer is before the sun comes up?","options":["Fajr","Asr","Isha"],"answer":0,"explain":"Fajr is the early morning prayer."},{"prompt":"What does Allahu Akbar mean?","options":["Good morning","I am tired","Allah is the Greatest"],"answer":2,"explain":"Allahu Akbar: Allah is the Greatest."}]}]},{"title":"My First Surahs","summary":"Meeting the Qur'an and the first two surahs every Muslim child learns.","goal":"The child treats the Qur'an with love and can recite Al-Fatiha and Al-Ikhlas with the teacher.","lessons":[{"title":"The Qur'an — Allah's Book","minutes":5,"hook":"Do you have a favourite book?","body":"The Qur'an is the best book in the whole world. It is the words of Allah.\n\nAllah sent the Qur'an to the Prophet Muhammad, peace be upon him. The angel Jibril brought it to him.\n\nThe Qur'an teaches us how to be good and how to make Allah happy.\n\nWe hold the Qur'an gently. We keep it in a clean, high place. We listen quietly when it is read. The parts of the Qur'an are called surahs.","arabic":null,"translit":null,"meaning":null,"action":"Listen to someone read the Qur'an for two minutes today. Sit very still, like a little star.","teacher_note":"Show a mushaf and model handling it with care. Play a short, beautiful recitation and let the children simply listen with eyes closed.","questions":[{"prompt":"Whose words are in the Qur'an?","options":["A king's words","Allah's words","A teacher's words"],"answer":1,"explain":"The Qur'an is the words of Allah."},{"prompt":"Which angel brought the Qur'an?","options":["Jibril","Nobody","A bird"],"answer":0,"explain":"The angel Jibril brought it to the Prophet."},{"prompt":"How do we hold the Qur'an?","options":["With dirty hands","Gently and with love","We throw it"],"answer":1,"explain":"We treat the Qur'an with great care."}]},{"title":"Surah Al-Fatiha — The Opening","minutes":6,"hook":"What is the first page of a book called? The opening!","body":"Al-Fatiha is the first surah of the Qur'an. Its name means \"The Opening\".\n\nIt has seven short lines. We read it in every prayer, so it is very special.\n\nIn Al-Fatiha we thank Allah, the Lord of all the worlds. We say that Allah is the Most Kind. And we ask Allah: \"Show us the straight path.\" That means: help us to be good.\n\nLet us listen and repeat it slowly, one line at a time.","arabic":"اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ","translit":"Ihdinas-siratal-mustaqim","meaning":"Guide us to the straight path","action":"Recite Al-Fatiha once to someone at home today.","teacher_note":"Teach by echo: you recite one ayah, they repeat, three times each. One or two ayat a week is a good pace. Correct gently, by repeating it right, not by saying \"wrong\".","questions":[{"prompt":"What does Al-Fatiha mean?","options":["The End","The Opening","The Night"],"answer":1,"explain":"Al-Fatiha means The Opening."},{"prompt":"When do we read Al-Fatiha?","options":["Never","Only on Eid","In every prayer"],"answer":2,"explain":"We read it in every prayer."},{"prompt":"What do we ask Allah for in Al-Fatiha?","options":["For sweets","For toys","To show us the straight path"],"answer":2,"explain":"We ask Allah to guide us to be good."}]},{"title":"Surah Al-Ikhlas — Allah is One","minutes":6,"hook":"How many suns are in the sky? Just one!","body":"Surah Al-Ikhlas is short, only four lines, but it is very, very big.\n\nIt tells us who Allah is:\n- Allah is One.\n- Everyone needs Allah, and Allah needs no one.\n- Allah has no father, no mother and no children.\n- Nothing at all is like Allah.\n\nThe Prophet, peace be upon him, loved this surah very much. Many children learn it first because it is short and beautiful.","arabic":"قُلْ هُوَ اللهُ أَحَدٌ","translit":"Qul huwa-llahu ahad","meaning":"Say: He is Allah, the One","action":"Say Surah Al-Ikhlas before you sleep tonight.","teacher_note":"Hold up one finger each time you say \"Ahad\". Recite as a class, then in pairs. Praise every attempt.","questions":[{"prompt":"How many gods are there?","options":["One — Allah","Two","Many"],"answer":0,"explain":"Allah is One."},{"prompt":"Is anything like Allah?","options":["Yes, the sun","Yes, a king","No, nothing is like Allah"],"answer":2,"explain":"Nothing is like Allah."},{"prompt":"How many lines does Surah Al-Ikhlas have?","options":["Ten","One hundred","Four"],"answer":2,"explain":"It has four short lines."}]}]},{"title":"Stories of the Prophets","summary":"Three gentle stories that teach saying sorry, patience and calling on Allah.","goal":"The child can retell each story in their own words and say its one lesson.","lessons":[{"title":"Prophet Adam — The First Man","minutes":6,"hook":"Who was the very first person in the world?","body":"A long, long time ago, Allah made the first man. His name was Adam, peace be upon him. Allah made him from clay and taught him the names of all things.\n\nAllah made a wife for him. Her name was Hawwa. They lived in a beautiful garden.\n\nAllah told them: eat anything, but not from one tree. One day they forgot and ate from it. They felt very sad. They said: \"O Allah, we are sorry. Please forgive us.\"\n\nAnd Allah forgave them, because Allah is the Most Kind.","arabic":null,"translit":null,"meaning":null,"action":"If you make a mistake today, say sorry quickly, just like Prophet Adam did.","teacher_note":"Tell it as a story with your voice, not as facts. The single take-away: when we slip, we say sorry and Allah forgives. Avoid dwelling on blame.","questions":[{"prompt":"Who was the first man?","options":["Adam","Nuh","Yunus"],"answer":0,"explain":"Prophet Adam was the first human."},{"prompt":"What did Adam and Hawwa do after their mistake?","options":["They said sorry to Allah","They ran away","They laughed"],"answer":0,"explain":"They asked Allah to forgive them."},{"prompt":"Did Allah forgive them?","options":["Yes, Allah is Most Kind","We do not know","No"],"answer":0,"explain":"Allah forgave them. He loves to forgive."}]},{"title":"Prophet Nuh and the Big Ship","minutes":6,"hook":"Have you ever been on a boat?","body":"Prophet Nuh, peace be upon him, told his people: \"Pray only to Allah and be good.\" He told them for a very long time, but most of them did not listen. Nuh never gave up. He was very patient.\n\nAllah told Nuh to build a big ship. Nuh built it, plank by plank.\n\nThen the rain came. It rained and rained! Nuh, the people who believed, and two of each animal went on the ship.\n\nAllah kept them all safe on the water.","arabic":null,"translit":null,"meaning":null,"action":"Is something hard for you today? Keep trying, like Prophet Nuh. Do not give up!","teacher_note":"Let children name animals going on the ship two by two. The lesson is patience and that Allah keeps safe those who listen to Him. Keep the flood gentle, not frightening.","questions":[{"prompt":"What did Allah tell Nuh to build?","options":["A tall tower","A bridge","A big ship"],"answer":2,"explain":"Nuh built a big ship (the ark)."},{"prompt":"Who went on the ship?","options":["The believers and the animals","Nobody","Only Nuh"],"answer":0,"explain":"The believers and two of each animal."},{"prompt":"What can we learn from Prophet Nuh?","options":["Be lazy","Be patient and do not give up","Be loud"],"answer":1,"explain":"Nuh was patient for a very long time."}]},{"title":"Prophet Yunus and the Whale","minutes":6,"hook":"What is the biggest animal in the sea?","body":"Prophet Yunus, peace be upon him, was sent to teach his people. They did not listen, so he left them and got on a ship. But Allah had not told him to go yet.\n\nA big storm came. Yunus fell into the sea, and a giant whale swallowed him!\n\nInside the whale it was very dark. Yunus was not hurt. He called to Allah: \"There is no god but You. You are perfect. I made a mistake.\"\n\nAllah heard him. The whale put Yunus safely on the beach.\n\nAllah always hears us, anywhere.","arabic":"لَا إِلٰهَ إِلَّا أَنْتَ سُبْحَانَكَ","translit":"La ilaha illa anta, subhanak","meaning":"There is no god but You. You are perfect.","action":"When you feel scared or sad, talk to Allah. He hears you everywhere.","teacher_note":"Dim the lights or cover eyes for \"inside the whale\", then \"open\" for the beach. The lesson: Allah hears us even in the darkest place.","questions":[{"prompt":"What swallowed Prophet Yunus?","options":["A lion","A bird","A giant whale"],"answer":2,"explain":"A giant whale swallowed him."},{"prompt":"What did Yunus do inside the whale?","options":["He shouted at the whale","He called to Allah","He went to sleep"],"answer":1,"explain":"He made dua to Allah."},{"prompt":"Can Allah hear us everywhere?","options":["Only in the day","Yes, everywhere","Only at the masjid"],"answer":1,"explain":"Allah hears us wherever we are."}]}]},{"title":"My Good Manners","summary":"Loving parents, telling the truth, sharing and being kind.","goal":"The child shows each manner at home and parents notice the change.","lessons":[{"title":"I Love My Mama and Baba","minutes":5,"hook":"Who gives you a hug when you are sad?","body":"Mama and Baba love you so much. They cook for you. They take care of you when you are sick. They work hard for you.\n\nAllah tells us in the Qur'an to be very good to our parents.\n\nWe listen when they call us. We say \"Yes, Mama\" and \"Yes, Baba\". We do not shout at them. We help them at home.\n\nWhen we make our parents happy, Allah is happy with us.","arabic":"وَبِالْوَالِدَيْنِ إِحْسَانًا","translit":"Wa bil-walidayni ihsana","meaning":"And be very good to your parents","action":"Give Mama and Baba a big hug today and say \"I love you\".","teacher_note":"Ask: \"What is one thing Mama or Baba did for you today?\" Children draw a helping picture to give at home. Be sensitive: some children live with other carers.","questions":[{"prompt":"Who tells us to be good to our parents?","options":["Our toys","Allah","Nobody"],"answer":1,"explain":"Allah tells us in the Qur'an."},{"prompt":"What do we do when Mama calls us?","options":["We listen and come","We hide","We shout"],"answer":0,"explain":"We answer nicely and come."},{"prompt":"When our parents are happy with us…","options":["Nothing happens","Allah is happy with us","We lose our toys"],"answer":1,"explain":"Making parents happy makes Allah happy."}]},{"title":"I Always Tell the Truth","minutes":5,"hook":"Oh no — the cup fell and broke! What will you say?","body":"A Muslim tells the truth.\n\nIf we break something, we say: \"I did it. I am sorry.\" That is being brave.\n\nTelling a lie means saying something that is not true. Lies make hearts sad, and they make people stop trusting us.\n\nThe Prophet Muhammad, peace be upon him, always told the truth. Even before he was a prophet, people called him \"Al-Amin\", the one you can trust.\n\nAllah sees everything and Allah loves people who tell the truth.","arabic":null,"translit":null,"meaning":null,"action":"Tell the truth all day today, even if it is a little bit hard.","teacher_note":"Use puppets: one tells the truth about a spilled drink, one hides it. Ask how each felt. Praise truth-telling warmly whenever it happens in class, especially when it costs the child something.","questions":[{"prompt":"What does a Muslim always tell?","options":["Jokes only","Lies","The truth"],"answer":2,"explain":"A Muslim tells the truth."},{"prompt":"If you break something, what do you say?","options":["I did it. I am sorry.","It was the cat!","Nothing"],"answer":0,"explain":"Telling the truth is brave."},{"prompt":"What did people call the Prophet?","options":["The tall man","Al-Amin, the one you can trust","The rich man"],"answer":1,"explain":"He was known for always being truthful."}]},{"title":"I Share and I Am Kind","minutes":5,"hook":"You have two cookies and your friend has none. What will you do?","body":"Allah loves people who share.\n\nWe share our toys. We share our food. We let others have a turn.\n\nWe are kind to everyone: our brothers and sisters, our friends, and people who have less than us. We are kind to animals too. We give them food and water and we never hurt them.\n\nWhen we give, Allah gives us more. A kind heart is a happy heart!","arabic":null,"translit":null,"meaning":null,"action":"Share one thing with someone today, and be gentle with an animal or a plant.","teacher_note":"Give pairs one crayon box to share on a drawing. Notice and name sharing out loud. Tell the short story of the man who gave water to a thirsty dog and Allah was pleased with him.","questions":[{"prompt":"What do we do with our toys?","options":["We break them","We share them","We hide them"],"answer":1,"explain":"Allah loves those who share."},{"prompt":"How do we treat animals?","options":["We scare them","We are kind to them","We hurt them"],"answer":1,"explain":"We are gentle with every living thing."},{"prompt":"When we give to others…","options":["Nothing happens","Allah gives us more","We become sad"],"answer":1,"explain":"Giving brings more good from Allah."}]}]}]},{"id":2,"code":"huda","name":"Huda","arabic":"هدى","age_min":8,"age_max":10,"tagline":"Finding the way — knowing what I believe and how I worship","about":"Children learn what Muslims believe and why, the five pillars, how to make wudu and pray properly, how the Qur'an came to us, the great stories of Ibrahim, Musa and Yusuf, and the character of a believer.","psychology":"How children aged 8–10 learn\n- This is the age of \"I can do it\". They want to master real skills. Give them clear steps and let them show you: a correct wudu, a full rak'ah, a surah by heart.\n- They care deeply about rules and fairness. Explain the reason behind each rule; \"because Allah is wise and this is good for us\" lands better than \"because I said so\".\n- Attention is about 10–15 minutes. Teach for eight, then let them practise, quiz or discuss.\n- They compare themselves with classmates. Praise effort and improvement, never rank children in front of each other. The portal shows each child only their own stars.\n- They love collecting. Stars, badges and certificates work well when tied to real effort: finishing a lesson, handing in homework, helping someone.\n- Heroes matter. Present the prophets as real people who were brave, honest and patient, so the child wants to be like them.\n- Give small responsibilities: lead the dua, be the \"salam captain\", check a friend's wudu steps kindly.\n- Feedback should be specific and kind: say exactly what was right, then one thing to practise next.\n- Connect to home: each lesson ends with something to do or teach at home the same day.","units":[{"title":"What I Believe","summary":"The shahadah and the six things every Muslim believes.","goal":"The student can say the shahadah with its meaning and list the six articles of faith.","lessons":[{"title":"The Shahadah — My Promise","minutes":8,"hook":"What is the most important sentence you know?","body":"The shahadah is the most important sentence in Islam. It has two parts.\n\nThe first part: \"La ilaha illa Allah\" — there is no god except Allah. Only Allah made us, only Allah deserves our worship, and we ask only Allah in our prayers.\n\nThe second part: \"Muhammadur rasulullah\" — Muhammad is the Messenger of Allah. Allah sent him to teach us how to live, so we love him and follow his way.\n\nA person becomes a Muslim by believing these words and saying them. Every time we say them, we renew our promise to Allah.","arabic":"لَا إِلٰهَ إِلَّا اللهُ مُحَمَّدٌ رَسُولُ اللهِ","translit":"La ilaha illa Allah, Muhammadur rasulullah","meaning":"There is no god except Allah; Muhammad is the Messenger of Allah","action":"Say the shahadah slowly, with its meaning, to someone at home today.","teacher_note":"Write the two halves on two cards and let students match each to its meaning. Ask: \"How does a person who believes this act differently?\"","questions":[{"prompt":"What does \"La ilaha illa Allah\" mean?","options":["All thanks are for Allah","Allah is the Greatest","Peace be on you","There is no god except Allah"],"answer":3,"explain":"It means nothing deserves worship except Allah."},{"prompt":"What is the second part of the shahadah about?","options":["Muhammad is the Messenger of Allah","The angels","The month of Ramadan","The five prayers"],"answer":0,"explain":"We testify that Muhammad ﷺ is Allah's Messenger."},{"prompt":"Why did Allah send the Prophet Muhammad ﷺ?","options":["To be rich","To build houses","To be a king","To teach us how to live"],"answer":3,"explain":"He was sent as a teacher and a mercy."}]},{"title":"The Six Things I Believe","minutes":8,"hook":"Can you believe in something you cannot see? Think of the wind.","body":"Iman means faith. A Muslim believes in six things:\n\n- Allah — the One God, who made everything\n- His angels — made of light, they always obey Allah\n- His books — the messages Allah sent, the last being the Qur'an\n- His messengers — the prophets, from Adam to Muhammad, peace be upon them\n- The Last Day — when everyone returns to Allah and good deeds are rewarded\n- Qadar — Allah knows everything and nothing happens without His plan\n\nWe cannot see all of these with our eyes, but we know them from the Qur'an, the true words of Allah.","arabic":null,"translit":null,"meaning":null,"action":"Count the six beliefs on your fingers until you can say them without looking.","teacher_note":"Use the wind/electricity example for unseen things. Turn the six into a hand-count chant. Keep the Last Day hopeful: \"the day Allah rewards every good thing you did\".","questions":[{"prompt":"How many things does a Muslim believe in (the pillars of iman)?","options":["Ten","Five","Six","Three"],"answer":2,"explain":"There are six articles of faith."},{"prompt":"What does \"iman\" mean?","options":["Charity","Prayer","Fasting","Faith"],"answer":3,"explain":"Iman means faith, belief in the heart."},{"prompt":"What are the angels made of?","options":["Water","Light","Fire","Clay"],"answer":1,"explain":"Angels are made of light and always obey Allah."}]},{"title":"Angels and Holy Books","minutes":8,"hook":"Did you know there are angels with you right now?","body":"Angels are Allah's servants made of light. They never get tired and never disobey.\n\nSome angels we know by name. Jibril brought Allah's words to the prophets. Mikail is in charge of rain. Israfil will blow the trumpet on the Last Day. Two angels are with each of us, writing our deeds, so let us give them good things to write!\n\nAllah also sent books to guide people: the Tawrah to Prophet Musa, the Zabur to Prophet Dawud, the Injil to Prophet Isa, and the Qur'an to Prophet Muhammad, peace be upon them all. The Qur'an is the final book, and Allah has promised to protect it from any change.","arabic":null,"translit":null,"meaning":null,"action":"Do one good deed in secret today, knowing your angels are writing it.","teacher_note":"Matching game: angel → job, book → prophet. Emphasise the comforting side of the recording angels (every small good deed counts).","questions":[{"prompt":"Which angel brought Allah's words to the prophets?","options":["Mikail","Israfil","None of them","Jibril"],"answer":3,"explain":"Jibril brought the revelation."},{"prompt":"Which book was given to Prophet Musa?","options":["The Injil","The Tawrah","The Zabur","The Qur'an"],"answer":1,"explain":"The Tawrah was given to Musa."},{"prompt":"Which book has Allah promised to protect from change?","options":["The Qur'an","None","A story book","The Zabur"],"answer":0,"explain":"The Qur'an is preserved exactly as it was revealed."}]}]},{"title":"The Five Pillars","summary":"The five strong pillars that hold up a Muslim's life.","goal":"The student names the five pillars in order and explains each in one sentence.","lessons":[{"title":"Five Pillars Hold Up My Islam","minutes":8,"hook":"What happens to a tent if you take away its poles?","body":"Islam stands on five pillars, like a strong building.\n\n- Shahadah — saying and believing that there is no god but Allah and Muhammad is His Messenger\n- Salah — praying five times a day\n- Zakah — giving a share of our wealth to people in need\n- Sawm — fasting in the month of Ramadan\n- Hajj — travelling to Makkah once in a lifetime, if we are able\n\nEach pillar trains us. Salah keeps us close to Allah. Zakah makes us generous. Fasting makes us patient and thankful. Hajj reminds us that all Muslims are one family.","arabic":null,"translit":null,"meaning":null,"action":"Draw a building with five pillars and write one pillar on each. Show it to your family.","teacher_note":"Build five pillars from cups or blocks with a \"roof\" on top; remove one to show why each matters. Students explain one pillar each to a partner.","questions":[{"prompt":"How many pillars does Islam have?","options":["Three","Six","Five","Seven"],"answer":2,"explain":"Islam is built on five pillars."},{"prompt":"Which pillar is praying five times a day?","options":["Hajj","Salah","Zakah","Sawm"],"answer":1,"explain":"Salah is the daily prayer."},{"prompt":"Which pillar means giving to people in need?","options":["Zakah","Sawm","Hajj","Shahadah"],"answer":0,"explain":"Zakah is giving a share of our wealth."}]},{"title":"Ramadan and Fasting","minutes":8,"hook":"Have you ever waited all day for a special meal?","body":"Ramadan is the ninth month of the Islamic year. It is the month in which the Qur'an was first sent down.\n\nIn Ramadan, grown-up Muslims fast: they do not eat or drink from dawn until sunset. The meal before dawn is called suhur, and the meal at sunset is called iftar.\n\nFasting is not only about food. We also keep our tongue from bad words and our hands from bad actions. We read more Qur'an, pray more and give more.\n\nFasting teaches us patience and makes us feel for people who are hungry. When Ramadan ends, we celebrate Eid al-Fitr. Children can practise with a half-day fast when their parents say they are ready.","arabic":null,"translit":null,"meaning":null,"action":"Ask your parents about their first fast. How old were they? How did it feel?","teacher_note":"Discuss \"fasting of the tongue and hands\". Make a Ramadan good-deed chart. Remind them children are not required to fast; practising is a happy choice with parents.","questions":[{"prompt":"In which month do Muslims fast?","options":["Rajab","Shawwal","Muharram","Ramadan"],"answer":3,"explain":"We fast in Ramadan, the ninth month."},{"prompt":"When does the fast begin and end each day?","options":["All day and all night","From dawn until sunset","From noon until midnight","From sunset until dawn"],"answer":1,"explain":"From dawn (Fajr) until sunset (Maghrib)."},{"prompt":"What is the meal at sunset called?","options":["Eid","Zakah","Iftar","Suhur"],"answer":2,"explain":"Iftar is when we break the fast."}]},{"title":"Zakah and Hajj","minutes":8,"hook":"If you had ten apples and your neighbour had none, what would be fair?","body":"Zakah means that Muslims who have enough savings give a small share, one part out of every forty, to people in need each year. It cleans our wealth and our hearts, and nobody in the community is forgotten. Giving extra, any time, is called sadaqah. Even a smile is sadaqah!\n\nHajj is the journey to Makkah. Muslims who are able go once in their life. They walk around the Ka'bah, the house built by Prophet Ibrahim and his son Isma'il. Everyone wears simple white clothes, so rich and poor look the same.\n\nAt the time of Hajj, Muslims all over the world celebrate Eid al-Adha.","arabic":null,"translit":null,"meaning":null,"action":"Give a little sadaqah today: a coin in the charity box, or help someone without being asked.","teacher_note":"Show 40 counters and take 1 aside to make \"one in forty\" concrete. Show a photo of pilgrims in ihram and ask what they notice (everyone equal).","questions":[{"prompt":"What is zakah?","options":["Giving a share of our savings to people in need","Travelling to Makkah","Fasting in Ramadan","Praying at night"],"answer":0,"explain":"Zakah is the yearly share given to those in need."},{"prompt":"Who built the Ka'bah?","options":["Prophet Yusuf","Prophet Ibrahim and his son Isma'il","Prophet Musa","Prophet Nuh"],"answer":1,"explain":"Ibrahim and Isma'il built the Ka'bah."},{"prompt":"Why do pilgrims wear the same simple clothes?","options":["Because white is cheap","For no reason","Because it is cold","To show all people are equal before Allah"],"answer":3,"explain":"Rich and poor stand equal before Allah."}]}]},{"title":"My Salah","summary":"A correct wudu, the five prayer times and the steps of the prayer.","goal":"The student performs wudu correctly and can pray two rak'ahs with the teacher watching.","lessons":[{"title":"Wudu Step by Step","minutes":8,"hook":"Could you teach wudu to a younger child? After today, you can!","body":"Wudu makes us ready for salah. Make the intention in your heart, say Bismillah, then:\n\n- Wash both hands up to the wrists, three times\n- Rinse your mouth three times\n- Rinse your nose three times\n- Wash your whole face three times\n- Wash your right arm, then your left, up to and including the elbows, three times\n- Wipe your head once with wet hands\n- Wipe your ears once\n- Wash your right foot, then your left, up to and including the ankles, three times\n\nMake sure the water reaches every part, and do not waste water. The Prophet, peace be upon him, used very little water for wudu.","arabic":null,"translit":null,"meaning":null,"action":"Make wudu carefully today and ask a parent to watch. Did water reach your elbows and ankles?","teacher_note":"Practise as a dry run, then set a \"wudu check\" homework where a parent watches. Order and completeness matter more than speed. Mention that wudu is needed again after using the toilet or sleeping.","questions":[{"prompt":"What do we say at the start of wudu?","options":["Ameen","Allahu Akbar","Alhamdulillah","Bismillah"],"answer":3,"explain":"We begin wudu with Bismillah."},{"prompt":"How far do we wash our arms?","options":["Only the hands","Only the fingers","Up to the shoulders","Up to and including the elbows"],"answer":3,"explain":"The arms are washed including the elbows."},{"prompt":"How many times do we wipe the head?","options":["Once","Three times","Never","Five times"],"answer":0,"explain":"The head is wiped once."}]},{"title":"Five Prayers, Five Times","minutes":8,"hook":"What do you do five times every day without fail?","body":"Allah gave us five meetings with Him every day:\n\n- Fajr — at dawn, 2 rak'ahs\n- Dhuhr — just after midday, 4 rak'ahs\n- Asr — in the afternoon, 4 rak'ahs\n- Maghrib — just after sunset, 3 rak'ahs\n- Isha — at night, 4 rak'ahs\n\nA rak'ah is one unit of prayer: standing, bowing and two prostrations.\n\nThe call to prayer is the adhan. We face the qiblah, the direction of the Ka'bah in Makkah. Praying on time is one of the deeds Allah loves most. The Prophet, peace be upon him, asked parents to teach their children to pray from the age of seven.","arabic":null,"translit":null,"meaning":null,"action":"Find out today's five prayer times where you live and write them down.","teacher_note":"Make a clock chart with the five prayers. Clap the rak'ah numbers: 2-4-4-3-4. Let students find the qiblah direction for their own home.","questions":[{"prompt":"How many rak'ahs is Maghrib?","options":["3","4","2","5"],"answer":0,"explain":"Maghrib has three rak'ahs."},{"prompt":"Which prayer has 2 rak'ahs?","options":["Asr","Dhuhr","Fajr","Isha"],"answer":2,"explain":"Fajr has two rak'ahs."},{"prompt":"What is the qiblah?","options":["A prayer mat","The washing before prayer","The call to prayer","The direction of the Ka'bah"],"answer":3,"explain":"We face the Ka'bah in Makkah when we pray."}]},{"title":"How I Pray","minutes":10,"hook":"When you speak to someone important, you stand up straight. In salah we speak to Allah.","body":"Here is one rak'ah, step by step:\n\n- Stand facing the qiblah, make your intention, raise your hands and say \"Allahu Akbar\"\n- Standing, recite Surah Al-Fatiha and then another short surah\n- Bow (ruku) and say \"Subhana Rabbiyal-Azim\" three times\n- Stand up straight again\n- Go down in sujud, forehead on the ground, and say \"Subhana Rabbiyal-A'la\" three times\n- Sit for a moment, then make a second sujud\n\nThat is one rak'ah. At the end of the prayer we sit, recite the tashahhud, and finish by turning our head right and then left, saying \"Assalamu alaykum wa rahmatullah\".\n\nIn sujud we are closest to Allah, so it is a wonderful time to make dua.","arabic":null,"translit":null,"meaning":null,"action":"Pray two rak'ahs slowly today. Do not rush any step.","teacher_note":"Demonstrate, then have students perform while you narrate. Assess the practical under \"Salah practice\" in the portal. Small differences in hand positions between families are fine; do not correct what a child was taught at home.","questions":[{"prompt":"Which surah do we recite in every rak'ah?","options":["Al-Fatiha","Al-Ikhlas","Al-Asr","An-Nas"],"answer":0,"explain":"Al-Fatiha is recited in every rak'ah."},{"prompt":"What is bowing in prayer called?","options":["Sujud","Tashahhud","Ruku","Adhan"],"answer":2,"explain":"Ruku is the bowing position."},{"prompt":"When are we closest to Allah in the prayer?","options":["While standing","In sujud","Before we start","While sitting"],"answer":1,"explain":"In sujud, so we make dua there."}]}]},{"title":"The Qur'an and Me","summary":"How the Qur'an came to us and three short surahs with their meanings.","goal":"The student recites Al-Falaq, An-Nas and Al-Asr and explains what each teaches.","lessons":[{"title":"How the Qur'an Came to Us","minutes":8,"hook":"Imagine being all alone in a quiet cave on a mountain…","body":"When the Prophet Muhammad, peace be upon him, was forty years old, he used to sit in the cave of Hira, near Makkah, to think and worship.\n\nOne night in Ramadan, the angel Jibril came to him and said: \"Iqra!\" — \"Read!\" These were the first words of the Qur'an to be revealed.\n\nThe Qur'an came down little by little over 23 years. The Prophet's companions memorised it and wrote it down.\n\nThe Qur'an has 114 surahs. It is the same today, word for word, as it was then. The Prophet said: \"The best of you are those who learn the Qur'an and teach it.\"","arabic":"اقْرَأْ","translit":"Iqra","meaning":"Read!","action":"Read or listen to one page of the Qur'an today, then teach one thing you learned to someone.","teacher_note":"Tell it as a story with a hushed voice for the cave. Ask why the very first word was \"Read\" and what that tells us about learning.","questions":[{"prompt":"What was the first word revealed of the Qur'an?","options":["Bismillah","Iqra (Read)","Salam","Alhamdulillah"],"answer":1,"explain":"The first revelation began with \"Iqra\"."},{"prompt":"Where was the Prophet ﷺ when the first revelation came?","options":["At the Ka'bah","On a ship","In the cave of Hira","In Madinah"],"answer":2,"explain":"He was in the cave of Hira near Makkah."},{"prompt":"How many surahs are in the Qur'an?","options":["99","7","30","114"],"answer":3,"explain":"The Qur'an has 114 surahs."}]},{"title":"Al-Falaq and An-Nas — Allah Protects Me","minutes":8,"hook":"What do you do when something makes you afraid?","body":"The last two surahs of the Qur'an are Al-Falaq (The Daybreak) and An-Nas (Mankind). They both begin with \"Qul a'udhu\" — \"Say: I seek protection\".\n\nIn Al-Falaq, we ask Allah, the Lord of the daybreak, to protect us from the harm of what He created, from the darkness of night, and from people who are jealous.\n\nIn An-Nas, we ask Allah, the Lord and King of all people, to protect us from the whisperer who puts bad ideas in our hearts.\n\nThe Prophet, peace be upon him, recited these surahs with Al-Ikhlas every night before sleeping. Allah is our Protector, so a believer does not need to be afraid.","arabic":null,"translit":null,"meaning":null,"action":"Recite Al-Ikhlas, Al-Falaq and An-Nas before you sleep tonight.","teacher_note":"Ask what children fear at night and show how these surahs answer it. Teach the bedtime habit. Keep the \"whisperer\" simple: bad ideas we push away by remembering Allah.","questions":[{"prompt":"What do these two surahs ask Allah for?","options":["Rain","Food","Protection","Money"],"answer":2,"explain":"Both surahs ask Allah to protect us."},{"prompt":"What does \"An-Nas\" mean?","options":["The Daybreak","The Opening","Mankind (people)","Time"],"answer":2,"explain":"An-Nas means mankind."},{"prompt":"When did the Prophet ﷺ recite these surahs?","options":["Once a year","Only when travelling","Only in Ramadan","Every night before sleeping"],"answer":3,"explain":"He recited them every night before sleep."}]},{"title":"Surah Al-Asr — My Time is Precious","minutes":8,"hook":"Can you get back yesterday? Not even one minute of it!","body":"Surah Al-Asr has only three verses, yet it holds a huge lesson.\n\nAllah swears by time. Time is so valuable that every person is losing something as it passes, except those who do four things:\n\n- They believe in Allah\n- They do good deeds\n- They remind each other of the truth\n- They remind each other to be patient\n\nSo a winner is not the one with the most toys. A winner uses time well: praying, learning, helping, and encouraging friends to do good too.","arabic":null,"translit":null,"meaning":null,"action":"Choose one thing that wastes your time and swap ten minutes of it for something good today.","teacher_note":"Use a sand timer to make passing time visible. Students list \"time winners\" and \"time wasters\" in their own day. Keep it encouraging, not guilt-driven.","questions":[{"prompt":"What does Allah swear by in this surah?","options":["The mountains","Time","The sea","The sun"],"answer":1,"explain":"Allah swears by time (al-asr)."},{"prompt":"How many verses does Surah Al-Asr have?","options":["Three","Ten","Four","Seven"],"answer":0,"explain":"It has three short verses."},{"prompt":"Which of these saves a person from loss?","options":["Believing and doing good deeds","Being famous","Sleeping a lot","Having many toys"],"answer":0,"explain":"Faith, good deeds, truth and patience."}]}]},{"title":"Great Prophets, Great Lessons","summary":"Ibrahim, Musa and Yusuf: courage, trust and forgiveness.","goal":"The student retells each story and links it to a choice in their own life.","lessons":[{"title":"Prophet Ibrahim — The Brave Thinker","minutes":9,"hook":"Would you stand up for the truth if you were the only one?","body":"Ibrahim, peace be upon him, grew up among people who prayed to statues. He used his mind: \"How can a statue that cannot speak or move be a god?\" He knew that only Allah, who made the sun, the moon and the stars, deserves worship.\n\nHe told his people the truth, kindly and bravely. They became angry and threw him into a huge fire. But Allah said: \"O fire, be cool and safe for Ibrahim.\" And he walked out unharmed.\n\nLater, Ibrahim and his son Isma'il built the Ka'bah in Makkah. Ibrahim is called \"Khalilullah\", the close friend of Allah.","arabic":null,"translit":null,"meaning":null,"action":"Be brave for the truth today: speak up kindly if you see something unfair.","teacher_note":"Discuss: Ibrahim asked questions and thought for himself. Thinking is part of faith. Ask for examples of being brave and kind at the same time.","questions":[{"prompt":"What did Ibrahim's people worship?","options":["Statues (idols)","Allah alone","Nothing","Books"],"answer":0,"explain":"They worshipped idols that could not help anyone."},{"prompt":"What happened when Ibrahim was thrown into the fire?","options":["He ran away first","He was badly hurt","Allah made it cool and safe","It rained"],"answer":2,"explain":"Allah commanded the fire to be cool and safe."},{"prompt":"What did Ibrahim and Isma'il build?","options":["A ship","The Ka'bah","A bridge","A palace"],"answer":1,"explain":"They built the Ka'bah in Makkah."}]},{"title":"Prophet Musa — Trusting Allah","minutes":9,"hook":"What would you do with a sea in front of you and an army behind you?","body":"When Musa, peace be upon him, was a baby, a cruel king called Pharaoh was harming his people. Allah inspired Musa's mother to place him in a basket on the river. Allah kept him safe, and he grew up in Pharaoh's own palace!\n\nYears later, Allah chose Musa as a prophet and sent him to tell Pharaoh: \"Worship Allah and let my people go.\" Pharaoh refused.\n\nMusa led his people away, but Pharaoh's army chased them to the sea. The people were terrified. Musa said: \"No! My Lord is with me, and He will guide me.\" Allah told him to strike the sea with his staff. The sea split, and they crossed safely.","arabic":null,"translit":null,"meaning":null,"action":"When something worries you today, say: \"My Lord is with me\" and then do your best.","teacher_note":"Pause at the sea and ask \"What would you feel?\" before revealing Musa's words. The lesson is tawakkul: do your part, then trust Allah.","questions":[{"prompt":"How did Allah save baby Musa?","options":["His mother placed him in a basket on the river","An army protected him","He was hidden in a cave","He was taken to another land by ship"],"answer":0,"explain":"He floated safely on the river in a basket."},{"prompt":"What did Musa say when they were trapped at the sea?","options":["\"Go back\"","\"Let us fight\"","\"My Lord is with me, He will guide me\"","\"We are finished\""],"answer":2,"explain":"He trusted Allah completely."},{"prompt":"What did Allah tell Musa to do at the sea?","options":["Build a boat","Wait a week","Strike it with his staff","Swim across"],"answer":2,"explain":"He struck the sea and it split."}]},{"title":"Prophet Yusuf — Patience and Forgiveness","minutes":9,"hook":"Has someone ever been unfair to you? How did it feel?","body":"Yusuf, peace be upon him, was loved dearly by his father, Prophet Ya'qub. His brothers became jealous and threw him into a well. Travellers found him and sold him in Egypt, far from home.\n\nYusuf faced many tests. He was even put in prison although he had done nothing wrong. Through it all he stayed honest and patient, and he never stopped trusting Allah.\n\nIn the end the king saw how truthful and wise Yusuf was and put him in charge of all the food stores of Egypt. Years later his brothers came to him, hungry and in need. He could have punished them. Instead he said: \"No blame on you today. May Allah forgive you.\"","arabic":null,"translit":null,"meaning":null,"action":"Forgive someone who upset you this week, and make dua for them.","teacher_note":"Draw Yusuf's life as a line going down (well, prison) then up. Ask: \"Where was Allah in the low parts?\" Jealousy between siblings is a real topic at this age; let them talk.","questions":[{"prompt":"Why did Yusuf's brothers throw him into a well?","options":["He asked them to","They were jealous","By accident","To hide him from an enemy"],"answer":1,"explain":"Jealousy pushed them to harm him."},{"prompt":"How did Yusuf behave during his tests?","options":["Angry and hopeless","He gave up","He lied to escape","Patient, honest and trusting Allah"],"answer":3,"explain":"He stayed patient and truthful."},{"prompt":"What did Yusuf do when his brothers came to him in need?","options":["He sent them away hungry","He punished them","He ignored them","He forgave them"],"answer":3,"explain":"He forgave them and prayed for them."}]}]},{"title":"The Character of a Muslim","summary":"Honesty, staying calm when angry, and the daily duas.","goal":"The student practises each trait for a week and reports back honestly.","lessons":[{"title":"Honesty — Being Al-Amin","minutes":8,"hook":"Would your friends give you their most precious thing to look after?","body":"Long before he became a prophet, the people of Makkah gave Muhammad, peace be upon him, a title: \"Al-Amin\", the Trustworthy. They left their valuables with him because they knew he never lied and never cheated.\n\nHonesty means telling the truth, keeping promises, returning what we borrow, and not cheating in games or tests, even when nobody is watching. Allah always sees.\n\nThe Prophet taught that truthfulness leads to goodness, and goodness leads to Paradise.\n\nOne lie often needs another lie to cover it. The truth may be hard for a minute, but it keeps your heart light and makes people trust you.","arabic":null,"translit":null,"meaning":null,"action":"Keep every promise you make today, even the small ones.","teacher_note":"Scenarios: found money, a test where the teacher leaves the room, a broken promise. Students decide what \"Al-Amin\" would do. Praise honesty in class even when the truth is uncomfortable.","questions":[{"prompt":"What does \"Al-Amin\" mean?","options":["The Trustworthy","The Rich","The Tall","The Strong"],"answer":0,"explain":"Al-Amin means the trustworthy one."},{"prompt":"Which of these is part of honesty?","options":["Cheating quietly","Keeping promises","Blaming others","Hiding the truth"],"answer":1,"explain":"Honesty includes keeping our promises."},{"prompt":"Who sees us when nobody else is watching?","options":["Only our friends","Nobody","Only the teacher","Allah"],"answer":3,"explain":"Allah always sees, so we are honest everywhere."}]},{"title":"Staying Calm When I Am Angry","minutes":8,"hook":"Who is stronger: a wrestler, or someone who can control their temper?","body":"Everyone feels angry sometimes. Feeling angry is not a sin; what matters is what we do next.\n\nThe Prophet, peace be upon him, said the strong person is not the one who wins at wrestling, but the one who controls himself when he is angry.\n\nHe taught us what to do:\n- Say \"A'udhu billahi minash-shaytanir-rajim\" (I seek protection with Allah from Shaytan)\n- Stay quiet and do not answer back\n- If you are standing, sit down\n- Make wudu; water cools anger\n\nOnce you are calm, you can explain how you feel with kind words.","arabic":null,"translit":null,"meaning":null,"action":"Next time you feel angry, try the steps: stop, seek Allah's protection, sit, stay quiet.","teacher_note":"Normalise the feeling first. Act out a trigger (someone takes your pen) and practise the steps in slow motion. Make a \"calm-down card\" for home.","questions":[{"prompt":"Who did the Prophet ﷺ say is the strong person?","options":["The best wrestler","The loudest person","The tallest person","The one who controls himself when angry"],"answer":3,"explain":"Real strength is self-control."},{"prompt":"What can we do when we feel angry?","options":["Hit back","Shout louder","Break something","Stay quiet and sit down"],"answer":3,"explain":"Silence and sitting down help the anger pass."},{"prompt":"Is it a sin just to feel angry?","options":["Only on Fridays","No, what matters is what we do next","Yes, always","Only for adults"],"answer":1,"explain":"The feeling is natural; we control the action."}]},{"title":"My Daily Duas","minutes":8,"hook":"Would you like Allah to be with you from morning until night?","body":"Dua means asking Allah. The Prophet, peace be upon him, taught short duas for every part of the day:\n\n- Waking up: \"Alhamdulillah\" — thanking Allah for a new day\n- Before eating: \"Bismillah\"\n- After eating: \"Alhamdulillah\"\n- When we sneeze: \"Alhamdulillah\", and others reply \"Yarhamuk Allah\" (may Allah have mercy on you)\n- Before sleeping: \"Bismika Allahumma amutu wa ahya\" (In Your name, O Allah, I die and I live)\n- For learning: \"Rabbi zidni ilma\" (My Lord, increase me in knowledge)\n\nYou can also make dua in your own words, in any language, at any time. Allah hears every whisper.","arabic":"رَبِّ زِدْنِي عِلْمًا","translit":"Rabbi zidni ilma","meaning":"My Lord, increase me in knowledge","action":"Say \"Rabbi zidni ilma\" before you start your homework today.","teacher_note":"Make a daily dua tracker for one week. Start each class with \"Rabbi zidni ilma\". Invite children to share a dua in their own words.","questions":[{"prompt":"What does \"Rabbi zidni ilma\" mean?","options":["Allah is the Greatest","In the name of Allah","My Lord, increase me in knowledge","Peace be on you"],"answer":2,"explain":"It is the dua for learning."},{"prompt":"What do we say when we sneeze?","options":["Bismillah","Ameen","Allahu Akbar","Alhamdulillah"],"answer":3,"explain":"We say Alhamdulillah after sneezing."},{"prompt":"Can we make dua in our own language?","options":["No, only in Arabic","Only at the masjid","Only adults can","Yes, Allah hears every language"],"answer":3,"explain":"Allah understands every language and every whisper."}]}]}]},{"id":3,"code":"hikmah","name":"Hikmah","arabic":"حكمة","age_min":11,"age_max":13,"tagline":"Growing in wisdom — understanding my faith and living it with confidence","about":"Students explore the reasons behind belief, worship with meaning, the life of the Prophet ﷺ, how to reflect on the Qur'an, character in friendships and online, and being a confident Muslim wherever they live.","psychology":"How students aged 11–13 learn\n- They are starting to think in ideas and to ask \"why?\" and \"how do we know?\". Treat every question as welcome. A doubt answered calmly builds stronger faith than a doubt silenced.\n- Identity is forming: \"Who am I? Where do I belong?\" Many live as a minority. Give them pride without arrogance and the words to explain their faith kindly.\n- Friends matter more than adults now. Use pair and group discussion, and talk honestly about peer pressure and life online.\n- They want respect and independence. Offer choices, ask for their opinion, and let them lead part of the lesson.\n- They are sensitive to embarrassment. Never correct or compare in a way that shames them in front of the class. Give private, specific feedback through the portal.\n- Connect every topic to real life this week: school, phones, friendships, family. Abstract talk without a real example is forgotten.\n- Move from \"do this\" to \"why this is good for you\". Show the wisdom behind acts of worship so the practice becomes their own choice.\n- Motivation shifts from stars to meaning and mastery. Keep the rewards, but give more weight to reflection tasks, projects and trusted responsibilities such as helping younger students.\n- Be a mentor more than a lecturer: listen first, be honest about what scholars differ on, and say \"I will find out\" when you do not know.","units":[{"title":"Knowing Allah","summary":"Reasons to believe, who Allah is, and trusting His plan.","goal":"The student can explain in their own words why they believe in Allah and what tawhid means.","lessons":[{"title":"Why I Believe — Signs All Around","minutes":10,"hook":"If you found a phone on a beach, would you think the waves built it?","body":"A phone needs a designer. Yet the human eye, a single living cell and the orbits of the planets are far more precise than any phone.\n\nThe Qur'an invites us to think. It asks: were they created by nothing, or did they create themselves? It points to the sky, the rain, the alternation of night and day, and our own bodies as \"ayat\", signs, for people who use their minds.\n\nBelief in Islam is not blind. Prophet Ibrahim reasoned his way from the stars to their Maker. Allah praises \"those who reflect\".\n\nThere is also a sign inside us: the fitrah, the natural pull every person feels to turn to their Creator, especially in times of need.","arabic":null,"translit":null,"meaning":null,"action":"Spend five quiet minutes looking at the sky or at your own hand. Write down two things that point you to Allah.","teacher_note":"Run this as a discussion, not a lecture. Collect the students' own \"why\" questions on a board and treat each with respect. It is fine to say \"good question, let us look into it\".","questions":[{"prompt":"What does the word \"ayat\" mean here?","options":["Rules","Signs","Prayers","Stories"],"answer":1,"explain":"The universe is full of ayat, signs that point to Allah."},{"prompt":"What is the \"fitrah\"?","options":["A chapter of the Qur'an","A month of the year","A type of prayer","The natural pull in every person toward their Creator"],"answer":3,"explain":"Fitrah is the inborn nature that recognises Allah."},{"prompt":"How does the Qur'an ask us to approach belief?","options":["By never asking questions","By copying others only","By thinking and reflecting","By guessing"],"answer":2,"explain":"The Qur'an repeatedly invites us to reflect."}]},{"title":"Tawhid and the Beautiful Names","minutes":10,"hook":"How would you describe someone you love to a friend who has never met them?","body":"Tawhid means the oneness of Allah. He alone created and runs everything, He alone deserves worship, and nothing is like Him. It is the heart of Islam and the message of every prophet.\n\nWe come to know Allah through His beautiful names. A few of them:\n\n- Ar-Rahman, Ar-Rahim — the Most Merciful, the Especially Merciful\n- Al-Alim — the All-Knowing\n- As-Sami', Al-Basir — the All-Hearing, the All-Seeing\n- Al-Ghafur — the Most Forgiving\n- Ar-Razzaq — the Provider\n\nKnowing these names changes how we live. If Allah is As-Sami', He hears my quietest dua. If He is Al-Ghafur, I never lose hope after a mistake. The opposite of tawhid is shirk: giving Allah's rights to anyone or anything else.","arabic":null,"translit":null,"meaning":null,"action":"Choose one name of Allah and call on Him by it in your dua tonight: \"Ya Ghafur, forgive me.\"","teacher_note":"Each student picks a name, finds its meaning and one way it changes their day, then shares. Avoid heavy theological terms; aim for a personal relationship with Allah.","questions":[{"prompt":"What does tawhid mean?","options":["The oneness of Allah","Pilgrimage","The five prayers","Charity"],"answer":0,"explain":"Tawhid: Allah is One with no partner."},{"prompt":"What does \"Al-Ghafur\" mean?","options":["The All-Seeing","The Provider","The All-Knowing","The Most Forgiving"],"answer":3,"explain":"Al-Ghafur is the Most Forgiving."},{"prompt":"What is the opposite of tawhid?","options":["Shukr","Sabr","Sadaqah","Shirk"],"answer":3,"explain":"Shirk is associating partners with Allah."}]},{"title":"Qadar and Tawakkul — Trusting the Plan","minutes":10,"hook":"You studied hard and still got a disappointing mark. Now what?","body":"Qadar means that Allah knows everything and that nothing happens outside His knowledge and wisdom. That does not make us robots: we really do choose, and we are responsible for our choices.\n\nTawakkul is trusting Allah after doing our part. A man asked the Prophet, peace be upon him, whether he should tie his camel or trust in Allah. He answered: \"Tie it, and trust in Allah.\"\n\nSo a believer works hard, makes dua, then accepts the result with a calm heart. If it is good, we are thankful. If it is hard, we are patient, knowing Allah may be protecting us or preparing something better.\n\nAllah promises: \"Indeed, with hardship comes ease.\"","arabic":"إِنَّ مَعَ الْعُسْرِ يُسْرًا","translit":"Inna ma'al-'usri yusra","meaning":"Indeed, with hardship comes ease (94:6)","action":"Think of one thing that is worrying you. Write your \"camel\" (what you can do) and then hand the rest to Allah in dua.","teacher_note":"Students often ask \"If Allah knows, why try?\" Use the camel hadith and the exam example. Be gentle: some may be carrying real hardship. Listen more than you explain.","questions":[{"prompt":"What does tawakkul mean?","options":["Blaming others","Doing nothing and waiting","Trusting Allah after doing our part","Worrying a lot"],"answer":2,"explain":"We act, then trust Allah with the outcome."},{"prompt":"What did the Prophet ﷺ tell the man with the camel?","options":["Sell it","Stay with it all night","Tie it, and trust in Allah","Leave it untied"],"answer":2,"explain":"Take the means, then rely on Allah."},{"prompt":"Does qadar mean we have no choice?","options":["Yes, nothing we do matters","Only adults choose","Only on some days","No, we choose and are responsible"],"answer":3,"explain":"Allah knows all, and we are still responsible for our choices."}]}]},{"title":"Worship with Heart","summary":"Intention, focus in prayer, and the wisdom behind fasting and zakah.","goal":"The student can explain the purpose of each act of worship and sets one personal goal for their salah.","lessons":[{"title":"Intention and Focus in Salah","minutes":10,"hook":"Have you ever finished a prayer and not remembered a single word you said?","body":"The Prophet, peace be upon him, said: \"Actions are judged by their intentions.\" The same action can be worship or mere habit; the heart decides.\n\nKhushu means being present and humble in prayer. It is not about being perfect; minds wander, and we gently bring them back. Things that help:\n\n- Make wudu calmly and arrive a minute early\n- Put the phone away and choose a quiet spot\n- Learn the meaning of what you recite, especially Al-Fatiha\n- Slow down; let each position become still before the next\n- Remember you are standing before Allah, who is listening and answering\n\nSalah is five short breaks in the day to reset, be thankful and ask for help. It is a gift, not a chore.","arabic":null,"translit":null,"meaning":null,"action":"Pick one prayer today and pray it slowly, thinking about the meaning of each line of Al-Fatiha.","teacher_note":"Ask honestly: \"What distracts you most?\" No judgement. Each student sets one small, private salah goal and records it; follow up through the portal in two weeks.","questions":[{"prompt":"What did the Prophet ﷺ say actions are judged by?","options":["How many people see them","Their intentions","Their length","How difficult they are"],"answer":1,"explain":"Actions are by intentions."},{"prompt":"What is khushu?","options":["Praying only in a masjid","Being present and humble in prayer","Praying very fast","A special prayer on Friday"],"answer":1,"explain":"Khushu is presence of heart in salah."},{"prompt":"Which of these helps focus in salah?","options":["Rushing each position","Thinking about games","Keeping the phone nearby","Knowing the meaning of what we recite"],"answer":3,"explain":"Understanding the words keeps the heart present."}]},{"title":"Fasting and Taqwa","minutes":10,"hook":"Nobody would know if you secretly took a sip of water while fasting. So why don't you?","body":"Allah tells us the purpose of fasting: \"so that you may attain taqwa.\" Taqwa is being aware of Allah in a way that guides your choices, even when no one is watching.\n\nFasting trains this muscle. If I can say no to food and water, which are normally allowed, I can say no to things that are wrong.\n\nFasting also builds gratitude, because we feel what hunger is; self-control, because we do not act on every urge; and compassion for those who go hungry without choosing it.\n\nThe Prophet, peace be upon him, warned that a person who does not give up lying and bad behaviour gains nothing from leaving food and drink. A real fast includes the eyes, the tongue and the thumbs on a screen.","arabic":null,"translit":null,"meaning":null,"action":"Try a \"tongue fast\" today: no complaining, no gossip and no unkind messages until sunset.","teacher_note":"Discuss the opening question; it reveals taqwa by itself. Link self-control in fasting to self-control with screens. Fasting becomes obligatory at puberty; mention it naturally and without pressure.","questions":[{"prompt":"What does the Qur'an say is the purpose of fasting?","options":["To save money","To lose weight","To sleep more","To attain taqwa"],"answer":3,"explain":"Fasting is prescribed \"so that you may attain taqwa\"."},{"prompt":"What is taqwa?","options":["The night prayer","The end of Ramadan","A kind of food","Awareness of Allah that guides our choices"],"answer":3,"explain":"Taqwa is living with awareness of Allah."},{"prompt":"A complete fast also includes…","options":["Sleeping all day","Guarding our tongue and behaviour","Only skipping lunch","Staying silent all month"],"answer":1,"explain":"Fasting covers speech and actions, not just food."}]},{"title":"Zakah, Sadaqah and a Fair Society","minutes":10,"hook":"Is the money in your pocket completely yours?","body":"In Islam, wealth is a trust from Allah, and the poor have a right in it.\n\nZakah is the third pillar: Muslims whose savings stay above a set minimum (the nisab) for a year give 2.5% of it to those the Qur'an names, such as the poor and the needy. The word zakah means both \"purification\" and \"growth\". It cleans the heart of greed and helps a community grow together.\n\nSadaqah is voluntary giving, and it is wide. The Prophet, peace be upon him, said that removing something harmful from the road is sadaqah, a good word is sadaqah, and so is helping someone carry a load.\n\nImagine if every society made sure nobody was left behind. That is the kind of community Islam builds.","arabic":null,"translit":null,"meaning":null,"action":"Plan a small giving project: save a little of your pocket money this month for a cause, or give your time to help someone.","teacher_note":"Work a real calculation (2.5% of a sum). Let the class design a mini charity project and choose the cause themselves; ownership matters at this age.","questions":[{"prompt":"How much of qualifying savings is given as zakah each year?","options":["25%","50%","10%","2.5%"],"answer":3,"explain":"Zakah is 2.5%, one fortieth."},{"prompt":"What is the difference between zakah and sadaqah?","options":["They are exactly the same","Zakah is obligatory; sadaqah is voluntary","Sadaqah is only money","Zakah is only for children"],"answer":1,"explain":"Zakah is a pillar; sadaqah is extra giving of any kind."},{"prompt":"Which of these is a form of sadaqah?","options":["Ignoring someone","Wasting food","Keeping everything for yourself","Removing something harmful from the road"],"answer":3,"explain":"Even small helpful acts are sadaqah."}]}]},{"title":"The Life of the Prophet ﷺ","summary":"Makkah, the Hijrah, Madinah and the mercy of the final years.","goal":"The student can tell the main stages of the seerah and draw one personal lesson from each.","lessons":[{"title":"Makkah — Patience Under Pressure","minutes":10,"hook":"Could you stay kind to people who mocked you every single day?","body":"Muhammad, peace be upon him, was born in Makkah around the year 570. His father died before he was born and his mother when he was six. He was raised by his grandfather and then by his uncle, Abu Talib. He grew up known as Al-Amin, the Trustworthy.\n\nAt forty, he received the first revelation in the cave of Hira. His wife Khadijah was the first to believe. When he began calling people to worship Allah alone, the leaders of Makkah mocked him, harmed his followers and cut the Muslims off from food and trade for years.\n\nHe lost Khadijah and Abu Talib in the same year. In Ta'if he was driven out with stones. Even then he prayed for the people's guidance instead of their destruction.","arabic":null,"translit":null,"meaning":null,"action":"Someone was unkind to you recently? Respond the way the Prophet would: do not return it, and make dua for them.","teacher_note":"Draw a timeline together. Ask: \"What kept him going?\" Link to their own experience of being different at school. Let students voice how the Ta'if story makes them feel.","questions":[{"prompt":"Who was the first person to believe in the Prophet's message?","options":["Bilal","Abu Jahl","Abu Talib","Khadijah"],"answer":3,"explain":"His wife Khadijah believed first."},{"prompt":"How did the Prophet ﷺ respond to the people of Ta'if who harmed him?","options":["He never spoke of it","He prayed for their guidance","He fought them","He asked for them to be destroyed"],"answer":1,"explain":"He chose mercy and prayed for them."},{"prompt":"Where did the first revelation come?","options":["Jerusalem","The cave of Hira","Ta'if","Madinah"],"answer":1,"explain":"In the cave of Hira, near Makkah."}]},{"title":"The Hijrah — Building a New Community","minutes":10,"hook":"What would you take if you had to leave your home tonight for your faith?","body":"After thirteen hard years in Makkah, Allah gave permission to migrate to Madinah. This journey, the Hijrah, took place in the year 622 and marks the start of the Islamic calendar.\n\nThe Prophet, peace be upon him, travelled with his closest friend, Abu Bakr. They hid in the cave of Thawr while their enemies searched. Abu Bakr was afraid for him, and the Prophet said: \"Do not be sad. Allah is with us.\"\n\nIn Madinah he did three things first. He built a masjid as the heart of the community. He paired each migrant from Makkah with a helper from Madinah as brothers. And he made an agreement so that Muslims and the other communities of the city could live together in safety and justice.","arabic":null,"translit":null,"meaning":null,"action":"Welcome someone this week: a new student, a neighbour, or someone who sits alone.","teacher_note":"Discuss what makes a community strong using the three first steps. Many students have family stories of migration; invite them to share if they wish.","questions":[{"prompt":"What is the Hijrah?","options":["A battle","The migration from Makkah to Madinah","The first revelation","The pilgrimage to Makkah"],"answer":1,"explain":"The Hijrah is the migration to Madinah in 622."},{"prompt":"Who travelled with the Prophet ﷺ on the Hijrah?","options":["Abu Bakr","Uthman","Ali","Umar"],"answer":0,"explain":"His closest companion, Abu Bakr."},{"prompt":"What was one of the first things the Prophet ﷺ did in Madinah?","options":["He built a masjid","He went back to Makkah","He built a palace","He closed the markets"],"answer":0,"explain":"The masjid became the centre of the new community."}]},{"title":"Victory with Mercy","minutes":10,"hook":"You finally have power over the people who hurt you for twenty years. What do you do?","body":"Eight years after the Hijrah, the Prophet, peace be upon him, returned to Makkah with thousands of followers. The city that had tortured his companions and driven him out was now in his hands.\n\nHe entered with his head bowed in humility. He gathered the people and told them, in the words Prophet Yusuf once used: \"No blame on you today.\" Then he said: \"Go, you are free.\" Many accepted Islam because of this mercy.\n\nIn his final pilgrimage he gave a sermon to the people: every life and property is sacred, treat women well, and no one is better than another because of race or colour, only through taqwa.\n\nHe passed away in Madinah in 632, aged 63, leaving us the Qur'an and his example.","arabic":null,"translit":null,"meaning":null,"action":"Forgive one old grudge this week. Tell Allah about it and let it go.","teacher_note":"Debate: \"Is forgiving a weakness or a strength?\" Read lines from the farewell sermon and ask which one the world needs most today.","questions":[{"prompt":"What did the Prophet ﷺ do to the people of Makkah when he returned?","options":["He punished them all","He took their homes","He forgave them","He sent them away"],"answer":2,"explain":"He said: \"Go, you are free.\""},{"prompt":"According to the farewell sermon, what makes a person better than another?","options":["Wealth","Race","Taqwa (God-consciousness)","Family name"],"answer":2,"explain":"No superiority except through taqwa."},{"prompt":"How did the Prophet ﷺ enter Makkah in victory?","options":["In secret at night","With humility","With pride","In anger"],"answer":1,"explain":"He entered with his head bowed, thanking Allah."}]}]},{"title":"Understanding the Qur'an","summary":"How to reflect on the Qur'an, with Al-Fatiha and Ad-Duha as examples.","goal":"The student builds a habit of reading a short passage with its meaning and writing one reflection.","lessons":[{"title":"Tadabbur — Reading to Reflect","minutes":10,"hook":"If someone you love sent you a letter, would you read it without caring what it says?","body":"The Qur'an describes itself as a blessed book sent down \"so that they may reflect on its verses\". This reflection is called tadabbur.\n\nSome facts to know: the Qur'an has 114 surahs and is divided into 30 parts (juz). Surahs revealed in Makkah mostly build faith, hope and character; those revealed in Madinah give more guidance for community life.\n\nA simple way to reflect on any verse:\n- Read it slowly, with a translation you understand\n- Ask: what is Allah telling me about Himself?\n- Ask: what is He asking me to do or to stop?\n- Ask: what will I change today because of this?\n\nReciting earns reward for every letter. Understanding is what lets it change your life. We need both.","arabic":null,"translit":null,"meaning":null,"action":"Read three verses with their meaning tonight and write one sentence: \"Today this verse asks me to…\"","teacher_note":"Model the three questions on one verse together, then let pairs try another. Start a class reflection journal; value honesty over \"correct\" answers.","questions":[{"prompt":"What is tadabbur?","options":["Writing the Qur'an","Reflecting deeply on the Qur'an","Memorising quickly","A style of recitation"],"answer":1,"explain":"Tadabbur is thinking deeply about the verses."},{"prompt":"How many parts (juz) is the Qur'an divided into?","options":["114","7","30","99"],"answer":2,"explain":"There are 30 juz."},{"prompt":"What do surahs revealed in Makkah mostly focus on?","options":["Poetry","Trade rules only","Stories of kings only","Faith, hope and character"],"answer":3,"explain":"Makkan surahs mainly build belief and character."}]},{"title":"Al-Fatiha — A Conversation with Allah","minutes":10,"hook":"You say it at least seventeen times a day. Do you know that Allah answers each line?","body":"Al-Fatiha is called \"the Mother of the Book\". The Prophet, peace be upon him, told us that Allah says: \"I have divided the prayer between Me and My servant.\" When we say \"All praise is for Allah, Lord of the worlds\", Allah says: \"My servant has praised Me.\"\n\nThe surah moves in three steps:\n\n- Praise: we recognise who Allah is, the Lord of all, the Most Merciful, the Master of the Day of Judgement\n- Promise: \"You alone we worship, and You alone we ask for help\"\n- Request: \"Guide us to the straight path\", the path of those Allah has blessed\n\nNotice we say \"we\" and \"us\". Even alone in our room, we pray as part of one worldwide family.","arabic":"إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ","translit":"Iyyaka na'budu wa iyyaka nasta'in","meaning":"You alone we worship, and You alone we ask for help","action":"In your next prayer, pause for one breath after each verse of Al-Fatiha and remember Allah is answering.","teacher_note":"Have students map the surah into praise, promise, request. Ask what \"the straight path\" looks like in a normal school day.","questions":[{"prompt":"What is Al-Fatiha also called?","options":["The Surah of the Cave","The Last Surah","The Mother of the Book","The Longest Surah"],"answer":2,"explain":"It is Umm al-Kitab, the Mother of the Book."},{"prompt":"What do we ask for in Al-Fatiha?","options":["Guidance to the straight path","Wealth","A long holiday","Fame"],"answer":0,"explain":"Our request is: guide us to the straight path."},{"prompt":"Why does Al-Fatiha say \"we\" instead of \"I\"?","options":["Because two people always pray","To make it longer","It is a mistake","We pray as part of one community"],"answer":3,"explain":"Even alone, we stand with the whole ummah."}]},{"title":"Surah Ad-Duha — Hope on a Hard Day","minutes":10,"hook":"Have you ever felt that Allah was far away or had forgotten you?","body":"For a time, revelation stopped coming to the Prophet, peace be upon him. His enemies mocked: \"Your Lord has left you.\" He felt deeply sad. Then Surah Ad-Duha (The Morning Light) was revealed.\n\nAllah swears by the bright morning and the still night, then says: \"Your Lord has not left you, nor is He displeased.\" He promises: \"What comes after will be better for you than what came before.\"\n\nThen Allah reminds him of the past: you were an orphan and I sheltered you; you were searching and I guided you; you were in need and I provided.\n\nThe surah ends with three actions: be gentle with the orphan, never push away someone who asks, and talk about the blessings of your Lord.","arabic":null,"translit":null,"meaning":null,"action":"Write down three times Allah helped you in the past. Keep the list for the next hard day.","teacher_note":"This surah speaks directly to low moods, which are common at this age. Let students write privately. If a student shares something heavy, listen, and inform the academy lead and the parent as appropriate.","questions":[{"prompt":"Why was Surah Ad-Duha revealed?","options":["To describe Paradise","To announce a battle","To comfort the Prophet ﷺ when revelation had paused","To explain fasting"],"answer":2,"explain":"It came as comfort after a pause in revelation."},{"prompt":"What does Allah promise in this surah?","options":["What comes after will be better than what came before","Nothing will change","Life will have no tests","Everyone will be rich"],"answer":0,"explain":"The future holds better than the past."},{"prompt":"Which action does the surah end by teaching?","options":["Stay away from people","Keep blessings secret","Be gentle with the orphan","Stop asking Allah"],"answer":2,"explain":"Care for the orphan, help the one who asks, speak of Allah's blessings."}]}]},{"title":"Character in Real Life","summary":"Friends, phones and family: living good character where it is hardest.","goal":"The student identifies one real situation in each area and chooses how they will act.","lessons":[{"title":"Friends and Peer Pressure","minutes":10,"hook":"Think of your three closest friends. Are you becoming more like them, or are they becoming more like you?","body":"The Prophet, peace be upon him, said: \"A person follows the way of his close friend, so let each of you look at whom he takes as a friend.\"\n\nHe compared a good friend to a perfume seller: even if you buy nothing, you leave smelling good. A bad companion is like a blacksmith's furnace: you leave with smoke on your clothes, or burned.\n\nPeer pressure is when you do something only to fit in. Ways to stay strong:\n- Know your values before the moment comes\n- Have a simple line ready: \"No thanks, that's not for me\"\n- Find even one friend who shares your values\n- Remember that real friends respect a \"no\"\n\nBe a perfume-seller friend yourself: kind, honest, and a reason others do good.","arabic":null,"translit":null,"meaning":null,"action":"Thank a friend who makes you a better person, and be that kind of friend to someone today.","teacher_note":"Use real scenarios (cheating, teasing someone, skipping prayer on a trip). Students write their own \"ready line\". Do not ask them to name or judge specific friends aloud.","questions":[{"prompt":"What did the Prophet ﷺ compare a good friend to?","options":["A traveller","A perfume seller","A king","A blacksmith"],"answer":1,"explain":"You leave a good friend carrying a good scent."},{"prompt":"What is peer pressure?","options":["Sharing your lunch","Helping a friend study","Playing sport together","Doing something just to fit in"],"answer":3,"explain":"It is acting against your values to be accepted."},{"prompt":"What do real friends do when you say no to something wrong?","options":["They force you","They mock you","They leave forever","They respect it"],"answer":3,"explain":"True friends respect your values."}]},{"title":"My Words, Online and Offline","minutes":10,"hook":"Would you say every message you sent this week out loud, in front of your parents and the person it was about?","body":"The Prophet, peace be upon him, said: \"Whoever believes in Allah and the Last Day, let him speak good or remain silent.\" That includes what we type.\n\nThe Qur'an gives clear guidance in Surah Al-Hujurat:\n- Do not mock others; they may be better than you\n- Do not call each other hurtful names\n- Do not spy or backbite; talking about someone behind their back is compared to eating your brother's flesh\n- When news reaches you, check it before you pass it on\n\nA screen makes it easy to forget there is a human on the other side. Before you post or forward, ask three questions: Is it true? Is it kind? Is it needed? And remember that what is written stays, in more than one record.","arabic":null,"translit":null,"meaning":null,"action":"Before every message today, use the three questions: true, kind, needed.","teacher_note":"Discuss group chats, forwarding rumours and screenshots. Keep it practical and non-preachy. Make sure students know to tell a trusted adult if they are bullied or see something that worries them online.","questions":[{"prompt":"Complete the hadith: \"Let him speak good or…\"","options":["remain silent","speak quickly","speak loudly","write it down"],"answer":0,"explain":"Speak good or remain silent."},{"prompt":"What should we do when news reaches us?","options":["Add to it","Forward it at once","Post it publicly","Check it before passing it on"],"answer":3,"explain":"The Qur'an tells us to verify news first."},{"prompt":"Which three questions help before posting?","options":["Is it true, kind and needed?","Is it long, loud and new?","Is it funny, fast and popular?","Is it secret, sharp and clever?"],"answer":0,"explain":"True, kind and needed."}]},{"title":"Parents, Respect and Responsibility","minutes":10,"hook":"You want more freedom. Your parents want you safe. How do you both win?","body":"Right after commanding us to worship Him alone, Allah commands excellence toward parents. He tells us not even to say \"uff\", a sigh of annoyance, to them, but to speak to them with respect and to lower ourselves to them in mercy.\n\nA man asked the Prophet, peace be upon him: \"Who most deserves my good company?\" He said: \"Your mother.\" The man asked again, and again; the answer was \"Your mother\" three times, and then \"Your father.\"\n\nGrowing up means you will sometimes disagree. Islam does not ask you to hide your view; it asks you to share it with respect: choose a calm time, listen first, speak gently, and accept the answer gracefully.\n\nTrust is built by responsibility. The more your family can rely on you, the more freedom naturally follows.","arabic":"رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ","translit":"Rabbighfir li wa li-walidayya","meaning":"My Lord, forgive me and my parents","action":"Do one job at home today without being asked, and make this dua for your parents.","teacher_note":"Role-play a disagreement (screen time, going out) twice: once badly, once with respect. Be sensitive to different family situations in the class.","questions":[{"prompt":"What small word does the Qur'an tell us not to say to our parents?","options":["\"Yes\"","\"Salam\"","\"Please\"","\"Uff\""],"answer":3,"explain":"Not even a sigh of annoyance."},{"prompt":"In the hadith, who was mentioned three times as most deserving of good company?","options":["The friend","The mother","The teacher","The father"],"answer":1,"explain":"\"Your mother\" three times, then \"your father\"."},{"prompt":"How does Islam ask us to disagree with our parents?","options":["With respect and gentle words","By never speaking","By ignoring them","By shouting"],"answer":0,"explain":"We may share our view, respectfully."}]}]},{"title":"A Confident Muslim","summary":"Identity, answering questions about Islam, and a plan to keep growing.","goal":"The student can introduce their faith in their own words and leaves with a personal growth plan.","lessons":[{"title":"Muslim Wherever I Live","minutes":10,"hook":"Have you ever felt you had to choose between fitting in and being yourself?","body":"Allah says He made us into nations and tribes \"so that you may know one another\", and that the most honoured person with Him is the one with the most taqwa. Difference is part of His design.\n\nYou can be fully Muslim and fully part of the country you live in. Islam asks you to be the best neighbour, the most honest student and the most reliable teammate. That is how the companions carried Islam across the world: through their character.\n\nBeing confident does not mean being loud. It means you know who you are: you pray when it is time, you eat what is halal, you keep your values, and you are relaxed and kind about it.\n\nYou do not need to hide your faith, and you never need to look down on anyone else's.","arabic":null,"translit":null,"meaning":null,"action":"Do one thing openly and calmly as a Muslim this week: say Bismillah before lunch, or find a place to pray at school.","teacher_note":"Open circle: \"When is it hard to be Muslim at school?\" Solve one or two real situations together (prayer space, food, Ramadan and sport). Aim for calm confidence, never an \"us against them\" attitude.","questions":[{"prompt":"Why did Allah make people into different nations and tribes?","options":["So that we may know one another","So that we compete in wealth","So that we stay apart","For no reason"],"answer":0,"explain":"Difference is for knowing one another (49:13)."},{"prompt":"Who is the most honoured person with Allah?","options":["The one with the most taqwa","The most famous","The strongest","The richest"],"answer":0,"explain":"Honour with Allah is by taqwa alone."},{"prompt":"What does real confidence as a Muslim look like?","options":["Arguing with everyone","Looking down on others","Knowing who you are and being kind about it","Hiding your faith"],"answer":2,"explain":"Calm, kind and clear about your values."}]},{"title":"Answering Questions About Islam","minutes":10,"hook":"\"Why don't you eat that?\" \"Why do you pray so much?\" What do you say?","body":"Questions are usually curiosity, not attack. The Qur'an tells us how to respond: \"Invite to the way of your Lord with wisdom and good words, and discuss with them in the best manner.\"\n\nSome tips:\n- Smile and thank them for asking\n- Keep it short and personal: \"I pray because it keeps me close to God and calm in my day\"\n- It is fine to say \"I'm not sure, let me find out\"\n- Never mock another belief and never argue to win\n- If someone is rude, stay polite and walk away; your manners are your best answer\n\nThree answers worth having ready: Muslims believe in one God, the same God of Ibrahim, Musa and Isa; Muhammad is His final messenger; and Islam teaches us to worship God and do good to people.","arabic":null,"translit":null,"meaning":null,"action":"Write your own two-sentence answer to: \"What is Islam?\" Practise saying it to a family member.","teacher_note":"Collect real questions students have been asked and practise answers in pairs. Reward gentle, honest answers over clever ones. Remind them that not knowing is normal and that you are there to help.","questions":[{"prompt":"How does the Qur'an tell us to invite others?","options":["By arguing loudly","By force","With wisdom and good words","By ignoring them"],"answer":2,"explain":"With wisdom and beautiful teaching (16:125)."},{"prompt":"What is a good thing to say when you do not know an answer?","options":["\"I'm not sure, let me find out\"","Make something up","Change the subject angrily","Laugh at the question"],"answer":0,"explain":"Honesty is better than guessing."},{"prompt":"What is your best answer to a rude person?","options":["A long argument","Rudeness back","Insults","Good manners"],"answer":3,"explain":"Staying polite speaks loudest."}]},{"title":"Tawbah, Dua and My Growth Plan","minutes":10,"hook":"What would you do differently if every mistake could truly be wiped clean?","body":"Nobody is perfect. The Prophet, peace be upon him, said that every child of Adam makes mistakes, and the best of those who make mistakes are the ones who repent.\n\nTawbah, returning to Allah, has simple steps: stop the wrong, feel sorry, intend not to go back, and if you harmed someone, put it right. Allah says: \"Do not despair of the mercy of Allah. Indeed, Allah forgives all sins.\"\n\nDua is your direct line. Allah says: \"I am near. I answer the call of the caller when he calls on Me.\" No appointment, no special language.\n\nNow build your plan. Choose one small thing in each area and keep it going:\n- With Allah: for example, never miss Fajr\n- With the Qur'an: five minutes a day\n- With people: one act of kindness daily\n\nSmall and steady is most loved by Allah.","arabic":"أَسْتَغْفِرُ اللهَ","translit":"Astaghfirullah","meaning":"I ask Allah for forgiveness","action":"Write your three-line growth plan and put it where you will see it every morning.","teacher_note":"End the level with hope. Students write their plan privately and share only if they wish. Record a note of encouragement for each student in the portal so parents can read it.","questions":[{"prompt":"What does tawbah mean?","options":["Returning to Allah in repentance","Giving charity","Fasting","Travelling"],"answer":0,"explain":"Tawbah is turning back to Allah."},{"prompt":"Which of these is a step of tawbah?","options":["Blaming someone else","Waiting until you are old","Hiding the mistake","Stopping the wrong and feeling sorry"],"answer":3,"explain":"Stop, regret, resolve, and put things right."},{"prompt":"Which deeds are most loved by Allah?","options":["Small and steady ones","Only public ones","Only difficult ones","Huge ones done once"],"answer":0,"explain":"Consistent deeds, even if small."}]}]}]}]$ilm$::jsonb;
  lv jsonb; un jsonb; le jsonb; qu jsonb; v_unit int; v_lesson int; ui int; li int; qi int;
begin
  if exists (select 1 from ilm_levels) then return; end if;
  for lv in select * from jsonb_array_elements(d) loop
    insert into ilm_levels(id, code, name, arabic, age_min, age_max, tagline, about, psychology)
    values ((lv->>'id')::int, lv->>'code', lv->>'name', lv->>'arabic', (lv->>'age_min')::int,
            (lv->>'age_max')::int, lv->>'tagline', lv->>'about', lv->>'psychology');
    ui := 0;
    for un in select * from jsonb_array_elements(lv->'units') loop
      ui := ui + 1;
      insert into ilm_units(level_id, sort, title, summary, goal)
      values ((lv->>'id')::int, ui, un->>'title', un->>'summary', un->>'goal') returning id into v_unit;
      li := 0;
      for le in select * from jsonb_array_elements(un->'lessons') loop
        li := li + 1;
        insert into ilm_lessons(unit_id, sort, title, minutes, hook, body, arabic, translit, meaning, action, teacher_note)
        values (v_unit, li, le->>'title', (le->>'minutes')::int, le->>'hook', le->>'body', le->>'arabic',
                le->>'translit', le->>'meaning', le->>'action', le->>'teacher_note') returning id into v_lesson;
        qi := 0;
        for qu in select * from jsonb_array_elements(le->'questions') loop
          qi := qi + 1;
          insert into ilm_questions(lesson_id, sort, prompt, options, answer, explain)
          values (v_lesson, qi, qu->>'prompt', qu->'options', (qu->>'answer')::int, qu->>'explain');
        end loop;
      end loop;
    end loop;
  end loop;
end $seed$;

-- Done. You should see: Success. No rows returned.
