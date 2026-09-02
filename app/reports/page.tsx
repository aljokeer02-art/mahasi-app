"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Row = {
  id: string;
  code: string;
  name: string;
  category: string;
  opening: number;
  debit: number;
  credit: number;
  balance: number;
};

export default function ReportsPage() {
  const { org } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    (async () => {
      setLoading(true);
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, category, opening_balance")
        .eq("org_id", org.id)
        .is("deleted_at", null)
        .order("code");

      const { data: lines } = await supabase
        .from("journal_lines")
        .select("account_id, debit, credit, journal_entries!inner(status, org_id)")
        .eq("journal_entries.org_id", org.id)
        .eq("journal_entries.status", "مرحل");

      const totals: Record<string, { debit: number; credit: number }> = {};
      (lines || []).forEach((l: any) => {
        if (!totals[l.account_id]) totals[l.account_id] = { debit: 0, credit: 0 };
        totals[l.account_id].debit += Number(l.debit);
        totals[l.account_id].credit += Number(l.credit);
      });

      const result: Row[] = (accounts || []).map((a) => {
        const t = totals[a.id] || { debit: 0, credit: 0 };
        const opening = Number(a.opening_balance);
        const balance = opening + t.debit - t.credit;
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          category: a.category,
          opening,
          debit: t.debit,
          credit: t.credit,
          balance,
        };
      });
      setRows(result);
      setLoading(false);
    })();
  }, [org]);

  const totalDebit = rows.reduce((s, r) => s + r.debit + (r.opening > 0 ? r.opening : 0), 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit + (r.opening < 0 ? -r.opening : 0), 0);

  return (
    <AppShell>
      <div className="mb-6 no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">التقارير</h1>
          <p className="text-forest-800/60 text-sm mt-1">ميزان المراجعة — يشمل القيود المرحّلة فقط</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button
            className="btn-secondary"
            onClick={() =>
              exportToExcel(
                "ميزان_المراجعة",
                "ميزان المراجعة",
                rows.map((r) => ({
                  "الرقم": r.code,
                  "الحساب": r.name,
                  "الرصيد الافتتاحي": r.opening,
                  "مدين": r.debit,
                  "دائن": r.credit,
                  "الرصيد الحالي": r.balance,
                }))
              )
            }
          >
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("trial-balance-table", "ميزان_المراجعة")}>
            تصدير PDF
          </button>
        </div>
      </div>

      <div id="trial-balance-table" className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الحساب</th>
              <th>الرصيد الافتتاحي</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد الحالي</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-forest-800/50">جارِ التحميل...</td>
              </tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-forest-800/70">{r.code}</td>
                <td className="font-medium">{r.name}</td>
                <td>{r.opening.toLocaleString("ar")}</td>
                <td>{r.debit.toLocaleString("ar")}</td>
                <td>{r.credit.toLocaleString("ar")}</td>
                <td className="font-medium">{r.balance.toLocaleString("ar")}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-forest-800/50">لا توجد بيانات بعد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
