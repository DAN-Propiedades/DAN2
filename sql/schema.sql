-- =========================================================
-- DAN Propiedades — esquema de base de datos
-- Pega TODO este archivo en Supabase → SQL Editor → New query
-- y presiona "Run". Es seguro ejecutarlo varias veces (por ejemplo,
-- para aplicar una actualización sobre un proyecto que ya tenías).
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- Tabla de propiedades ----------
create table if not exists propiedades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null check (tipo in ('Casa','Departamento','Parcela','Oficina','Local Comercial','Terreno')),
  comuna text not null,
  direccion text,
  terreno_m2 numeric,
  superficie_construida_m2 numeric,
  dormitorios integer,
  banos integer,
  precio_uf numeric not null,
  descripcion text,
  fotos text[] default '{}',
  portada text,
  destacada boolean default false,
  publicada boolean default true,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- Columnas nuevas (sitio rediseñado): región, estacionamientos y
-- características. `add column if not exists` no borra nada si ya existían.
alter table propiedades add column if not exists region text;
alter table propiedades add column if not exists estacionamientos integer;
alter table propiedades add column if not exists caracteristicas text[] default '{}';

-- ---------- Tabla de mensajes de contacto ----------
create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  correo text,
  mensaje text not null,
  leido boolean default false,
  creado_en timestamptz default now()
);

-- ---------- Administración de autoservicio ----------
-- La primera persona que hace clic en "Crear la cuenta de administrador"
-- en admin.html queda registrada aquí y se vuelve la única administradora
-- del sitio. Nadie puede leer ni escribir esta tabla directamente (no
-- tiene políticas RLS): solo las funciones de abajo, que corren con
-- permisos elevados (security definer).
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz default now()
);
alter table admins enable row level security;

create or replace function admin_exists()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from admins);
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from admins where user_id = auth.uid());
$$;

create or replace function claim_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if exists(select 1 from admins) then
    return false;
  end if;
  insert into admins(user_id) values (auth.uid());
  return true;
end;
$$;

grant execute on function admin_exists() to anon, authenticated;
grant execute on function is_admin() to anon, authenticated;
grant execute on function claim_admin() to authenticated;

-- ---------- Seguridad a nivel de fila (RLS) ----------
alter table propiedades enable row level security;
alter table mensajes enable row level security;

-- Cualquier visitante (sin iniciar sesión) puede LEER solo propiedades publicadas
drop policy if exists "lectura publica propiedades publicadas" on propiedades;
create policy "lectura publica propiedades publicadas"
on propiedades for select
to anon
using (publicada = true);

-- Solo la cuenta de administrador (is_admin()) ve y gestiona TODAS las propiedades.
-- Nota: reemplaza las políticas antiguas "to authenticated using (true)", que
-- daban acceso total a cualquier cuenta autenticada. Con el autoservicio,
-- cualquiera puede crear una cuenta, así que la comprobación real es is_admin().
drop policy if exists "admin lee todo" on propiedades;
create policy "admin lee todo"
on propiedades for select
to authenticated
using (is_admin());

drop policy if exists "admin inserta propiedades" on propiedades;
create policy "admin inserta propiedades"
on propiedades for insert
to authenticated
with check (is_admin());

drop policy if exists "admin actualiza propiedades" on propiedades;
create policy "admin actualiza propiedades"
on propiedades for update
to authenticated
using (is_admin());

drop policy if exists "admin elimina propiedades" on propiedades;
create policy "admin elimina propiedades"
on propiedades for delete
to authenticated
using (is_admin());

-- Cualquier visitante puede ENVIAR un mensaje de contacto
drop policy if exists "cualquiera envia mensajes" on mensajes;
create policy "cualquiera envia mensajes"
on mensajes for insert
to anon
with check (true);

-- Solo la administradora puede leer y gestionar los mensajes
drop policy if exists "admin lee mensajes" on mensajes;
create policy "admin lee mensajes"
on mensajes for select
to authenticated
using (is_admin());

drop policy if exists "admin actualiza mensajes" on mensajes;
create policy "admin actualiza mensajes"
on mensajes for update
to authenticated
using (is_admin());

drop policy if exists "admin elimina mensajes" on mensajes;
create policy "admin elimina mensajes"
on mensajes for delete
to authenticated
using (is_admin());

-- ---------- Storage: bucket público para fotos de propiedades ----------
insert into storage.buckets (id, name, public)
values ('fotos-propiedades', 'fotos-propiedades', true)
on conflict (id) do nothing;

drop policy if exists "lectura publica de fotos" on storage.objects;
create policy "lectura publica de fotos"
on storage.objects for select
to public
using (bucket_id = 'fotos-propiedades');

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fotos-propiedades' and is_admin());

drop policy if exists "admin actualiza fotos" on storage.objects;
create policy "admin actualiza fotos"
on storage.objects for update
to authenticated
using (bucket_id = 'fotos-propiedades' and is_admin());

drop policy if exists "admin elimina fotos" on storage.objects;
create policy "admin elimina fotos"
on storage.objects for delete
to authenticated
using (bucket_id = 'fotos-propiedades' and is_admin());
