-- RenderCrZ: papelera de proyectos (migración crz_papelera_proyectos, ya aplicada).
-- Eliminar ya no borra: marca eliminado_en y el proyecto se puede restaurar durante
-- 30 días. Se aplica después de crz_proyectos.sql y solo toca objetos crz_.

alter table public.crz_proyectos add column eliminado_en timestamptz;

create or replace function public.crz_listar_proyectos(p_token text)
returns table (id text, nombre text, share_id text, bytes integer, meta jsonb, cliente_ms bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  return query
    select p.id, p.nombre, p.share_id, p.bytes, p.meta, p.cliente_ms
    from public.crz_proyectos p
    where p.eliminado_en is null
    order by p.actualizado_en desc;
end;
$$;

create or replace function public.crz_obtener_proyecto(p_token text, p_id text)
returns text language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  return (select p.datos from public.crz_proyectos p where p.id = p_id and p.eliminado_en is null);
end;
$$;

-- Guardar un proyecto que estaba en la papelera lo saca de ella.
create or replace function public.crz_guardar_proyecto(p_token text, p_id text, p_nombre text, p_datos text, p_meta jsonb, p_cliente_ms bigint)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_share text;
begin
  perform public.crz_sesion_valida(p_token);
  if not exists (select 1 from public.crz_proyectos p where p.id = p_id)
     and (select count(*) from public.crz_proyectos p where p.eliminado_en is null) >= 500 then
    raise exception 'CRZ_LIMITE' using errcode = 'P0001';
  end if;
  insert into public.crz_proyectos (id, nombre, datos, meta, cliente_ms, share_id)
  values (p_id, left(p_nombre, 120), p_datos, coalesce(p_meta, '{}'::jsonb), p_cliente_ms,
          translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'))
  on conflict (id) do update
    set nombre = excluded.nombre, datos = excluded.datos, meta = excluded.meta,
        cliente_ms = excluded.cliente_ms, actualizado_en = now(), eliminado_en = null
  returning share_id into v_share;
  return v_share;
end;
$$;

-- Manda el proyecto a la papelera y vacía lo que lleva más de 30 días en ella.
create or replace function public.crz_eliminar_proyecto(p_token text, p_id text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  update public.crz_proyectos p set eliminado_en = now() where p.id = p_id and p.eliminado_en is null;
  delete from public.crz_proyectos p where p.eliminado_en < now() - interval '30 days';
end;
$$;

create function public.crz_listar_papelera(p_token text)
returns table (id text, nombre text, bytes integer, eliminado_ms bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  return query
    select p.id, p.nombre, p.bytes, (extract(epoch from p.eliminado_en) * 1000)::bigint
    from public.crz_proyectos p
    where p.eliminado_en >= now() - interval '30 days'
    order by p.eliminado_en desc;
end;
$$;

create function public.crz_restaurar_proyecto(p_token text, p_id text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  update public.crz_proyectos p set eliminado_en = null, actualizado_en = now() where p.id = p_id;
end;
$$;

-- La liga pública deja de funcionar mientras el proyecto está en la papelera.
create or replace function public.crz_proyecto_compartido(p_share text)
returns table (nombre text, datos text)
language sql stable security definer set search_path to '' as $$
  select p.nombre, p.datos from public.crz_proyectos p where p.share_id = p_share and p.eliminado_en is null;
$$;

revoke execute on function public.crz_listar_papelera(text), public.crz_restaurar_proyecto(text, text) from public, anon, authenticated;
grant execute on function public.crz_listar_papelera(text), public.crz_restaurar_proyecto(text, text) to anon, authenticated;
