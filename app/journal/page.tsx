"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Entry = {
  id: string;
  entry_number: number;
  entry_date: string;
  description: string | null;
  status: string;
};

type Account = { id: string; code: string; name: string; currency_id: string | null };
type Currency = { id: string; code: string; name: string; exchange_rate: number };

type Line = {
  id?: string;
  account_id: string;
  side: "debit" | "credit";
  currency_id: string; // فارغ = العملة الأساسية
  fx_amount: string; // المبلغ بعملة السطر (عند اختيار عملة غير أساسية)
  exchange_rate: string;
  amount: string; // المعادل بالعملة الأساسية — هذا ما يدخل في التوازن
  description: string;
};

const emptyLine = (): Line => ({ account_id: "", side: "debit", currency_id: "", fx_amount: "", exchange_rate: "", amount: "", description: "" });

export default function JournalPage() {
  const { org } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!org) return;
    const [entRes, accRes, curRes] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, status")
        .eq("org_id", org.id)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false }),
      supabase.from("accounts").select("id, code, name, currency_id").eq("org_id", org.id).is("deleted_at", null).order("code"),
      supabase.from("currencies").select("id, code, name, exchange_rate").eq("org_id", org.id),
    ]);
    setEntries(entRes.data || []);
    setAccounts(accRes.data || []);
    setCurrencies(curRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const totalDebit = lines.reduce((s, l) => s + (l.side === "debit" ? parseFloat(l.amount) || 0 : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.side === "credit" ? parseFloat(l.amount) || 0 : 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function onAccountChange(i: number, accountId: string) {
    // نقترح عملة الحساب تلقائياً كبداية، لكن يمكن تغييرها بحرية بعد ذلك
    const acc = accounts.find((a) => a.id === accountId);
    const cur = acc?.currency_id ? currencies.find((c) => c.id === acc.currency_id) : null;
    updateLine(i, {
      account_id: accountId,
      currency_id: cur?.id || "",
      exchange_rate: cur ? String(cur.exchange_rate) : "",
      fx_amount: "",
      amount: "",
    });
  }

  function onCurrencyChange(i: number, currencyId: string) {
    const cur = currencies.find((c) => c.id === currencyId);
    updateLine(i, { currency_id: currencyId, exchange_rate: cur ? String(cur.exchange_rate) : "", fx_amount: "", amount: "" });
  }

  function onFxAmountChange(i: number, fxAmount: string, rate: string) {
    const amount = (parseFloat(fxAmount) || 0) * (parseFloat(rate) || 0);
    updateLine(i, { fx_amount: fxAmount, amount: amount ? String(amount) : "" });
  }

  function onRateChange(i: number, rate: string, fxAmount: string) {
    const amount = (parseFloat(fxAmount) || 0) * (parseFloat(rate) || 0);
    updateLine(i, { exchange_rate: rate, amount: amount ? String(amount) : "" });
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  async function openEditForm(entry: Entry) {
    setError("");
    const { data: entryLines } = await supabase
      .from("journal_lines")
      .select("id, account_id, debit, credit, description, currency_id, fx_amount, exchange_rate")
      .eq("entry_id", entry.id);

    setEditingId(entry.id);
    setDate(entry.entry_date);
    setDescription(entry.description || "");
    setLines(
      (entryLines || []).map((l: any) => ({
        id: l.id,
        account_id: l.account_id,
        side: Number(l.debit) > 0 ? "debit" : "credit",
        currency_id: l.currency_id || "",
        fx_amount: l.fx_amount ? String(l.fx_amount) : "",
        exchange_rate: l.exchange_rate ? String(l.exchange_rate) : "",
        amount: String(Number(l.debit) > 0 ? l.debit : l.credit),
        description: l.description || "",
      }))
    );
    setShowForm(true);
  }

  async function saveEntry(post: boolean) {
    if (!org) return;
    setError("");
    if (post && !balanced) {
      setError("لا يمكن ترحيل القيد: مجموع المدين يجب أن يساوي مجموع الدائن بالعملة الأساسية");
      return;
    }
    setBusy(true);

    const validLines = lines.filter((l) => l.account_id && parseFloat(l.amount) > 0);

    let entryId = editingId;

    if (editingId) {
      const { error: updErr } = await supabase
        .from("journal_entries")
        .update({ entry_date: date, description })
        .eq("id", editingId);
      if (updErr) {
        setError("خطأ: " + updErr.message);
        setBusy(false);
        return;
      }
      await supabase.from("journal_lines").delete().eq("entry_id", editingId);
    } else {
      const { data: entry, error: entErr } = await supabase
        .from("journal_entries")
        .insert({
          org_id: org.id,
          entry_date: date,
          description,
          status: "مسودة",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (entErr || !entry) {
        setError("خطأ: " + entErr?.message);
        setBusy(false);
        return;
      }
      entryId = entry.id;
    }

    await supabase.from("journal_lines").insert(
      validLines.map((l) => ({
        entry_id: entryId,
        account_id: l.account_id,
        debit: l.side === "debit" ? parseFloat(l.amount) || 0 : 0,
        credit: l.side === "credit" ? parseFloat(l.amount) || 0 : 0,
        description: l.description || null,
        currency_id: l.currency_id || null,
        fx_amount: l.currency_id ? parseFloat(l.fx_amount) || null : null,
        exchange_rate: l.currency_id ? parseFloat(l.exchange_rate) || null : null,
      }))
    );

    if (post) {
      const { error: postErr } = await supabase
        .from("journal_entries")
        .update({ status: "مرحل" })
        .eq("id", entryId as string);
      if (postErr) {
        setError("تم الحفظ كمسودة، لكن تعذّر الترحيل: " + postErr.message);
        setBusy(false);
        load();
        return;
      }
    }

    resetForm();
    setBusy(false);
    load();
  }

  async function revertToDraft(id: string) {
    await supabase.from("journal_entries").update({ status: "مسودة" }).eq("id", id);
    load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا القيد؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    await supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString(), status: "ملغى" })
      .eq("id", id);
    load();
  }

  const statusLabel: Record<string, string> = { "مسودة": "مسودة", "مرحل": "مرحّل", "ملغى": "ملغى" };
  const statusColor: Record<string, string> = {
    "مسودة": "bg-amber-100 text-amber-800",
    "مرحل": "bg-forest-100 text-forest-800",
    "ملغى": "bg-red-100 text-red-800",
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">القيود المحاسبية</h1>
          <p className="text-forest-800/60 text-sm mt-1">كل طرف يمكن أن يكون بعملة مختلفة — التوازن يُحسب بالعملة الأساسية</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button
            className="btn-secondary"
            onClick={() =>
              exportToExcel(
                "القيود_المحاسبية",
                "القيود",
                entries.map((e) => ({
                  "رقم القيد": e.entry_number,
                  "التاريخ": e.entry_date,
                  "الوصف": e.description || "",
                  "الحالة": statusLabel[e.status],
                }))
              )
            }
          >
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("journal-table", "القيود_المحاسبية")}>
            تصدير PDF
          </button>
          <button className="btn-primary" onClick={() => (showForm ? resetForm() : openNewForm())}>
            {showForm ? "إلغاء" : "+ قيد جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 no-print">
          {editingId && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              أنت تعدّل قيداً موجوداً. سيتم استبدال كل أسطره بما تكتبه الآن.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">التاريخ</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">الوصف</label>
              <input
                className="input"
                placeholder="مثال: مصارفة ريال سعودي مقابل ريال يمني"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="border border-forest-100 rounded-lg p-3">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                  <select
                    className="input sm:col-span-2"
                    value={l.account_id}
                    onChange={(e) => onAccountChange(i, e.target.value)}
                  >
                    <option value="">اختر الحساب...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                  <select className="input" value={l.side} onChange={(e) => updateLine(i, { side: e.target.value as "debit" | "credit" })}>
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                  <select className="input" value={l.currency_id} onChange={(e) => onCurrencyChange(i, e.target.value)}>
                    <option value="">العملة الأساسية</option>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>

                  {!l.currency_id && (
                    <input
                      className="input sm:col-span-2"
                      type="number"
                      step="0.01"
                      placeholder="المبلغ"
                      value={l.amount}
                      onChange={(e) => updateLine(i, { amount: e.target.value })}
                    />
                  )}
                  {l.currency_id && (
                    <>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        placeholder="المبلغ بعملة السطر"
                        value={l.fx_amount}
                        onChange={(e) => onFxAmountChange(i, e.target.value, l.exchange_rate)}
                        dir="ltr"
                      />
                      <input
                        className="input"
                        type="number"
                        step="0.0001"
                        placeholder="سعر الصرف"
                        value={l.exchange_rate}
                        onChange={(e) => onRateChange(i, e.target.value, l.fx_amount)}
                      />
                    </>
                  )}

                  <button
                    className="text-red-600 text-sm"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length <= 2}
                  >
                    حذف السطر
                  </button>
                </div>
                {l.currency_id && (
                  <p className="text-xs text-forest-800/60 mt-2">
                    المعادل بالعملة الأساسية: <span className="font-medium">{(parseFloat(l.amount) || 0).toLocaleString("ar")}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            className="text-sm text-forest-600 mt-3"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + إضافة سطر
          </button>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-forest-50">
            <div className="text-sm">
              <span className="text-forest-800/60">مدين: </span>
              <span className="font-medium">{totalDebit.toLocaleString("ar")}</span>
              <span className="text-forest-800/60 mx-2">|</span>
              <span className="text-forest-800/60">دائن: </span>
              <span className="font-medium">{totalCredit.toLocaleString("ar")}</span>
              {!balanced && totalDebit + totalCredit > 0 && (
                <span className="text-red-600 mr-3">القيد غير متوازن</span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={busy} onClick={() => saveEntry(false)}>
                حفظ كمسودة
              </button>
              <button className="btn-primary" disabled={busy || !balanced} onClick={() => saveEntry(true)}>
                {editingId ? "حفظ وترحيل" : "ترحيل القيد"}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}

      <div id="journal-table" className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>رقم</th>
              <th>التاريخ</th>
              <th>الوصف</th>
              <th>الحالة</th>
              <th className="no-print">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-forest-800/70">#{e.entry_number}</td>
                <td>{e.entry_date}</td>
                <td>{e.description || "—"}</td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[e.status]}`}>
                    {statusLabel[e.status]}
                  </span>
                </td>
                <td className="no-print">
                  <div className="flex gap-3 text-sm">
                    {e.status === "مسودة" && (
                      <button className="text-forest-600 hover:underline" onClick={() => openEditForm(e)}>
                        تعديل
                      </button>
                    )}
                    {e.status === "مرحل" && (
                      <button className="text-amber-700 hover:underline" onClick={() => revertToDraft(e.id)}>
                        تراجع لمسودة
                      </button>
                    )}
                    <button className="text-red-600 hover:underline" onClick={() => deleteEntry(e.id)}>
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-forest-800/50">
                  لا توجد قيود بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
