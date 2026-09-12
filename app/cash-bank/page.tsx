"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string };
type CashBank = {
  id: string;
  account_id: string;
  type: string;
  bank_name: string | null;
  account_number: string | null;
  accounts: { code: string; name: string };
};

const emptyForm = { account_id: "", type: "نقدي", bank_name: "", account_number: "" };

export default function CashBankPage() {
  const { org } = useAuth();
  const [items, setItems] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [itemsRes, accRes] = await Promise.all([
      supabase.from("cash_bank_accounts").select("id, account_id, type, bank_name, account_number, accounts(code, name)").eq("org_id", org.id),
      supabase.from("accounts").select("id, code, name").eq("org_id", org.id).is("deleted_at", null).order("code"),
    ]);
    setItems((itemsRes.data as any) || []);
    setAccounts(accRes.data || []);
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

  function openEditForm(cb: CashBank) {
    setForm({
      account_id: cb.account_id,
      type: cb.type,
      bank_name: cb.bank_name || "",
      account_number: cb.account_number || "",
    });
    setEditingId(cb.id);
    setShowForm(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);

    if (editingId) {
      await supabase
        .from("cash_bank_accounts")
        .update({ type: form.type, bank_name: form.bank_name, account_number: form.account_number })
        .eq("id", editingId);
    } else {
      // امنع ربط نفس الحساب مرتين بالخطأ
      const alreadyLinked = items.some((i) => i.account_id === form.account_id);
      if (alreadyLinked) {
        alert("هذا الحساب مربوط بالفعل. إذا أردت إضافة عملة أخرى له، اذهب لصفحة \"الأرصدة الافتتاحية\" بدل تكرار الربط هنا.");
        setBusy(false);
        return;
      }
      await supabase.from("cash_bank_accounts").insert({
        org_id: org.id,
        account_id: form.account_id,
        type: form.type,
        bank_name: form.bank_name,
        account_number: form.account_number,
      });
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setBusy(false);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("حذف هذا الربط؟ (الحساب نفسه في دليل الحسابات يبقى موجوداً)")) return;
    await supabase.from("cash_bank_accounts").delete().eq("id", id);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">الصناديق والبنوك</h1>
          <p className="text-forest-800/60 text-sm mt-1">
            اربط الحساب مرة واحدة فقط — لإضافة عملات متعددة لنفس الحساب اذهب لـ"الأرصدة الافتتاحية"
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ إضافة"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveItem} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
          <select
            className="input"
            value={form.account_id}
            onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            required
            disabled={!!editingId}
          >
            <option value="">اختر حساب مرتبط...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="نقدي">نقدي</option>
            <option value="بنك">بنك</option>
          </select>
          <input className="input" placeholder="اسم البنك (اختياري)" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
          <input className="input" placeholder="رقم الحساب (اختياري)" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} dir="ltr" />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-4">
            {busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ"}
          </button>
          {!editingId && (
            <p className="text-xs text-forest-800/50 sm:col-span-4">
              💡 بعد الربط، اذهب لصفحة "الأرصدة الافتتاحية" لإضافة رصيد هذا الحساب بأي عدد من العملات تريد.
            </p>
          )}
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>الحساب المرتبط</th>
              <th>النوع</th>
              <th>اسم البنك</th>
              <th>رقم الحساب</th>
              <th className="no-print">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.accounts?.code} - {i.accounts?.name}</td>
                <td>{i.type}</td>
                <td>{i.bank_name || "—"}</td>
                <td dir="ltr" className="text-left">{i.account_number || "—"}</td>
                <td className="no-print">
                  <div className="flex gap-3 text-sm">
                    <button className="text-forest-600 hover:underline" onClick={() => openEditForm(i)}>تعديل</button>
                    <button className="text-red-600 hover:underline" onClick={() => deleteItem(i.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-forest-800/50">لا توجد صناديق أو بنوك مضافة بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
