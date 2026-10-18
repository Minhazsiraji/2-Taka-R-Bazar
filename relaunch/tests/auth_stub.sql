-- Local Postgres only: minimal Supabase identity emulation.
create extension if not exists pgcrypto;
create schema auth;
create table auth.users(id uuid primary key);
create role anon nologin;
create role authenticated nologin;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
