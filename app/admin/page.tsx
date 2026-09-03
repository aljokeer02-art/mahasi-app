"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Org = { id: string; name: string; created_at: string };
type Member = { user_id: string; email: string; role: string; joined_at: string };

const roleLabels: Record<string, string> = { owner: "مالك", editor: "محرر", viewer: "مشاهد" };

export default function AdminPanelPage() {
  const { user, isPlatformAdmin, loading } = useAuth();
  const router = useRouter();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteMsg, setInviteMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isPlatformAdmin) router.replace("/no-access");
  }, [loading, isPlatformAdmin, router]);

  async function loadOrgs() {
    const { data } = await supabase.from("organizations").select("id, name, created_at").order("created_at");
    setOrgs(data || []);
  }

  useEffect(() => {
    if (isPlatformAdmin) loadOrgs();
  }, [isPlatformAdmin]);

  async function loadMembers(orgId: string) {
    setSelectedOrgId(orgId);
    setMembersLoading(true);
    const { data } = await supabase.rpc("get_org_members", { p_org_id: orgId });
    setMembers(data || []);
    setMembersLoading(false);
  }

  async function saveRename(id: string) {
    if (!renameValue.trim()) return;
    await supabase.from("organizations").update({ name: renameValue }).eq("id", id);
    setRenameId(null);
    loadOrgs();
  }

  async function confirmDelete(org: Org) {
    if (deleteConfirmText !== org.name) return;
    setBusy(true);
    await supabase.from("organizations").delete().eq("id", org.id);
    setDeleteId(null);
    setDeleteConfirmText("");
    if (selectedOrgId === org.id) {
      setSelectedOrgId(null);
      setMembers([]);
    }
    setBusy(false);
    loadOrgs();
  }

  async function changeRole(userId: string, newRole: string) {
    if (!selectedOrgId) return;
    await supabase.from("org_members").update({ role: newRole }).eq("org_id", selectedOrgId).eq("user_id", userId);
    loadMembers(selectedOrgId);
  }

  async function removeMember(userId: string) {
    if (!selectedOrgId) return;
    if (!confirm("إزالة هذا العضو من المساحة؟")) return;
    await supabase.from("org_members").delete().eq("org_id", selectedOrgId).eq("user_id", userId);
    loadMembers(selectedOrgId);
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    setBusy(true);
    setInviteMsg("");
    const { data, error } = await supabase.rpc("invite_member", {
      p_org_id: selectedOrgId,
      p_email: inviteEmail,
      p_role: inviteRole,
    });
    setInviteMsg(error ? "خطأ: " + error.message : (data as string));
    setInviteEmail("");
    setBusy(false);
    loadMembers(selectedOrgId);
  }

  if (loading || !isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-forest-800/60 text-sm">جارِ التحميل...</p>
      </div>
    );
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">لوحة النظام</h1>
        <p className="text-forest-800/60 text-sm mt-1">إدارة كل المساحات والمستخدمين والصلاحيات — متاحة لمدير النظام فقط</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* قائمة المساحات */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">المساحات ({orgs.length})</h2>
            <a href="/onboarding" className="text-sm text-forest-600 hover:underline">+ إنشاء مساحة</a>
          </div>
          <div className="card divide-y divide-forest-50">
            {orgs.map((org) => (
              <div key={org.id} className={`p-3 ${selectedOrgId === org.id ? "bg-forest-50" : ""}`}>
                {renameId === org.id ? (
                  <div className="flex gap-2">
                    <input className="input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                    <button className="text-forest-600 text-sm" onClick={() => saveRename(org.id)}>حفظ</button>
                    <button className="text-forest-800/50 text-sm" onClick={() => setRenameId(null)}>إلغاء</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button className="text-right flex-1" onClick={() => loadMembers(org.id)}>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-forest-800/50">{new Date(org.created_at).toLocaleDateString("ar")}</p>
                    </button>
                    <div className="flex gap-2 text-xs">
                      <button className="text-forest-600 hover:underline" onClick={() => { setRenameId(org.id); setRenameValue(org.name); }}>تعديل</button>
                      <button className="text-red-600 hover:underline" onClick={() => { setDeleteId(org.id); setDeleteConfirmText(""); }}>حذف</button>
                    </div>
                  </div>
                )}

                {deleteId === org.id && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-800 mb-2">
                      ⚠ حذف نهائي لكل بيانات هذه المساحة (حسابات، قيود، كل شيء). اكتب اسم المساحة <span className="font-mono">{org.name}</span> للتأكيد.
                    </p>
                    <input className="input text-sm mb-2" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        className="btn-primary bg-red-700 hover:bg-red-800 text-sm px-3 py-1"
                        disabled={deleteConfirmText !== org.name || busy}
                        onClick={() => confirmDelete(org)}
                      >
                        حذف نهائياً
                      </button>
                      <button className="text-sm text-forest-800/60" onClick={() => setDeleteId(null)}>إلغاء</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {orgs.length === 0 && <p className="p-4 text-center text-forest-800/50 text-sm">لا توجد مساحات بعد.</p>}
          </div>
        </div>

        {/* تفاصيل المساحة المختارة */}
        <div className="lg:col-span-2">
          {!selectedOrgId ? (
            <div className="card p-8 text-center text-forest-800/50">اختر مساحة من القائمة لعرض أعضائها وإدارتهم.</div>
          ) : (
            <>
              <h2 className="font-medium mb-3">أعضاء "{selectedOrg?.name}"</h2>

              <form onSubmit={inviteMember} className="card p-4 mb-4 flex flex-wrap gap-2 items-end">
                <input
                  type="email"
                  className="input flex-1 min-w-[180px]"
                  placeholder="بريد العضو الجديد"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  dir="ltr"
                />
                <select className="input w-auto" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="viewer">مشاهد</option>
                  <option value="editor">محرر</option>
                  <option value="owner">مالك</option>
                </select>
                <button type="submit" disabled={busy} className="btn-primary">دعوة</button>
                {inviteMsg && <p className="text-sm text-forest-700 w-full">{inviteMsg}</p>}
              </form>

              <div className="card overflow-hidden">
                <table className="w-full table-base">
                  <thead>
                    <tr><th>البريد</th><th>الدور</th><th>تاريخ الانضمام</th><th>إجراءات</th></tr>
                  </thead>
                  <tbody>
                    {membersLoading && (
                      <tr><td colSpan={4} className="text-center py-8 text-forest-800/50">جارِ التحميل...</td></tr>
                    )}
                    {!membersLoading && members.map((m) => (
                      <tr key={m.user_id}>
                        <td dir="ltr" className="text-left">{m.email}{m.user_id === user?.id && " (أنت)"}</td>
                        <td>
                          <select className="input py-1 text-sm w-auto" value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}>
                            <option value="owner">مالك</option>
                            <option value="editor">محرر</option>
                            <option value="viewer">مشاهد</option>
                          </select>
                        </td>
                        <td>{new Date(m.joined_at).toLocaleDateString("ar")}</td>
                        <td>
                          <button className="text-red-600 hover:underline text-sm" onClick={() => removeMember(m.user_id)}>
                            إزالة
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!membersLoading && members.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-forest-800/50">لا يوجد أعضاء بعد.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
