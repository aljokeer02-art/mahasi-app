"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Account = { id: string; code: string; name: string; opening_balance: number };
type Contact = { id: string; name: string };
type Line = { entry_date: string; description: string | null; debit: number; credit: number; entry_number: number };

export default function AccountStatementPage() {
  const { org } = useAuth();
  const [mode, setMode] = useState<"account" | "contact">("account");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [opening, setOpening] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org) return;
    supabase.from("accounts").select("id, code, name, opening_balance").eq("org_id", org.id).is("deleted_at", null).order("code").then((r) => setAccounts(r.data || []));
    supabase.from("contacts").select("id, name").eq("org_id", org.id).is("deleted_at", null).order("name").then((r) => setContacts(r.data || []));
  }, [org]);

  async function loadStatement() {
    if (!selectedId) return;
    setLoading(true);

    let query = supabase
      .from("journal_lines")
      .select("debit, credit, description, account_id, journal_entries!inner(entry_date, entry_number, status, org_id)")
      .eq("journal_entries.status", "مرحل");

    if (mode === "account") {
      query = query.eq("account_id", selectedId);
      const acc = accounts.find((a) => a.id === selectedId);
      setOpening(acc ? Number(acc.opening_balance) : 0);
    } else {
      query = query.eq("contact_id", selectedId);
      setOpening(0);
    }

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
      <div className="mb-6 no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">كشف حساب</h1>
            <p className="text-forest-800/60 text-sm mt-1">تفاصيل كل حركة على حساب أو جهة اتصال معيّنة</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
            <button
              className="btn-secondary"
              onClick={() =>
                exportToExcel(
                  "كشف_حساب",
                  "كشف حساب",
                  lines.map((l) => ({
                    "التاريخ": l.entry_date,
                    "رقم القيد": l.entry_number,
                    "البيان": l.description || "",
                    "مدين": l.debit,
                    "دائن": l.credit,
                  }))
                )
              }
            >
              تصدير Excel
            </button>
            <button className="btn-secondary" onClick={() => exportElementToPdf("statement-table", "كشف_حساب")}>
              تصدير PDF
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
        <div className="sm:col-span-4 flex gap-2 bg-forest-50 rounded-lg p-1 w-fit">
          <button
            className={`px-4 py-1.5 rounded-md text-sm ${mode === "account" ? "bg-white shadow-sm font-medium" : "text-forest-800/60"}`}
            onClick={() => { setMode("account"); setSelectedId(""); }}
          >
            حسب الحساب
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm ${mode === "contact" ? "bg-white shadow-sm font-medium" : "text-forest-800/60"}`}
            onClick={() => { setMode("contact"); setSelectedId(""); }}
          >
            حسب العميل/المورد
          </button>
        </div>

        <select className="input sm:col-span-2" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">{mode === "account" ? "اختر الحساب..." : "اختر جهة الاتصال..."}</option>
          {mode === "account"
            ? accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)
            : contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="من تاريخ" />
        <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="إلى تاريخ" />
        <button onClick={loadStatement} disabled={!selectedId} className="btn-primary sm:col-span-4">
          عرض الكشف
        </button>
      </div>

      {selectedId && (
        <div id="statement-table" className="card overflow-hidden">
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
              {mode === "account" && (
                <tr>
                  <td colSpan={5} className="font-medium">الرصيد الافتتاحي</td>
                  <td className="font-medium">{opening.toLocaleString("ar")}</td>
                </tr>
              )}
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
