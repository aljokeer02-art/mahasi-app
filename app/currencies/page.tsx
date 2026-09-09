"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Currency = { id: string; code: string; name: string; symbol: string | null; is_base: boolean; exchange_rate: number };

const emptyForm = { code: "", name: "", symbol: "", exchange_rate: "1" };

export default function CurrenciesPage() {
  const { org } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});

  async function load() {
    if (!org) return;
    const { data } = await supabase.from("currencies").select("*").eq("org_id", org.id).order("is_base", { ascending: false });
    setCurrencies(data || []);
    setRateEdits({});
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

  function openEditForm(c: Currency) {
    setForm({ code: c.code, name: c.name, symbol: c.symbol || "", exchange_rate: String(c.exchange_rate) });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function saveCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    const payload = {
      code: form.code.toUpperCase(),
      name: form.name,
      symbol: form.symbol,
      exchange_rate: parseFloat(form.exchange_rate || "1"),
    };
    if (editingId) {
      await supabase.from("currencies").update(payload).eq("id", editingId);
    } else {
      await supabase.from("currencies").insert({ org_id: org.id, ...payload, is_base: false });
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setBusy(false);
    load();
  }

  function rateValue(c: Currency) {
    return rateEdits[c.id] !== undefined ? rateEdits[c.id] : String(c.exchange_rate);
  }

  async function saveRate(c: Currency) {
    const value = parseFloat(rateEdits[c.id] || String(c.exchange_rate));
    await supabase.from("currencies").update({ exchange_rate: value }).eq("id", c.id);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">العملات</h1>
          <p className="text-forest-800/60 text-sm mt-1">العملة الأساسية وأي عملات إضافية، مع إمكانية تحديث سعر الصرف وقتما تحتاج</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ عملة جديدة"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveCurrency} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
          <input className="input" placeholder="الرمز (USD)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required dir="ltr" disabled={!!editingId} />
          <input className="input" placeholder="الاسم (دولار أمريكي)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="العلامة ($)" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
          <input className="input" type="number" step="0.0001" placeholder="سعر الصرف مقابل العملة الأساسية" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-4">
            {busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ"}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>الرمز</th><th>الاسم</th><th>العلامة</th><th>سعر الصرف</th><th>أساسية؟</th><th className="no-print">إجراءات</th></tr>
          </thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono" dir="ltr">{c.code}</td>
                <td className="font-medium">{c.name}</td>
                <td>{c.symbol || "—"}</td>
                <td>
                  {c.is_base ? (
                    "1 (ثابت)"
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        className="input max-w-[120px] no-print"
                        value={rateValue(c)}
                        onChange={(e) => setRateEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      />
                      <span className="hidden print:inline">{c.exchange_rate}</span>
                      {rateEdits[c.id] !== undefined && parseFloat(rateEdits[c.id]) !== c.exchange_rate && (
                        <button className="text-forest-600 text-xs no-print" onClick={() => saveRate(c)}>حفظ</button>
                      )}
                    </div>
                  )}
                </td>
                <td>{c.is_base ? "✓ أساسية" : "—"}</td>
                <td className="no-print">
                  {!c.is_base && (
                    <button className="text-forest-600 hover:underline text-sm" onClick={() => openEditForm(c)}>تعديل</button>
                  )}
                </td>
              </tr>
            ))}
            {currencies.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-forest-800/50">لا توجد عملات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
