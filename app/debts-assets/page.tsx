"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Contact = { id: string; name: string };
type Item = { id: string; type: string; name: string; amount: number; due_date: string | null; status: string; contact_id: string | null; contacts: { name: string } | null };

const typeLabels: Record<string, string> = { "دين_علي": "دين عليّ", "دين_لي": "دين لي", "اصل": "أصل" };
const emptyForm = { type: "دين_علي", name: "", amount: "", contact_id: "", due_date: "" };

export default function DebtsAssetsPage() {
  const { org } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [itemsRes, conRes] = await Promise.all([
      supabase.from("debts_assets").select("id, type, name, amount, due_date, status, contact_id, contacts(name)").eq("org_id", org.id).order("due_date"),
      supabase.from("contacts").select("id, name").eq("org_id", org.id).is("deleted_at", null),
    ]);
    setItems((itemsRes.data as any) || []);
    setContacts(conRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function openNewForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(i: Item) {
    setForm({
      type: i.type,
      name: i.name,
      amount: String(i.amount),
      contact_id: i.contact_id || "",
      due_date: i.due_date || "",
    });
    setEditingId(i.id);
    setShowForm(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    const payload = {
      type: form.type,
      name: form.name,
      amount: parseFloat(form.amount || "0"),
      contact_id: form.contact_id || null,
      due_date: form.due_date || null,
    };
    if (editingId) {
      await supabase.from("debts_assets").update(payload).eq("id", editingId);
    } else {
      await supabase.from("debts_assets").insert({ org_id: org.id, ...payload });
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setBusy(false);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("حذف هذا السجل؟")) return;
    await supabase.from("debts_assets").delete().eq("id", id);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">الديون والأصول</h1>
          <p className="text-forest-800/60 text-sm mt-1">تتبع ما عليك وما لك، وأصولك الثابتة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ إضافة"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveItem} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 no-print">
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
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">{busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ"}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الجهة</th><th>تاريخ الاستحقاق</th><th className="no-print">إجراءات</th></tr>
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
                  <td className="no-print">
                    <div className="flex gap-3 text-sm">
                      <button className="text-forest-600 hover:underline" onClick={() => openEditForm(i)}>تعديل</button>
                      <button className="text-red-600 hover:underline" onClick={() => deleteItem(i.id)}>حذف</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-forest-800/50">لا توجد سجلات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
