"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Currency = { id: string; code: string; name: string; symbol: string | null; is_base: boolean; exchange_rate: number };

export default function CurrenciesPage() {
  const { org } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", exchange_rate: "1" });

  async function load() {
    if (!org) return;
    const { data } = await supabase.from("currencies").select("*").eq("org_id", org.id).order("is_base", { ascending: false });
    setCurrencies(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function addCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    await supabase.from("currencies").insert({
      org_id: org.id,
      code: form.code.toUpperCase(),
      name: form.name,
      symbol: form.symbol,
      exchange_rate: parseFloat(form.exchange_rate || "1"),
      is_base: false,
    });
    setForm({ code: "", name: "", symbol: "", exchange_rate: "1" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">العملات</h1>
          <p className="text-forest-800/60 text-sm mt-1">العملة الأساسية وأي عملات إضافية تتعامل بها</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "إلغاء" : "+ عملة جديدة"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addCurrency} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input className="input" placeholder="الرمز (USD)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required dir="ltr" />
          <input className="input" placeholder="الاسم (دولار أمريكي)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="العلامة ($)" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
          <input className="input" type="number" step="0.0001" placeholder="سعر الصرف مقابل العملة الأساسية" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-4">{busy ? "جارِ الحفظ..." : "حفظ"}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr><th>الرمز</th><th>الاسم</th><th>العلامة</th><th>سعر الصرف</th><th>أساسية؟</th></tr>
          </thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono" dir="ltr">{c.code}</td>
                <td className="font-medium">{c.name}</td>
                <td>{c.symbol || "—"}</td>
                <td>{c.exchange_rate}</td>
                <td>{c.is_base ? "✓ أساسية" : "—"}</td>
              </tr>
            ))}
            {currencies.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-forest-800/50">لا توجد عملات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
