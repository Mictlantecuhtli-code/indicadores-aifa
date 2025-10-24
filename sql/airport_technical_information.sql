-- Tablas para la ficha técnica del Aeropuerto Internacional Felipe Ángeles (AIFA)

create table if not exists public.airport_technical_sections (
  id bigserial primary key,
  section_key text not null unique,
  title text not null,
  description text,
  content jsonb not null default '[]'::jsonb,
  display_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.airport_routes (
  id bigserial primary key,
  route_code text,
  nombre text not null,
  destino text not null,
  pais text,
  tipo_vuelo text,
  distancia_km numeric,
  tiempo_estimado text,
  frecuencia_base text,
  descripcion text,
  notas text,
  airlines jsonb not null default '[]'::jsonb,
  display_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_airport_sections_updated_at on public.airport_technical_sections;
create trigger set_airport_sections_updated_at
before update on public.airport_technical_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_airport_routes_updated_at on public.airport_routes;
create trigger set_airport_routes_updated_at
before update on public.airport_routes
for each row execute function public.set_updated_at();

create unique index if not exists airport_technical_sections_section_key_idx
  on public.airport_technical_sections(section_key);

create index if not exists airport_technical_sections_display_order_idx
  on public.airport_technical_sections(display_order nulls last);

create index if not exists airport_routes_display_order_idx
  on public.airport_routes(display_order nulls last);

create index if not exists airport_routes_route_code_idx
  on public.airport_routes(coalesce(route_code, ''));

insert into public.airport_technical_sections (section_key, title, description, content, display_order)
values
  ('general', 'Datos generales del aeropuerto', '', '[]'::jsonb, 1),
  ('operacion', 'Operación y capacidades', '', '[]'::jsonb, 2),
  ('infraestructura', 'Infraestructura aeroportuaria', '', '[]'::jsonb, 3),
  ('servicios', 'Servicios y facilidades', '', '[]'::jsonb, 4),
  ('navegacion', 'Ayudas a la navegación', '', '[]'::jsonb, 5),
  ('visual_aids', 'Ayudas visuales y señalización', '', '[]'::jsonb, 6),
  ('mapa', 'Plano del aeropuerto', '', '[]'::jsonb, 7)
on conflict (section_key) do nothing;
