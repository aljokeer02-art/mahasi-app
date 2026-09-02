"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Row = { code: string; name: string; amount: number };

export default function IncomeStatementPage() {
  const { org } = useAuth();
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [revenue, setRevenue] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!org) return;
    setLoading(true);

    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, code, name, category")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .in("category", ["ايرادات", "مصروفات"]);

    const { data: lines } = await supabase
      .from("journal_lines")
      .select("account_id, debit, credit, journal_entries!inner(entry_date, status, org_id)")
      .eq("journal_entries.org_id", org.id)
      .eq("journal_entries.status", "مرحل")
      .gte("journal_entries.entry_date", fromDate)
      .lte("journal_entries.entry_date", toDate);

    const totals: Record<string, number> = {};
    (lines || []).forEach((l: any) => {
      if (!totals[l.account_id]) totals[l.account_id] = 0;
      totals[l.account_id] += Number(l.credit) - Number(l.debit);
    });

    const rev: Row[] = [];
    const exp: Row[] = [];
    (accounts || []).forEach((a) => {
      const amount = totals[a.id] || 0;
      if (a.category === "ايرادات") rev.push({ code: a.code, name: a.name, amount });
      else exp.push({ code: a.code, name: a.name, amount: -amount });
    });

    setRevenue(rev);
    setExpenses(exp);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return (
    <AppShell>
      <div className="mb-6 no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">قائمة الدخل</h1>
          <p className="text-forest-800/60 text-sm mt-1">الإيرادات والمصروفات وصافي الدخل خلال فترة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button
            className="btn-secondary"
            onClick={() =>
              exportToExcel("قائمة_الدخل", "قائمة الدخل", [
                ...revenue.map((r) => ({ "البند": r.name, "النوع": "إيراد", "المبلغ": r.amount })),
                ...expenses.map((r) => ({ "البند": r.name, "النوع": "مصروف", "المبلغ": r.amount })),
                { "البند": "صافي الدخل", "النوع": "", "المبلغ": netIncome },
              ])
            }
          >
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("income-statement-table", "قائمة_الدخل")}>
            تصدير PDF
          </button>
        </div>
      </div>

      <div className="card p-5 mb-6 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="text-sm text-forest-800/70 block mb-1">من تاريخ</label>
          <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-forest-800/70 block mb-1">إلى تاريخ</label>
          <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary">تحديث</button>
      </div>

      {loading ? (
        <p className="text-forest-800/50 text-center py-8">جارِ التحميل...</p>
      ) : (
        <div className="space-y-6" id="income-statement-table">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-forest-50 font-medium">الإيرادات</div>
            <table className="w-full table-base">
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.code}><td className="font-mono text-forest-800/70">{r.code}</td><td>{r.name}</td><td>{r.amount.toLocaleString("ar")}</td></tr>
                ))}
                <tr className="font-medium"><td colSpan={2}>إجمالي الإيرادات</td><td>{totalRevenue.toLocaleString("ar")}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-forest-50 font-medium">المصروفات</div>
            <table className="w-full table-base">
              <tbody>
                {expenses.map((r) => (
                  <tr key={r.code}><td className="font-mono text-forest-800/70">{r.code}</td><td>{r.name}</td><td>{r.amount.toLocaleString("ar")}</td></tr>
                ))}
                <tr className="font-medium"><td colSpan={2}>إجمالي المصروفات</td><td>{totalExpenses.toLocaleString("ar")}</td></tr>
              </tbody>
            </table>
          </div>

          <div className={`card p-5 flex items-center justify-between ${netIncome >= 0 ? "bg-forest-50" : "bg-red-50"}`}>
            <span className="font-medium">صافي الدخل</span>
            <span className={`text-xl font-medium ${netIncome >= 0 ? "text-forest-800" : "text-red-700"}`}>
              {netIncome.toLocaleString("ar")}
            </span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
