CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.project_role_of(_project_id UUID, _user_id UUID)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id)
      THEN 'admin'::public.project_role
    ELSE (SELECT role FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id)
  END
$$;

CREATE OR REPLACE FUNCTION private.can_edit_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
  SELECT private.project_role_of(_project_id, _user_id) IN ('admin','author','remediator')
$$;

CREATE OR REPLACE FUNCTION private.shares_project_with(_other_user UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members a
    JOIN public.project_members b ON a.project_id = b.project_id
    WHERE a.user_id = _other_user AND b.user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION private.is_project_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.project_role_of(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_edit_project(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_project_with(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_project_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.project_role_of(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_edit_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_project_with(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, pg_temp AS $$
  SELECT private.is_project_member(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.project_role_of(_project_id UUID, _user_id UUID)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, pg_temp AS $$
  SELECT private.project_role_of(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, pg_temp AS $$
  SELECT private.can_edit_project(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.shares_project_with(_other_user UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, pg_temp AS $$
  SELECT private.shares_project_with(_other_user, _user_id)
$$;