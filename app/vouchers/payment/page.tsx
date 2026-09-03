"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Account = { id: string; code: string; name: string; currency_id: string | null };
type Currency = { id: string; code: string; name: string; exchange_rate: number };
type CashBank = { id: string; account_id: string; type: string; accounts: { code: string; name: string } };
type Contact = { id: string; name: string };
type Voucher = { id: string; entry_number: number; entry_date: string; description: string | null; payment_method: string | null };

type Side = { currency_id: string; fx_amount: string; exchange_rate: string; amount: string };
const emptySide = (): Side => ({ currency_id: "", fx_amount: "", exchange_rate: "", amount: "" });

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  from_cash_bank: "",
  to_account: "",
  contact_id: "",
  method: "نقدي",
  description: "",
};

export default function PaymentVoucherPage() {
  const { org } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashBanks, setCashBanks] = useState<CashBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [fromSide, setFromSide] = useState<Side>(emptySide());
  const [toSide, setToSide] = useState<Side>(emptySide());

  async function load() {
    if (!org) return;
    const [vRes, cbRes, accRes, curRes, conRes] = await Promise.all([
      supabase.from("journal_entries").select("id, entry_number, entry_date, description, payment_method").eq("org_id", org.id).eq("voucher_type", "سند_صرف").is("deleted_at", null).order("entry_date", { ascending: false }),
      supabase.from("cash_bank_accounts").select("id, account_id, type, accounts(code, name)").eq("org_id", org.id),
      supabase.from("accounts").select("id, code, name, currency_id").eq("org_id", org.id).is("deleted_at", null).order("code"),
      supabase.from("currencies").select("id, code, name, exchange_rate").eq("org_id", org.id),
      supabase.from("contacts").select("id, name").eq("org_id", org.id).is("deleted_at", null),
    ]);
    setVouchers((vRes.data as any) || []);
    setCashBanks((cbRes.data as any) || []);
    setAccounts(accRes.data || []);
    setCurrencies(curRes.data || []);
    setContacts(conRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function defaultCurrencyFor(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.currency_id ? currencies.find((c) => c.id === acc.currency_id) || null : null;
  }

  function onFromCashBankChange(cbId: string) {
    const cb = cashBanks.find((c) => c.id === cbId);
    const cur = cb ? defaultCurrencyFor(cb.account_id) : null;
    setForm({ ...form, from_cash_bank: cbId });
    setFromSide({ currency_id: cur?.id || "", exchange_rate: cur ? String(cur.exchange_rate) : "", fx_amount: "", amount: "" });
  }

  function onToAccountChange(accountId: string) {
    const cur = defaultCurrencyFor(accountId);
    setForm({ ...form, to_account: accountId });
    setToSide({ currency_id: cur?.id || "", exchange_rate: cur ? String(cur.exchange_rate) : "", fx_amount: "", amount: "" });
  }

  function sideCurrencyChange(which: "to" | "from", currencyId: string) {
    const cur = currencies.find((c) => c.id === currencyId);
    const patch = { currency_id: currencyId, exchange_rate: cur ? String(cur.exchange_rate) : "", fx_amount: "", amount: "" };
    which === "to" ? setToSide(patch) : setFromSide(patch);
  }

  function sideFxChange(which: "to" | "from", fxAmount: string, rate: string) {
    const amount = (parseFloat(fxAmount) || 0) * (parseFloat(rate) || 0);
    const setter = which === "to" ? setToSide : setFromSide;
    setter((prev) => ({ ...prev, fx_amount: fxAmount, amount: amount ? String(amount) : "" }));
  }

  function sideRateChange(which: "to" | "from", rate: string, fxAmount: string) {
    const amount = (parseFloat(fxAmount) || 0) * (parseFloat(rate) || 0);
    const setter = which === "to" ? setToSide : setFromSide;
    setter((prev) => ({ ...prev, exchange_rate: rate, amount: amount ? String(amount) : "" }));
  }

  function sideAmountChange(which: "to" | "from", amount: string) {
    const setter = which === "to" ? setToSide : setFromSide;
    setter((prev) => ({ ...prev, amount }));
  }

  const toAmount = parseFloat(toSide.amount) || 0;
  const fromAmount = parseFloat(fromSide.amount) || 0;
  const balanced = toAmount > 0 && toAmount === fromAmount;

  function resetForm() {
    setForm(emptyForm);
    setToSide(emptySide());
    setFromSide(emptySide());
    setEditingId(null);
    setError("");
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  async function openEditForm(v: Voucher) {
    const { data: entryLines } = await supabase.from("journal_lines").select("account_id, debit, credit, contact_id, currency_id, fx_amount, exchange_rate").eq("entry_id", v.id);
    const debitLine = (entryLines || []).find((l: any) => Number(l.debit) > 0);
    const creditLine = (entryLines || []).find((l: any) => Number(l.credit) > 0);
    const cb = cashBanks.find((c) => c.account_id === creditLine?.account_id);
    setForm({
      date: v.entry_date,
      from_cash_bank: cb?.id || "",
      to_account: debitLine?.account_id || "",
      contact_id: debitLine?.contact_id || "",
      method: v.payment_method || "نقدي",
      description: v.description || "",
    });
    setToSide({
      currency_id: debitLine?.currency_id || "",
      fx_amount: debitLine?.fx_amount ? String(debitLine.fx_amount) : "",
      exchange_rate: debitLine?.exchange_rate ? String(debitLine.exchange_rate) : "",
      amount: String(debitLine?.debit || ""),
    });
    setFromSide({
      currency_id: creditLine?.currency_id || "",
      fx_amount: creditLine?.fx_amount ? String(creditLine.fx_amount) : "",
      exchange_rate: creditLine?.exchange_rate ? String(creditLine.exchange_rate) : "",
      amount: String(creditLine?.credit || ""),
    });
    setEditingId(v.id);
    setShowForm(true);
    setError("");
  }

  async function saveVoucher(post: boolean) {
    if (!org) return;
    setError("");
    if (!form.from_cash_bank || !form.to_account || !toAmount || !fromAmount) {
      setError("أكمل جميع الحقول المطلوبة");
      return;
    }
    if (post && !balanced) {
      setError("لا يمكن ترحيل السند: المعادل بالعملة الأساسية يجب أن يتساوى بين الطرفين");
      return;
    }
    setBusy(true);
    const fromAccountId = cashBanks.find((c) => c.id === form.from_cash_bank)?.account_id;

    let entryId = editingId;
    if (editingId) {
      await supabase.from("journal_entries").update({ entry_date: form.date, description: form.description || "سند صرف", payment_method: form.method }).eq("id", editingId);
      await supabase.from("journal_lines").delete().eq("entry_id", editingId);
    } else {
      const { data: entry, error: entErr } = await supabase.from("journal_entries").insert({
        org_id: org.id, entry_date: form.date, description: form.description || "سند صرف", status: "مسودة",
        voucher_type: "سند_صرف", payment_method: form.method, created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select().single();
      if (entErr || !entry) { setError("خطأ: " + entErr?.message); setBusy(false); return; }
      entryId = entry.id;
    }

    await supabase.from("journal_lines").insert([
      {
        entry_id: entryId, account_id: form.to_account, contact_id: form.contact_id || null, debit: toAmount, credit: 0, description: form.description,
        currency_id: toSide.currency_id || null, fx_amount: toSide.currency_id ? parseFloat(toSide.fx_amount) || null : null, exchange_rate: toSide.currency_id ? parseFloat(toSide.exchange_rate) || null : null,
      },
      {
        entry_id: entryId, account_id: fromAccountId, contact_id: form.contact_id || null, debit: 0, credit: fromAmount, description: form.description,
        currency_id: fromSide.currency_id || null, fx_amount: fromSide.currency_id ? parseFloat(fromSide.fx_amount) || null : null, exchange_rate: fromSide.currency_id ? parseFloat(fromSide.exchange_rate) || null : null,
      },
    ]);

    if (post) {
      const { error: postErr } = await supabase.from("journal_entries").update({ status: "مرحل" }).eq("id", entryId as string);
      if (postErr) { setError("تم الحفظ كمسودة، لكن تعذّر الترحيل: " + postErr.message); setBusy(false); load(); return; }
    }

    resetForm();
    setShowForm(false);
    setBusy(false);
    load();
  }

  async function deleteVoucher(id: string) {
    if (!confirm("حذف سند الصرف هذا؟")) return;
    await supabase.from("journal_entries").update({ deleted_at: new Date().toISOString(), status: "ملغى" }).eq("id", id);
    load();
  }

  function SideFields({ label, side, which, accountLabel }: { label: string; side: Side; which: "to" | "from"; accountLabel: string }) {
    return (
      <div className="border border-forest-100 rounded-lg p-3">
        <p className="text-sm font-medium mb-2">{label}: <span className="text-forest-800/60 font-normal">{accountLabel || "—"}</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className="input" value={side.currency_id} onChange={(e) => sideCurrencyChange(which, e.target.value)}>
            <option value="">العملة الأساسية</option>
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
          {!side.currency_id && (
            <input className="input sm:col-span-2" type="number" step="0.01" placeholder="المبلغ" value={side.amount} onChange={(e) => sideAmountChange(which, e.target.value)} />
          )}
          {side.currency_id && (
            <>
              <input className="input" type="number" step="0.01" placeholder="المبلغ بعملة الطرف" value={side.fx_amount} onChange={(e) => sideFxChange(which, e.target.value, side.exchange_rate)} dir="ltr" />
              <input className="input" type="number" step="0.0001" placeholder="سعر الصرف" value={side.exchange_rate} onChange={(e) => sideRateChange(which, e.target.value, side.fx_amount)} />
            </>
          )}
        </div>
        {side.currency_id && (
          <p className="text-xs text-forest-800/60 mt-2">المعادل بالعملة الأساسية: <span className="font-medium">{(parseFloat(side.amount) || 0).toLocaleString("ar")}</span></p>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">سندات الصرف</h1>
          <p className="text-forest-800/60 text-sm mt-1">لكل طرف عملته الخاصة القابلة للتغيير — يدعم المصارفة الكاملة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-secondary" onClick={() => exportToExcel("سندات_الصرف", "سندات الصرف", vouchers.map((v) => ({ "رقم السند": v.entry_number, "التاريخ": v.entry_date, "الطريقة": v.payment_method || "", "البيان": v.description || "" })))}>
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("payment-vouchers-table", "سندات_الصرف")}>
            تصدير PDF
          </button>
          <button className="btn-primary" onClick={() => (showForm ? (resetForm(), setShowForm(false)) : openNewForm())}>
            {showForm ? "إلغاء" : "+ سند صرف جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 no-print space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">التاريخ</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
              <label className="text-sm text-forest-800/70 block mb-1">جهة الاتصال (اختياري)</label>
              <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                <option value="">بدون</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-forest-800/70 block mb-1">صُرف من (الصندوق/البنك)</label>
            <select className="input mb-2" value={form.from_cash_bank} onChange={(e) => onFromCashBankChange(e.target.value)} required>
              <option value="">اختر...</option>
              {cashBanks.map((cb) => <option key={cb.id} value={cb.id}>{cb.accounts?.code} - {cb.accounts?.name}</option>)}
            </select>
            <SideFields label="طرف الصرف" side={fromSide} which="from" accountLabel={cashBanks.find((c) => c.id === form.from_cash_bank)?.accounts?.name || ""} />
          </div>

          <div>
            <label className="text-sm text-forest-800/70 block mb-1">وجهة الصرف (الحساب المقابل)</label>
            <select className="input mb-2" value={form.to_account} onChange={(e) => onToAccountChange(e.target.value)} required>
              <option value="">اختر...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
            <SideFields label="طرف الوجهة" side={toSide} which="to" accountLabel={accounts.find((a) => a.id === form.to_account)?.name || ""} />
          </div>

          <div>
            <label className="text-sm text-forest-800/70 block mb-1">البيان</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: دفع فاتورة، أو مصارفة عملة" />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-forest-50">
            <div className="text-sm">
              {toAmount > 0 && fromAmount > 0 && (
                balanced ? <span className="text-forest-700">✓ متوازن ({toAmount.toLocaleString("ar")})</span> : <span className="text-red-600">غير متوازن: {toAmount.toLocaleString("ar")} ≠ {fromAmount.toLocaleString("ar")}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={busy} onClick={() => saveVoucher(false)}>حفظ كمسودة</button>
              <button className="btn-primary" disabled={busy || !balanced} onClick={() => saveVoucher(true)}>
                {editingId ? "حفظ وترحيل" : "ترحيل السند"}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      )}

      <div id="payment-vouchers-table" className="card overflow-hidden">
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
              <tr><td colSpan={5} className="text-center py-8 text-forest-800/50">لا توجد سندات صرف بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
