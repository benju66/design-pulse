-- Migration: 20260624_lesson_attachments_admin_read.sql
-- Description: Let platform admins view (list + sign URLs for) lesson attachments across
--   projects they aren't members of, so the read-only client/dashboard lessons detail panel
--   can surface attachments for any lesson it shows. Mirrors the clients table policy
--   (is_platform_admin() OR member). Upload/delete remain member + permission gated.

DROP POLICY IF EXISTS "Members can view lesson_attachments" ON lesson_attachments;
CREATE POLICY "Members can view lesson_attachments" ON lesson_attachments FOR SELECT
  USING (public.is_platform_admin() OR get_user_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "Members can view lesson_attachments storage" ON storage.objects;
CREATE POLICY "Members can view lesson_attachments storage" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lesson_attachments'
    AND (public.is_platform_admin() OR public.get_user_project_role((storage.foldername(name))[1]::uuid) IS NOT NULL)
  );
