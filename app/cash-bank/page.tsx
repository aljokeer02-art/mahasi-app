"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string; opening_balance: number; currency_id: string | null };
type Currency = { id: string; code: string; name: string };
type CashBank = {
  id: string;
  account_id: string;
  type: string;
  bank_name: string | null;
  account_number: string | null;
  accounts: { code: string; name: string; opening_balance: number; currency_id: string | null };
};

const emptyForm = { account_id: "", type: "نقدي", bank_name: "", account_number: "", opening_balance: "0", currency_id: "" };

export default function CashBankPage() {
  const { org } = useAuth();
  const [items, setItems] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [itemsRes, accRes, curRes] = await Promise.all([
      supabase
        .from("cash_bank_accounts")
        .select("id, account_id, type, bank_name, account_number, accounts(code, name, opening_balance, currency_id)")
        .eq("org_id", org.id),
      supabase.from("accounts").select("id, code, name, opening_balance, currency_id").eq("org_id", org.id).is("deleted_at", null).order("code"),
      supabase.from("currencies").select("id, code, name").eq("org_id", org.id),
    ]);
    setItems((itemsRes.data as any) || []);
    setAccounts(accRes.data || []);
    setCurrencies(curRes.data || []);
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
      opening_balance: String(cb.accounts?.opening_balance ?? 0),
      currency_id: cb.accounts?.currency_id || "",
    });
    setEditingId(cb.id);
    setShowForm(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);

    // تحديث الرصيد الافتتاحي والعملة على الحساب المرتبط في دليل الحسابات
    await supabase
      .from("accounts")
      .update({
        opening_balance: parseFloat(form.opening_balance || "0"),
        currency_id: form.currency_id || null,
      })
      .eq("id", form.account_id);

    if (editingId) {
      await supabase
        .from("cash_bank_accounts")
        .update({ type: form.type, bank_name: form.bank_name, account_number: form.account_number })
        .eq("id", editingId);
    } else {
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
    if (!confirm("حذف هذا الصندوق/البنك؟ (الحساب نفسه في دليل الحسابات يبقى موجوداً)")) return;
    await supabase.from("cash_bank_accounts").delete().eq("id", id);
    load();
  }

  const currencyLabel = (id: string | null) => currencies.find((c) => c.id === id)?.code || "الأساسية";

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">الصناديق والبنوك</h1>
          <p className="text-forest-800/60 text-sm mt-1">اربط حسابات النقدية والبنوك، وحدّد الرصيد الافتتاحي وعملته</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ إضافة"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveItem} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
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

          <select className="input" value={form.currency_id} onChange={(e) => setForm({ ...form, currency_id: e.target.value })}>
            <option value="">العملة الأساسية</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="الرصيد الافتتاحي"
            value={form.opening_balance}
            onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
          />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">
            {busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ"}
          </button>
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
              <th>الرصيد الافتتاحي</th>
              <th>العملة</th>
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
                <td>{Number(i.accounts?.opening_balance ?? 0).toLocaleString("ar")}</td>
                <td dir="ltr" className="text-left">{currencyLabel(i.accounts?.currency_id)}</td>
                <td className="no-print">
                  <div className="flex gap-3 text-sm">
                    <button className="text-forest-600 hover:underline" onClick={() => openEditForm(i)}>تعديل</button>
                    <button className="text-red-600 hover:underline" onClick={() => deleteItem(i.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-forest-800/50">لا توجد صناديق أو بنوك مضافة بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
