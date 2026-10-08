-- RenderCrZ: proyectos en la nube y ligas para compartir.
-- Ya aplicado en el proyecto Supabase gk-control-operativo-entregas (migración
-- crz_proyectos_nube_y_compartir). Solo crea objetos nuevos con prefijo crz_.

create table public.crz_sesiones (
  token_hash text primary key,
  expira_en timestamptz not null
);

create table public.crz_proyectos (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{4,40}$'),
  nombre text not null check (char_length(nombre) between 1 and 120),
  datos text not null check (octet_length(datos) <= 600000),
  bytes integer generated always as (octet_length(datos)) stored,
  meta jsonb not null default '{}'::jsonb,
  share_id text not null unique,
  cliente_ms bigint not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Sin políticas: las tablas no se leen desde la API, solo mediante las funciones de abajo.
alter table public.crz_sesiones enable row level security;
alter table public.crz_proyectos enable row level security;
revoke all on public.crz_sesiones, public.crz_proyectos from anon, authenticated;

create function public.crz_iniciar_sesion(p_password text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_token text;
begin
  if not public.crz_verificar_acceso(p_password) then
    return null;
  end if;
  delete from public.crz_sesiones where expira_en < now();
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.crz_sesiones (token_hash, expira_en)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '12 hours');
  return v_token;
end;
$$;

create function public.crz_sesion_valida(p_token text)
returns void language plpgsql stable security definer set search_path to '' as $$
begin
  if p_token is null or not exists (
    select 1 from public.crz_sesiones s
    where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and s.expira_en > now()
  ) then
    raise exception 'CRZ_SESION' using errcode = '28000';
  end if;
end;
$$;

create function public.crz_listar_proyectos(p_token text)
returns table (id text, nombre text, share_id text, bytes integer, meta jsonb, cliente_ms bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  return query
    select p.id, p.nombre, p.share_id, p.bytes, p.meta, p.cliente_ms
    from public.crz_proyectos p
    order by p.actualizado_en desc;
end;
$$;

create function public.crz_obtener_proyecto(p_token text, p_id text)
returns text language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  return (select p.datos from public.crz_proyectos p where p.id = p_id);
end;
$$;

create function public.crz_guardar_proyecto(p_token text, p_id text, p_nombre text, p_datos text, p_meta jsonb, p_cliente_ms bigint)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_share text;
begin
  perform public.crz_sesion_valida(p_token);
  if not exists (select 1 from public.crz_proyectos p where p.id = p_id)
     and (select count(*) from public.crz_proyectos) >= 500 then
    raise exception 'CRZ_LIMITE' using errcode = 'P0001';
  end if;
  insert into public.crz_proyectos (id, nombre, datos, meta, cliente_ms, share_id)
  values (p_id, left(p_nombre, 120), p_datos, coalesce(p_meta, '{}'::jsonb), p_cliente_ms,
          translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'))
  on conflict (id) do update
    set nombre = excluded.nombre, datos = excluded.datos, meta = excluded.meta,
        cliente_ms = excluded.cliente_ms, actualizado_en = now()
  returning share_id into v_share;
  return v_share;
end;
$$;

create function public.crz_eliminar_proyecto(p_token text, p_id text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform public.crz_sesion_valida(p_token);
  delete from public.crz_proyectos p where p.id = p_id;
end;
$$;

-- Liga pública: sin contraseña, solo lectura del proyecto cuyo share_id se conoce.
create function public.crz_proyecto_compartido(p_share text)
returns table (nombre text, datos text)
language sql stable security definer set search_path to '' as $$
  select p.nombre, p.datos from public.crz_proyectos p where p.share_id = p_share;
$$;

revoke execute on function
  public.crz_iniciar_sesion(text), public.crz_sesion_valida(text), public.crz_listar_proyectos(text),
  public.crz_obtener_proyecto(text, text), public.crz_guardar_proyecto(text, text, text, text, jsonb, bigint),
  public.crz_eliminar_proyecto(text, text), public.crz_proyecto_compartido(text)
from public, anon, authenticated;

grant execute on function
  public.crz_iniciar_sesion(text), public.crz_listar_proyectos(text),
  public.crz_obtener_proyecto(text, text), public.crz_guardar_proyecto(text, text, text, text, jsonb, bigint),
  public.crz_eliminar_proyecto(text, text), public.crz_proyecto_compartido(text)
to anon, authenticated;
