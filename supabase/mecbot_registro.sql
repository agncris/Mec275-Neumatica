-- Registro de MecBot (ver api/registro.js). Se corre una vez en el proyecto de Supabase.
-- Lo que se guarda y lo que no está descrito en el aviso de privacidad de src/components/MecBot.tsx.

create table if not exists public.mecbot_registro (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  unidad text check (unidad in ('neumatica', 'plc', 'cnc', 'robotica')),
  conversacion text check (conversacion ~ '^[a-z0-9]{8,32}$'),
  pregunta text not null check (length(pregunta) <= 2000),
  respuesta text not null check (length(respuesta) <= 8000)
);
create index if not exists mecbot_registro_fecha on public.mecbot_registro (fecha);

-- La clave publicable (la que usa Vercel) solo puede insertar. Nadie puede leer con ella.
alter table public.mecbot_registro enable row level security;
drop policy if exists "MecBot inserta" on public.mecbot_registro;
create policy "MecBot inserta" on public.mecbot_registro for insert to anon with check (true);
revoke select, update, delete on public.mecbot_registro from anon, authenticated;

-- Contraseña del respaldo: vive en un esquema que la API no expone.
create schema if not exists privado;
revoke all on schema privado from anon, authenticated;
create table if not exists privado.ajustes (nombre text primary key, valor text not null);

-- Respaldo: devuelve las filas desde una fecha si la contraseña calza. La usa scripts/respaldo-mecbot.mjs.
create or replace function public.mecbot_respaldo(clave text, desde timestamptz default '1970-01-01')
returns setof public.mecbot_registro
language plpgsql security definer set search_path = '' as $$
begin
  if clave is null or clave <> (select valor from privado.ajustes where nombre = 'respaldo') then
    raise exception 'clave de respaldo inválida';
  end if;
  return query select * from public.mecbot_registro r where r.fecha >= desde order by r.fecha;
end $$;
revoke all on function public.mecbot_respaldo(text, timestamptz) from public;
grant execute on function public.mecbot_respaldo(text, timestamptz) to anon;
revoke execute on function public.mecbot_respaldo(text, timestamptz) from authenticated;

-- Se borra a los 2 años, como dice el aviso. Corre cada día a las 4:00 UTC.
create extension if not exists pg_cron;
select cron.schedule('mecbot-borrar-2-anios', '0 4 * * *', $$delete from public.mecbot_registro where fecha < now() - interval '2 years'$$);

-- La contraseña del respaldo se pone aparte, sin subirla al repo:
-- insert into privado.ajustes values ('respaldo', '<contraseña larga>') on conflict (nombre) do update set valor = excluded.valor;
