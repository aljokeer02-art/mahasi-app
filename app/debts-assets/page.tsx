"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Contact = { id: string; name: string };
type Item = { id: string; type: string; name: string; amount: number; due_date: string | null; status: string; contacts: { name: string } | null };

const typeLabels: Record<string, string> = { "دين_علي": "دين عليّ", "دين_لي": "دين لي", "اصل": "أصل" };

export default function DebtsAssetsPage() {
  const { org } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "دين_علي", name: "", amount: "", contact_id: "", due_date: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [itemsRes, conRes] = await Promise.all([
      supabase.from("debts_assets").select("id, type, name, amount, due_date, status, contacts(name)").eq("org_id", org.id).order("due_date"),
      supabase.from("contacts").select("id, name").eq("org_id", org.id).is("deleted_at", null),
    ]);
    setItems((itemsRes.data as any) || []);
    setContacts(conRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    await supabase.from("debts_assets").insert({
      org_id: org.id,
      type: form.type,
      name: form.name,
      amount: parseFloat(form.amount || "0"),
      contact_id: form.contact_id || null,
      due_date: form.due_date || null,
    });
    setForm({ type: "دين_علي", name: "", amount: "", contact_id: "", due_date: "" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">الديون والأصول</h1>
          <p className="text-forest-800/60 text-sm mt-1">تتبع ما عليك وما لك، وأصولك الثابتة</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "إلغاء" : "+ إضافة"}</button>
      </div>

      {showForm && (
        <form onSubmit={addItem} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="دين_علي">دين عليّ</option>
            <option value="دين_لي">دين لي</option>
            <option value="اصل">أصل</option>
          </select>
          <input className="input" placeholder="الوصف" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="number" step="0.01" placeholder="المبلغ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
            <option value="">جهة الاتصال (اختياري)</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">{busy ? "جارِ الحفظ..." : "حفظ"}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الجهة</th><th>تاريخ الاستحقاق</th></tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const overdue = i.due_date && i.due_date < today && i.type !== "اصل";
              return (
                <tr key={i.id}>
                  <td>{typeLabels[i.type]}</td>
                  <td className="font-medium">{i.name}</td>
                  <td>{i.amount.toLocaleString("ar")}</td>
                  <td>{i.contacts?.name || "—"}</td>
                  <td className={overdue ? "text-red-600 font-medium" : ""}>
                    {i.due_date || "—"} {overdue && "(متأخر)"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-forest-800/50">لا توجد سجلات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
