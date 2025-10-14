-- Controles de validación y bitácora para mediciones operativas

-- 1. Columnas de control en la tabla principal
alter table if exists public.mediciones
  add column if not exists capturado_por uuid references public.perfiles(id),
  add column if not exists editado_por uuid references public.perfiles(id),
  add column if not exists validado_por uuid references public.perfiles(id),
  add column if not exists fecha_captura timestamptz not null default now(),
  add column if not exists fecha_ultima_edicion timestamptz not null default now(),
  add column if not exists fecha_validacion timestamptz,
  add column if not exists estatus_validacion text not null default 'PENDIENTE' check (upper(estatus_validacion) in ('PENDIENTE','VALIDADO','RECHAZADO')),
  add column if not exists observaciones_validacion text;

-- 2. Trigger para mantener consistencia en fechas y estatus
create or replace function public.fn_set_mediciones_metadata()
returns trigger as
$$
begin
    if tg_op = 'INSERT' and new.fecha_captura is null then
        new.fecha_captura := now();
    end if;

    new.estatus_validacion := upper(coalesce(new.estatus_validacion, 'PENDIENTE'));
    new.fecha_ultima_edicion := now();

    if new.estatus_validacion <> 'VALIDADO' then
        new.fecha_validacion := null;
        new.validado_por := null;
    elsif new.fecha_validacion is null then
        new.fecha_validacion := now();
    end if;

    if new.observaciones_validacion is not null and btrim(new.observaciones_validacion) = '' then
        new.observaciones_validacion := null;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_mediciones on public.mediciones;
create trigger set_timestamp_mediciones
    before insert or update on public.mediciones
    for each row
    execute function public.fn_set_mediciones_metadata();

-- 3. Bitácora de cambios de mediciones
create table if not exists public.mediciones_bitacora (
    id uuid primary key default gen_random_uuid(),
    medicion_id uuid not null references public.mediciones(id) on delete cascade,
    accion text not null,
    detalle jsonb,
    realizado_por uuid references public.perfiles(id),
    realizado_en timestamptz not null default now()
);

create index if not exists mediciones_bitacora_medicion_idx on public.mediciones_bitacora (medicion_id);
create index if not exists mediciones_bitacora_realizado_en_idx on public.mediciones_bitacora (realizado_en desc);

-- 4. Trigger de auditoría para capturar inserciones y actualizaciones
create or replace function public.fn_log_mediciones_historial()
returns trigger as
$$
declare
    detalle jsonb;
    actor uuid;
begin
    if tg_op = 'INSERT' then
        actor := new.capturado_por;
        detalle := jsonb_build_object('nuevo', to_jsonb(new));
    elsif tg_op = 'UPDATE' then
        actor := coalesce(new.editado_por, new.validado_por);
        detalle := jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new));
    else
        return new;
    end if;

    insert into public.mediciones_bitacora (medicion_id, accion, detalle, realizado_por)
    values (new.id, tg_op, detalle, actor);

    return new;
end;
$$ language plpgsql;

drop trigger if exists log_mediciones_history on public.mediciones;
create trigger log_mediciones_history
    after insert or update on public.mediciones
    for each row
    execute function public.fn_log_mediciones_historial();
