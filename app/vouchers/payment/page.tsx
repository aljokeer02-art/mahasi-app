"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string };
type CashBank = { id: string; account_id: string; type: string; accounts: { code: string; name: string } };
type Contact = { id: string; name: string };
type Voucher = {
  id: string;
  entry_number: number;
  entry_date: string;
  description: string | null;
  payment_method: string | null;
};

export default function PaymentVoucherPage() {
  const { org } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashBanks, setCashBanks] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    from_cash_bank: "",
    to_account: "",
    contact_id: "",
    method: "نقدي",
    description: "",
  });

  async function load() {
    if (!org) return;
    const [vRes, cbRes, accRes, conRes] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, payment_method")
        .eq("org_id", org.id)
        .eq("voucher_type", "سند_صرف")
        .is("deleted_at", null)
        .order("entry_date", { ascending: false }),
      supabase.from("cash_bank_accounts").select("id, account_id, type, accounts(code, name)").eq("org_id", org.id),
      supabase.from("accounts").select("id, code, name").eq("org_id", org.id).is("deleted_at", null).order("code"),
      supabase.from("contacts").select("id, name").eq("org_id", org.id).is("deleted_at", null),
    ]);
    setVouchers((vRes.data as any) || []);
    setCashBanks((cbRes.data as any) || []);
    setAccounts(accRes.data || []);
    setContacts(conRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function saveVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError("");
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || !form.from_cash_bank || !form.to_account) {
      setError("أكمل جميع الحقول المطلوبة");
      return;
    }
    setBusy(true);

    const { data: entry, error: entErr } = await supabase
      .from("journal_entries")
      .insert({
        org_id: org.id,
        entry_date: form.date,
        description: form.description || "سند صرف",
        status: "مسودة",
        voucher_type: "سند_صرف",
        payment_method: form.method,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (entErr || !entry) {
      setError("خطأ: " + entErr?.message);
      setBusy(false);
      return;
    }

    const fromAccountId = cashBanks.find((c) => c.id === form.from_cash_bank)?.account_id;

    await supabase.from("journal_lines").insert([
      { entry_id: entry.id, account_id: form.to_account, contact_id: form.contact_id || null, debit: amount, credit: 0, description: form.description },
      { entry_id: entry.id, account_id: fromAccountId, contact_id: form.contact_id || null, debit: 0, credit: amount, description: form.description },
    ]);

    const { error: postErr } = await supabase.from("journal_entries").update({ status: "مرحل" }).eq("id", entry.id);
    if (postErr) setError("تم الحفظ كمسودة لكن تعذّر الترحيل: " + postErr.message);

    setForm({ date: new Date().toISOString().slice(0, 10), amount: "", from_cash_bank: "", to_account: "", contact_id: "", method: "نقدي", description: "" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">سندات الصرف</h1>
          <p className="text-forest-800/60 text-sm mt-1">تسجيل أي مبلغ مدفوع (نقدي، بنكي، شيك)</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "إلغاء" : "+ سند صرف جديد"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveVoucher} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">التاريخ</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">المبلغ</label>
            <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">طريقة الدفع</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="نقدي">نقدي</option>
              <option value="بنكي">بنكي</option>
              <option value="شيك">شيك</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">صُرف من (الصندوق/البنك)</label>
            <select className="input" value={form.from_cash_bank} onChange={(e) => setForm({ ...form, from_cash_bank: e.target.value })} required>
              <option value="">اختر...</option>
              {cashBanks.map((cb) => (
                <option key={cb.id} value={cb.id}>{cb.accounts?.code} - {cb.accounts?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">وجهة الصرف (الحساب المقابل)</label>
            <select className="input" value={form.to_account} onChange={(e) => setForm({ ...form, to_account: e.target.value })} required>
              <option value="">اختر...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">جهة الاتصال (اختياري)</label>
            <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">بدون</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-sm text-forest-800/70 block mb-1">البيان</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: دفع فاتورة الكهرباء" />
          </div>
          {error && <p className="text-red-600 text-sm sm:col-span-3">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-3">
            {busy ? "جارِ الحفظ..." : "حفظ السند"}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>رقم السند</th>
              <th>التاريخ</th>
              <th>الطريقة</th>
              <th>البيان</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-forest-800/70">#{v.entry_number}</td>
                <td>{v.entry_date}</td>
                <td>{v.payment_method || "—"}</td>
                <td>{v.description || "—"}</td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-forest-800/50">لا توجد سندات صرف بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
