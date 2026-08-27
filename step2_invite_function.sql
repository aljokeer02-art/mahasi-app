-- ============================================================
-- إضافة: دالة دعوة عضو جديد بالبريد الإلكتروني
-- نفّذ هذا الملف في SQL Editor بنفس طريقة الملف الأول
-- ============================================================

create or replace function invite_member(p_org_id uuid, p_email text, p_role member_role)
returns text
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  if get_user_role(p_org_id) <> 'owner' then
    raise exception 'فقط مالك المساحة يمكنه دعوة أعضاء جدد';
  end if;

  select id into v_user_id from auth.users where email = p_email limit 1;

  if v_user_id is null then
    return 'لا يوجد مستخدم مسجل بهذا البريد. اطلب منه إنشاء حساب أولاً عبر صفحة الدخول، ثم أعد المحاولة.';
  end if;

  insert into org_members (org_id, user_id, role)
  values (p_org_id, v_user_id, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  return 'تمت إضافة العضو بنجاح';
end;
$$;

grant execute on function invite_member(uuid, text, member_role) to authenticated;
