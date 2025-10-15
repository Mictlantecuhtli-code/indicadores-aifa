-- Tablas para administrar la información técnica del aeropuerto

-- 1. Información general por categoría
create table if not exists public.aeropuerto_informacion_general (
    id uuid primary key default gen_random_uuid(),
    categoria text not null,
    etiqueta text not null,
    valor text,
    unidad text,
    descripcion text,
    orden integer default 0,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint aeropuerto_informacion_general_categoria_etiqueta_key unique (categoria, etiqueta)
);

create index if not exists aeropuerto_informacion_general_categoria_idx
    on public.aeropuerto_informacion_general (lower(categoria));

create index if not exists aeropuerto_informacion_general_orden_idx
    on public.aeropuerto_informacion_general (orden);

-- 2. Métricas de capacidad del aeropuerto
create table if not exists public.aeropuerto_metricas_capacidad (
    id uuid primary key default gen_random_uuid(),
    categoria text not null,
    nombre text not null,
    valor text,
    unidad text,
    periodo text,
    descripcion text,
    orden integer default 0,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create index if not exists aeropuerto_metricas_capacidad_categoria_idx
    on public.aeropuerto_metricas_capacidad (lower(categoria));

create index if not exists aeropuerto_metricas_capacidad_orden_idx
    on public.aeropuerto_metricas_capacidad (orden);

-- 3. Rutas aéreas comerciales
create table if not exists public.aeropuerto_rutas_aereas (
    id uuid primary key default gen_random_uuid(),
    origen text not null default 'AIFA',
    destino text not null,
    descripcion text,
    frecuencia text,
    distancia_km numeric(10,2) check (distancia_km is null or distancia_km >= 0),
    tiempo_minutos integer check (tiempo_minutos is null or tiempo_minutos >= 0),
    tipo_operacion text,
    notas text,
    orden integer default 0,
    habilitada boolean not null default true,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create index if not exists aeropuerto_rutas_aereas_destino_idx
    on public.aeropuerto_rutas_aereas (lower(destino));

create index if not exists aeropuerto_rutas_aereas_orden_idx
    on public.aeropuerto_rutas_aereas (orden);

-- 4. Aerolíneas por ruta aérea
create table if not exists public.aeropuerto_ruta_aerolineas (
    id uuid primary key default gen_random_uuid(),
    ruta_id uuid not null references public.aeropuerto_rutas_aereas(id) on delete cascade,
    aerolinea text not null,
    frecuencia text,
    observaciones text,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create index if not exists aeropuerto_ruta_aerolineas_ruta_idx
    on public.aeropuerto_ruta_aerolineas (ruta_id);

-- 5. Ayudas a la navegación e infraestructura técnica
create table if not exists public.aeropuerto_ayudas_navegacion (
    id uuid primary key default gen_random_uuid(),
    codigo text,
    nombre text not null,
    tipo text,
    ubicacion text,
    caracteristicas text,
    observaciones text,
    orden integer default 0,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create index if not exists aeropuerto_ayudas_navegacion_orden_idx
    on public.aeropuerto_ayudas_navegacion (orden);

-- 6. Función y triggers para mantener actualizado el campo actualizado_en
create or replace function public.fn_touch_actualizado_en()
returns trigger as
$$
begin
    new.actualizado_en := now();
    return new;
end;
$$ language plpgsql;

create trigger set_actualizado_en_informacion_general
    before update on public.aeropuerto_informacion_general
    for each row execute function public.fn_touch_actualizado_en();

create trigger set_actualizado_en_metricas_capacidad
    before update on public.aeropuerto_metricas_capacidad
    for each row execute function public.fn_touch_actualizado_en();

create trigger set_actualizado_en_rutas_aereas
    before update on public.aeropuerto_rutas_aereas
    for each row execute function public.fn_touch_actualizado_en();

create trigger set_actualizado_en_ruta_aerolineas
    before update on public.aeropuerto_ruta_aerolineas
    for each row execute function public.fn_touch_actualizado_en();

create trigger set_actualizado_en_ayudas_navegacion
    before update on public.aeropuerto_ayudas_navegacion
    for each row execute function public.fn_touch_actualizado_en();
