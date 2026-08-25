-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.project_role AS ENUM ('admin','author','remediator','reviewer');
CREATE TYPE public.conformance_level AS ENUM ('A','AA','AAA');
CREATE TYPE public.doc_status AS ENUM ('uploaded','auditing','remediating','in_review','approved','rejected');
CREATE TYPE public.issue_state AS ENUM ('open','fixed','waived');
CREATE TYPE public.issue_severity AS ENUM ('critical','serious','moderate','minor');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- APP ROLES (separate table, never on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'author',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- MEMBERSHIP HELPERS (security definer -> no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.project_role_of(_project_id UUID, _user_id UUID)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id)
      THEN 'admin'::public.project_role
    ELSE (SELECT role FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id)
  END
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_role_of(_project_id, _user_id) IN ('admin','author','remediator')
$$;

CREATE OR REPLACE FUNCTION public.shares_project_with(_other_user UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members a
    JOIN public.project_members b ON a.project_id = b.project_id
    WHERE a.user_id = _other_user AND b.user_id = _user_id
  )
$$;

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  byte_size BIGINT NOT NULL DEFAULT 0,
  target_level public.conformance_level NOT NULL DEFAULT 'AA',
  status public.doc_status NOT NULL DEFAULT 'uploaded',
  conformance_score INTEGER NOT NULL DEFAULT 0,
  doc_title TEXT,
  doc_language TEXT DEFAULT 'en',
  is_tagged BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  approved_by UUID REFERENCES auth.users ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  last_audit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_structure (
  document_id UUID PRIMARY KEY REFERENCES public.documents ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  tree JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_structure TO authenticated;
GRANT ALL ON public.document_structure TO service_role;
ALTER TABLE public.document_structure ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  criterion TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  level public.conformance_level NOT NULL,
  severity public.issue_severity NOT NULL DEFAULT 'serious',
  title TEXT NOT NULL,
  detail TEXT,
  page_number INTEGER,
  element_ref TEXT,
  state public.issue_state NOT NULL DEFAULT 'open',
  waiver_reason TEXT,
  resolved_by UUID REFERENCES auth.users ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_issues TO authenticated;
GRANT ALL ON public.document_issues TO service_role;
ALTER TABLE public.document_issues ENABLE ROW LEVEL SECURITY;
CREATE INDEX document_issues_doc_idx ON public.document_issues (document_id);

CREATE TABLE public.structure_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  element_ref TEXT,
  edit_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  ai_assisted BOOLEAN NOT NULL DEFAULT false,
  edited_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.structure_edits TO authenticated;
GRANT ALL ON public.structure_edits TO service_role;
ALTER TABLE public.structure_edits ENABLE ROW LEVEL SECURITY;
CREATE INDEX structure_edits_doc_idx ON public.structure_edits (document_id, created_at DESC);

CREATE TABLE public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  issue_id UUID REFERENCES public.document_issues ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_comments TO authenticated;
GRANT ALL ON public.document_comments TO service_role;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  label TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  conformance_score INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_project_with(id, auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "member projects read" ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "create own project" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates project" ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner deletes project" ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "members read members" ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_project_member(project_id, auth.uid()));
CREATE POLICY "admins add members" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.project_role_of(project_id, auth.uid()) = 'admin');
CREATE POLICY "admins update members" ON public.project_members FOR UPDATE TO authenticated
  USING (public.project_role_of(project_id, auth.uid()) = 'admin')
  WITH CHECK (public.project_role_of(project_id, auth.uid()) = 'admin');
CREATE POLICY "admins remove members" ON public.project_members FOR DELETE TO authenticated
  USING (public.project_role_of(project_id, auth.uid()) = 'admin');

CREATE POLICY "members read documents" ON public.documents FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors add documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "members update documents" ON public.documents FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors delete documents" ON public.documents FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "members read structure" ON public.document_structure FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors write structure" ON public.document_structure FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "editors update structure" ON public.document_structure FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "editors delete structure" ON public.document_structure FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "members read issues" ON public.document_issues FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors add issues" ON public.document_issues FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members update issues" ON public.document_issues FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors delete issues" ON public.document_issues FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "members read edits" ON public.structure_edits FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members log edits" ON public.structure_edits FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND edited_by = auth.uid());

CREATE POLICY "members read comments" ON public.document_comments FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add comments" ON public.document_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "members update comments" ON public.document_comments FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "authors delete comments" ON public.document_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "members read versions" ON public.document_versions FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "editors add versions" ON public.document_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()) AND created_by = auth.uid());

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Owner is automatically an admin member of their project
CREATE OR REPLACE FUNCTION public.add_owner_as_member() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER projects_owner_member AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();