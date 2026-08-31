"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string; opening_balance: number };
type Line = { entry_date: string; description: string | null; debit: number; credit: number; entry_number: number };

export default function AccountStatementPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [opening, setOpening] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org) return;
    supabase
      .from("accounts")
      .select("id, code, name, opening_balance")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .order("code")
      .then((r) => setAccounts(r.data || []));
  }, [org]);

  async function loadStatement() {
    if (!accountId) return;
    setLoading(true);
    const acc = accounts.find((a) => a.id === accountId);
    setOpening(acc ? Number(acc.opening_balance) : 0);

    let query = supabase
      .from("journal_lines")
      .select("debit, credit, description, journal_entries!inner(entry_date, entry_number, status, org_id)")
      .eq("account_id", accountId)
      .eq("journal_entries.status", "مرحل");

    if (fromDate) query = query.gte("journal_entries.entry_date", fromDate);
    if (toDate) query = query.lte("journal_entries.entry_date", toDate);

    const { data } = await query;
    const rows: Line[] = (data || [])
      .map((l: any) => ({
        entry_date: l.journal_entries.entry_date,
        entry_number: l.journal_entries.entry_number,
        description: l.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    setLines(rows);
    setLoading(false);
  }

  let running = opening;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">كشف حساب</h1>
        <p className="text-forest-800/60 text-sm mt-1">تفاصيل كل حركة على حساب معيّن مع الرصيد المتحرك</p>
      </div>

      <div className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select className="input sm:col-span-2" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">اختر الحساب...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
          ))}
        </select>
        <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="من تاريخ" />
        <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="إلى تاريخ" />
        <button onClick={loadStatement} disabled={!accountId} className="btn-primary sm:col-span-4">
          عرض الكشف
        </button>
      </div>

      {accountId && (
        <div className="card overflow-hidden">
          <table className="w-full table-base">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>رقم القيد</th>
                <th>البيان</th>
                <th>مدين</th>
                <th>دائن</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="font-medium">الرصيد الافتتاحي</td>
                <td className="font-medium">{opening.toLocaleString("ar")}</td>
              </tr>
              {loading && (
                <tr><td colSpan={6} className="text-center py-8 text-forest-800/50">جارِ التحميل...</td></tr>
              )}
              {!loading && lines.map((l, i) => {
                running += l.debit - l.credit;
                return (
                  <tr key={i}>
                    <td>{l.entry_date}</td>
                    <td className="font-mono text-forest-800/70">#{l.entry_number}</td>
                    <td>{l.description || "—"}</td>
                    <td>{l.debit ? l.debit.toLocaleString("ar") : "—"}</td>
                    <td>{l.credit ? l.credit.toLocaleString("ar") : "—"}</td>
                    <td className="font-medium">{running.toLocaleString("ar")}</td>
                  </tr>
                );
              })}
              {!loading && lines.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-forest-800/50">لا توجد حركات في هذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
