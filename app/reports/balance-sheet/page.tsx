"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Row = { code: string; name: string; amount: number };

export default function BalanceSheetPage() {
  const { org } = useAuth();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [assets, setAssets] = useState<Row[]>([]);
  const [liabilities, setLiabilities] = useState<Row[]>([]);
  const [equity, setEquity] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!org) return;
    setLoading(true);

    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, code, name, category, opening_balance")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .in("category", ["اصول", "خصوم", "حقوق_ملكية"]);

    const { data: lines } = await supabase
      .from("journal_lines")
      .select("account_id, debit, credit, journal_entries!inner(entry_date, status, org_id)")
      .eq("journal_entries.org_id", org.id)
      .eq("journal_entries.status", "مرحل")
      .lte("journal_entries.entry_date", asOfDate);

    const totals: Record<string, number> = {};
    (lines || []).forEach((l: any) => {
      if (!totals[l.account_id]) totals[l.account_id] = 0;
      totals[l.account_id] += Number(l.debit) - Number(l.credit);
    });

    const a: Row[] = [];
    const l: Row[] = [];
    const e: Row[] = [];
    (accounts || []).forEach((acc) => {
      const balance = Number(acc.opening_balance) + (totals[acc.id] || 0);
      if (acc.category === "اصول") a.push({ code: acc.code, name: acc.name, amount: balance });
      else if (acc.category === "خصوم") l.push({ code: acc.code, name: acc.name, amount: -balance });
      else e.push({ code: acc.code, name: acc.name, amount: -balance });
    });

    setAssets(a);
    setLiabilities(l);
    setEquity(e);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">الميزانية العمومية</h1>
        <p className="text-forest-800/60 text-sm mt-1">الأصول والخصوم وحقوق الملكية في لحظة معينة</p>
      </div>

      <div className="card p-5 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-forest-800/70 block mb-1">كما في تاريخ</label>
          <input type="date" className="input" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary">تحديث</button>
      </div>

      {loading ? (
        <p className="text-forest-800/50 text-center py-8">جارِ التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-forest-50 font-medium">الأصول</div>
            <table className="w-full table-base">
              <tbody>
                {assets.map((r) => (
                  <tr key={r.code}><td className="font-mono text-forest-800/70">{r.code}</td><td>{r.name}</td><td>{r.amount.toLocaleString("ar")}</td></tr>
                ))}
                <tr className="font-medium"><td colSpan={2}>إجمالي الأصول</td><td>{totalAssets.toLocaleString("ar")}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-forest-50 font-medium">الخصوم</div>
              <table className="w-full table-base">
                <tbody>
                  {liabilities.map((r) => (
                    <tr key={r.code}><td className="font-mono text-forest-800/70">{r.code}</td><td>{r.name}</td><td>{r.amount.toLocaleString("ar")}</td></tr>
                  ))}
                  <tr className="font-medium"><td colSpan={2}>إجمالي الخصوم</td><td>{totalLiabilities.toLocaleString("ar")}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-forest-50 font-medium">حقوق الملكية</div>
              <table className="w-full table-base">
                <tbody>
                  {equity.map((r) => (
                    <tr key={r.code}><td className="font-mono text-forest-800/70">{r.code}</td><td>{r.name}</td><td>{r.amount.toLocaleString("ar")}</td></tr>
                  ))}
                  <tr className="font-medium"><td colSpan={2}>إجمالي حقوق الملكية</td><td>{totalEquity.toLocaleString("ar")}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className={`card p-4 mt-6 text-sm ${balanced ? "bg-forest-50 text-forest-800" : "bg-amber-50 text-amber-800"}`}>
          {balanced
            ? "✓ الميزانية متوازنة (الأصول = الخصوم + حقوق الملكية)"
            : "⚠ يوجد فرق بين الأصول ومجموع الخصوم وحقوق الملكية — تحقق من قيودك."}
        </div>
      )}
    </AppShell>
  );
}
