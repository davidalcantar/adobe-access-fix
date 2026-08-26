GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_role_of(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_project_with(UUID, UUID) TO authenticated;