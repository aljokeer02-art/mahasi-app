"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string; category: string; opening_balance: number };

export default function YearEndClosingPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [closingDate, setClosingDate] = useState(new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10));
  const [retainedEarningsId, setRetainedEarningsId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    netIncome: number;
    newBalances: { code: string; name: string; category: string; oldBalance: number; newBalance: number }[];
    entriesToArchive: number;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!org) return;
    supabase
      .from("accounts")
      .select("id, code, name, category, opening_balance")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .order("code")
      .then((r) => setAccounts(r.data || []));
  }, [org]);

  const equityAccounts = accounts.filter((a) => a.category === "حقوق_ملكية");

  async function loadPreview() {
    if (!org || !retainedEarningsId) return;
    setPreviewLoading(true);

    const { data: lines } = await supabase
      .from("journal_lines")
      .select("account_id, debit, credit, journal_entries!inner(entry_date, status, org_id, deleted_at)")
      .eq("journal_entries.org_id", org.id)
      .eq("journal_entries.status", "مرحل")
      .is("journal_entries.deleted_at", null)
      .lte("journal_entries.entry_date", closingDate);

    const totals: Record<string, number> = {};
    (lines || []).forEach((l: any) => {
      if (!totals[l.account_id]) totals[l.account_id] = 0;
      totals[l.account_id] += Number(l.debit) - Number(l.credit);
    });

    let revenue = 0;
    let expenses = 0;
    const newBalances: { code: string; name: string; category: string; oldBalance: number; newBalance: number }[] = [];

    accounts.forEach((a) => {
      const movement = totals[a.id] || 0;
      if (a.category === "ايرادات") revenue += -movement;
      else if (a.category === "مصروفات") expenses += movement;
      else {
        let newBalance = Number(a.opening_balance) + movement;
        newBalances.push({ code: a.code, name: a.name, category: a.category, oldBalance: Number(a.opening_balance), newBalance });
      }
    });

    const netIncome = revenue - expenses;
    const retained = newBalances.find((b) => accounts.find((a) => a.code === b.code)?.id === retainedEarningsId);
    if (retained) retained.newBalance += netIncome;

    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "مرحل")
      .is("deleted_at", null)
      .lte("entry_date", closingDate);

    setPreview({ netIncome, newBalances, entriesToArchive: count || 0 });
    setPreviewLoading(false);
  }

  async function executeClosing() {
    if (!org || !preview) return;
    setBusy(true);

    for (const b of preview.newBalances) {
      const acc = accounts.find((a) => a.code === b.code);
      if (acc) await supabase.from("accounts").update({ opening_balance: b.newBalance }).eq("id", acc.id);
    }
    for (const a of accounts.filter((a) => a.category === "ايرادات" || a.category === "مصروفات")) {
      await supabase.from("accounts").update({ opening_balance: 0 }).eq("id", a.id);
    }

    await supabase
      .from("journal_entries")
      .update({ status: "ملغى", deleted_at: new Date().toISOString() })
      .eq("org_id", org.id)
      .eq("status", "مرحل")
      .is("deleted_at", null)
      .lte("entry_date", closingDate);

    setBusy(false);
    setDone(true);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">إغلاق السنة المالية</h1>
        <p className="text-forest-800/60 text-sm mt-1">
          ترحيل أرصدة الأصول والخصوم وحقوق الملكية للسنة الجديدة، وأرشفة قيود السنة المنتهية
        </p>
      </div>

      {done ? (
        <div className="card p-6 bg-forest-50 text-center">
          <p className="text-lg font-medium mb-2">✓ تم إغلاق السنة بنجاح</p>
          <p className="text-forest-800/70 text-sm">
            الأرصدة الافتتاحية للحسابات محدَّثة الآن، والقيود حتى {closingDate} تمت أرشفتها ولن تظهر في التقارير القادمة.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">تاريخ إغلاق السنة</label>
              <input type="date" className="input" value={closingDate} onChange={(e) => { setClosingDate(e.target.value); setPreview(null); }} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-forest-800/70 block mb-1">حساب الأرباح المرحّلة (من حقوق الملكية)</label>
              <select className="input" value={retainedEarningsId} onChange={(e) => { setRetainedEarningsId(e.target.value); setPreview(null); }}>
                <option value="">اختر حساباً...</option>
                {equityAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <button onClick={loadPreview} disabled={!retainedEarningsId || previewLoading} className="btn-primary sm:col-span-3">
              {previewLoading ? "جارِ الحساب..." : "معاينة الإغلاق"}
            </button>
          </div>

          {preview && (
            <>
              <div className="card p-5 mb-6 bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-800 mb-2">⚠ تنبيه هام قبل المتابعة</p>
                <ul className="text-sm text-amber-800 space-y-1 list-disc pr-5">
                  <li>سيتم تحديث الرصيد الافتتاحي لكل حساب أصول/خصوم/حقوق ملكية ليعكس رصيده الختامي.</li>
                  <li>صافي الدخل ({preview.netIncome.toLocaleString("ar")}) سيُضاف لحساب الأرباح المرحّلة المختار.</li>
                  <li>سيتم أرشفة {preview.entriesToArchive} قيداً (بتاريخ {closingDate} أو قبله) — لن تظهر في أي تقرير بعد الآن.</li>
                  <li>هذا الإجراء لا يمكن التراجع عنه تلقائياً من الواجهة.</li>
                </ul>
              </div>

              <div className="card overflow-hidden mb-6">
                <table className="w-full table-base">
                  <thead>
                    <tr><th>الحساب</th><th>الرصيد الحالي</th><th>الرصيد الجديد</th></tr>
                  </thead>
                  <tbody>
                    {preview.newBalances.map((b) => (
                      <tr key={b.code}>
                        <td className="font-medium">{b.code} - {b.name}</td>
                        <td>{b.oldBalance.toLocaleString("ar")}</td>
                        <td className="font-medium">{b.newBalance.toLocaleString("ar")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card p-5">
                <label className="text-sm text-forest-800/70 block mb-2">
                  اكتب كلمة <span className="font-mono font-medium">تأكيد</span> للمتابعة
                </label>
                <input className="input mb-3" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                <button
                  onClick={executeClosing}
                  disabled={confirmText !== "تأكيد" || busy}
                  className="btn-primary w-full bg-red-700 hover:bg-red-800"
                >
                  {busy ? "جارِ التنفيذ..." : "تنفيذ الإغلاق نهائياً"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
