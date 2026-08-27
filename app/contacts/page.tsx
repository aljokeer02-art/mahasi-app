"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Contact = { id: string; name: string; type: string; phone: string | null; email: string | null };

const types = [
  { value: "عميل", label: "عميل" },
  { value: "مورد", label: "مورد" },
  { value: "كلاهما", label: "كلاهما" },
];

export default function ContactsPage() {
  const { org } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "عميل", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const { data } = await supabase
      .from("contacts")
      .select("id, name, type, phone, email")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .order("name");
    setContacts(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    await supabase.from("contacts").insert({ org_id: org.id, ...form });
    setForm({ name: "", type: "عميل", phone: "", email: "" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">العملاء والموردون</h1>
          <p className="text-forest-800/60 text-sm mt-1">إدارة جهات الاتصال المرتبطة بالحسابات</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "إلغاء" : "+ جهة جديدة"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addContact} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            className="input sm:col-span-1"
            placeholder="الاسم"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="رقم الجوال"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            dir="ltr"
          />
          <input
            className="input"
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            dir="ltr"
          />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">
            {busy ? "جارِ الحفظ..." : "حفظ"}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>النوع</th>
              <th>الجوال</th>
              <th>البريد</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{c.type}</td>
                <td dir="ltr" className="text-left">{c.phone || "—"}</td>
                <td dir="ltr" className="text-left">{c.email || "—"}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-forest-800/50">
                  لا توجد جهات اتصال بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
