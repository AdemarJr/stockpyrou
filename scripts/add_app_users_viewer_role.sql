-- Permite perfil visualizacao (DB: viewer) em app_users.role
-- Antes: CHECK só aceitava super_admin | admin | manager | user

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'super_admin'::text,
        'admin'::text,
        'manager'::text,
        'user'::text,
        'viewer'::text
      ]
    )
  );

-- Migra valores legados gravados como 'visualizacao' (se existirem)
UPDATE public.app_users
SET role = 'viewer', updated_at = now()
WHERE role = 'visualizacao';
