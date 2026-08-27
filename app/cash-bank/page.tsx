"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string };
type CashBank = { id: string; type: string; bank_name: string | null; account_number: string | null; accounts: { code: string; name: string } };

export default function CashBankPage() {
  const { org } = useAuth();
  const [items, setItems] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account_id: "", type: "نقدي", bank_name: "", account_number: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [itemsRes, accRes] = await Promise.all([
      supabase.from("cash_bank_accounts").select("id, type, bank_name, account_number, accounts(code, name)").eq("org_id", org.id),
      supabase.from("accounts").select("id, code, name").eq("org_id", org.id).is("deleted_at", null).order("code"),
    ]);
    setItems((itemsRes.data as any) || []);
    setAccounts(accRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    await supabase.from("cash_bank_accounts").insert({ org_id: org.id, ...form });
    setForm({ account_id: "", type: "نقدي", bank_name: "", account_number: "" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">الصناديق والبنوك</h1>
          <p className="text-forest-800/60 text-sm mt-1">اربط حسابات النقدية والبنوك بدليل الحسابات</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "إلغاء" : "+ إضافة"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addItem} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            className="input"
            value={form.account_id}
            onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            required
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
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">{busy ? "جارِ الحفظ..." : "حفظ"}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>الحساب المرتبط</th><th>النوع</th><th>اسم البنك</th><th>رقم الحساب</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.accounts?.code} - {i.accounts?.name}</td>
                <td>{i.type}</td>
                <td>{i.bank_name || "—"}</td>
                <td dir="ltr" className="text-left">{i.account_number || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-forest-800/50">لا توجد صناديق أو بنوك مضافة بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
