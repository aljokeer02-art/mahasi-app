"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Member = { user_id: string; role: string };

const roleLabels: Record<string, string> = { owner: "مالك", editor: "محرر", viewer: "مشاهد" };

export default function UsersPage() {
  const { org, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!org) return;
    const { data } = await supabase.from("org_members").select("user_id, role").eq("org_id", org.id);
    setMembers(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("invite_member", {
      p_org_id: org.id,
      p_email: email,
      p_role: role,
    });
    if (error) setMessage("خطأ: " + error.message);
    else setMessage(data as string);
    setEmail("");
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">المستخدمون والصلاحيات</h1>
        <p className="text-forest-800/60 text-sm mt-1">
          ادعُ أفراد عائلتك بعد إنشائهم حساباً على صفحة الدخول
        </p>
      </div>

      {org?.role === "owner" && (
        <form onSubmit={invite} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            className="input sm:col-span-2"
            type="email"
            placeholder="البريد الإلكتروني للعضو"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">مشاهد (قراءة فقط)</option>
            <option value="editor">محرر (إضافة وتعديل)</option>
            <option value="owner">مالك (كل الصلاحيات)</option>
          </select>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "جارِ الإرسال..." : "دعوة"}
          </button>
          {message && <p className="sm:col-span-4 text-sm text-forest-700">{message}</p>}
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الدور</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className="font-mono text-sm">
                  {m.user_id === user?.id ? "أنت" : m.user_id.slice(0, 8) + "…"}
                </td>
                <td>{roleLabels[m.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
