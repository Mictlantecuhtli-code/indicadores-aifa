-- Ajustes de base de datos para metas por escenario

-- 1. Crear tabla de metas mensuales por escenario
create table if not exists public.indicador_metas (
    id uuid primary key default gen_random_uuid(),
    indicador_id uuid not null references public.indicadores(id) on delete cascade,
    anio integer not null check (anio >= 2000),
    mes smallint not null check (mes between 1 and 12),
    escenario text not null check (upper(escenario) in ('BAJO','MEDIO','ALTO')),
    valor numeric(18,2) not null check (valor >= 0),
    observaciones text,
    capturado_por uuid references public.perfiles(id),
    editado_por uuid references public.perfiles(id),
    fecha_captura timestamptz not null default now(),
    fecha_ultima_edicion timestamptz not null default now(),
    constraint indicador_metas_indicador_anio_mes_escenario_key unique (indicador_id, anio, mes, upper(escenario))
);

-- 2. Índices de apoyo para consultas frecuentes
create index if not exists indicador_metas_indicador_idx on public.indicador_metas (indicador_id);
create index if not exists indicador_metas_anio_mes_idx on public.indicador_metas (anio, mes);
create index if not exists indicador_metas_escenario_idx on public.indicador_metas (upper(escenario));

-- 3. Trigger para mantener fecha_ultima_edicion actualizada
create or replace function public.fn_set_indicador_metas_updated_at()
returns trigger as
$$
begin
    new.fecha_ultima_edicion := now();
    return new;
end;
$$ language plpgsql;

create trigger set_timestamp_indicador_metas
    before update on public.indicador_metas
    for each row
    execute function public.fn_set_indicador_metas_updated_at();
