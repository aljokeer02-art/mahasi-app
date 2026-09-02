"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Account = { id: string; code: string; name: string };
type CashBank = { id: string; account_id: string; type: string; accounts: { code: string; name: string } };
type Contact = { id: string; name: string };
type Voucher = { id: string; entry_number: number; entry_date: string; description: string | null; payment_method: string | null };

const emptyForm = { date: new Date().toISOString().slice(0, 10), amount: "", to_cash_bank: "", from_account: "", contact_id: "", method: "نقدي", description: "" };

export default function ReceiptVoucherPage() {
  const { org } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashBanks, setCashBanks] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  async function load() {
    if (!org) return;
    const [vRes, cbRes, accRes, conRes] = await Promise.all([
      supabase.from("journal_entries").select("id, entry_number, entry_date, description, payment_method").eq("org_id", org.id).eq("voucher_type", "سند_قبض").is("deleted_at", null).order("entry_date", { ascending: false }),
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

  function openNewForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  async function openEditForm(v: Voucher) {
    const { data: entryLines } = await supabase.from("journal_lines").select("account_id, debit, credit, contact_id").eq("entry_id", v.id);
    const debitLine = (entryLines || []).find((l: any) => Number(l.debit) > 0);
    const creditLine = (entryLines || []).find((l: any) => Number(l.credit) > 0);
    const cb = cashBanks.find((c) => c.account_id === debitLine?.account_id);
    setForm({
      date: v.entry_date,
      amount: String(debitLine?.debit || ""),
      to_cash_bank: cb?.id || "",
      from_account: creditLine?.account_id || "",
      contact_id: debitLine?.contact_id || "",
      method: v.payment_method || "نقدي",
      description: v.description || "",
    });
    setEditingId(v.id);
    setShowForm(true);
    setError("");
  }

  async function saveVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError("");
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || !form.to_cash_bank || !form.from_account) {
      setError("أكمل جميع الحقول المطلوبة");
      return;
    }
    setBusy(true);
    const toAccountId = cashBanks.find((c) => c.id === form.to_cash_bank)?.account_id;

    let entryId = editingId;
    if (editingId) {
      await supabase.from("journal_entries").update({ entry_date: form.date, description: form.description || "سند قبض", payment_method: form.method }).eq("id", editingId);
      await supabase.from("journal_lines").delete().eq("entry_id", editingId);
    } else {
      const { data: entry, error: entErr } = await supabase.from("journal_entries").insert({
        org_id: org.id, entry_date: form.date, description: form.description || "سند قبض", status: "مسودة",
        voucher_type: "سند_قبض", payment_method: form.method, created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select().single();
      if (entErr || !entry) { setError("خطأ: " + entErr?.message); setBusy(false); return; }
      entryId = entry.id;
    }

    await supabase.from("journal_lines").insert([
      { entry_id: entryId, account_id: toAccountId, contact_id: form.contact_id || null, debit: amount, credit: 0, description: form.description },
      { entry_id: entryId, account_id: form.from_account, contact_id: form.contact_id || null, debit: 0, credit: amount, description: form.description },
    ]);

    await supabase.from("journal_entries").update({ status: "مرحل" }).eq("id", entryId as string);

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setBusy(false);
    load();
  }

  async function deleteVoucher(id: string) {
    if (!confirm("حذف سند القبض هذا؟")) return;
    await supabase.from("journal_entries").update({ deleted_at: new Date().toISOString(), status: "ملغى" }).eq("id", id);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">سندات القبض</h1>
          <p className="text-forest-800/60 text-sm mt-1">تسجيل أي مبلغ مستلم (نقدي، بنكي، شيك)</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button
            className="btn-secondary"
            onClick={() =>
              exportToExcel(
                "سندات_القبض",
                "سندات القبض",
                vouchers.map((v) => ({
                  "رقم السند": v.entry_number,
                  "التاريخ": v.entry_date,
                  "الطريقة": v.payment_method || "",
                  "البيان": v.description || "",
                }))
              )
            }
          >
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("receipt-vouchers-table", "سندات_القبض")}>
            تصدير PDF
          </button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ سند قبض جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveVoucher} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">التاريخ</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">المبلغ</label>
            <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">طريقة الاستلام</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="نقدي">نقدي</option>
              <option value="بنكي">بنكي</option>
              <option value="شيك">شيك</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">استلم في (الصندوق/البنك)</label>
            <select className="input" value={form.to_cash_bank} onChange={(e) => setForm({ ...form, to_cash_bank: e.target.value })} required>
              <option value="">اختر...</option>
              {cashBanks.map((cb) => <option key={cb.id} value={cb.id}>{cb.accounts?.code} - {cb.accounts?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">مصدر المبلغ (الحساب المقابل)</label>
            <select className="input" value={form.from_account} onChange={(e) => setForm({ ...form, from_account: e.target.value })} required>
              <option value="">اختر...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">جهة الاتصال (اختياري)</label>
            <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">بدون</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-sm text-forest-800/70 block mb-1">البيان</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: استلام راتب شهر أغسطس" />
          </div>
          {error && <p className="text-red-600 text-sm sm:col-span-3">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-3">
            {busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ السند"}
          </button>
        </form>
      )}

      <div id="receipt-vouchers-table" className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>رقم السند</th><th>التاريخ</th><th>الطريقة</th><th>البيان</th><th className="no-print">إجراءات</th></tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-forest-800/70">#{v.entry_number}</td>
                <td>{v.entry_date}</td>
                <td>{v.payment_method || "—"}</td>
                <td>{v.description || "—"}</td>
                <td className="no-print">
                  <div className="flex gap-3 text-sm">
                    <button className="text-forest-600 hover:underline" onClick={() => openEditForm(v)}>تعديل</button>
                    <button className="text-red-600 hover:underline" onClick={() => deleteVoucher(v.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-forest-800/50">لا توجد سندات قبض بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
