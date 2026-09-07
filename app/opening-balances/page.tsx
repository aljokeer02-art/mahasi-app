"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = { id: string; code: string; name: string; category: string };
type Currency = { id: string; code: string; name: string };
type Balance = { id: string; account_id: string; currency_id: string | null; opening_balance: number };

const categoryLabels: Record<string, string> = {
  اصول: "الأصول",
  خصوم: "الخصوم",
  حقوق_ملكية: "حقوق الملكية",
  ايرادات: "الإيرادات",
  مصروفات: "المصروفات",
};
const categoryOrder = ["اصول", "خصوم", "حقوق_ملكية", "ايرادات", "مصروفات"];

export default function OpeningBalancesPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({}); // key = balance.id
  const [newCurrencyPick, setNewCurrencyPick] = useState<Record<string, string>>({}); // key = account.id
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!org) return;
    setLoading(true);
    const [accRes, curRes, balRes] = await Promise.all([
      supabase.from("accounts").select("id, code, name, category").eq("org_id", org.id).is("deleted_at", null).order("code"),
      supabase.from("currencies").select("id, code, name").eq("org_id", org.id),
      supabase.from("account_balances").select("id, account_id, currency_id, opening_balance").eq("org_id", org.id),
    ]);
    setAccounts(accRes.data || []);
    setCurrencies(curRes.data || []);
    setBalances(balRes.data || []);
    setEdits({});
    setNewCurrencyPick({});
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function valueFor(b: Balance) {
    return edits[b.id] !== undefined ? edits[b.id] : String(b.opening_balance);
  }

  const changedIds = Object.keys(edits).filter((id) => {
    const b = balances.find((x) => x.id === id);
    return b && parseFloat(edits[id] || "0") !== Number(b.opening_balance);
  });

  async function saveAll() {
    setSaving(true);
    setMessage("");
    for (const id of changedIds) {
      await supabase.from("account_balances").update({ opening_balance: parseFloat(edits[id] || "0") }).eq("id", id);
    }
    setMessage(`تم حفظ ${changedIds.length} سطر بنجاح`);
    setSaving(false);
    load();
  }

  async function addCurrencyRow(accountId: string) {
    if (!org) return;
    const currencyId = newCurrencyPick[accountId];
    const alreadyExists = balances.some((b) => b.account_id === accountId && (b.currency_id || "") === (currencyId || ""));
    if (alreadyExists) {
      alert("هذه العملة مضافة بالفعل لهذا الحساب.");
      return;
    }
    await supabase.from("account_balances").insert({
      org_id: org.id,
      account_id: accountId,
      currency_id: currencyId || null,
      opening_balance: 0,
    });
    setNewCurrencyPick((prev) => ({ ...prev, [accountId]: "" }));
    load();
  }

  async function removeCurrencyRow(balanceId: string) {
    if (!confirm("حذف رصيد هذه العملة من الحساب؟")) return;
    await supabase.from("account_balances").delete().eq("id", balanceId);
    load();
  }

  function currencyLabel(id: string | null) {
    if (!id) return "الأساسية";
    return currencies.find((c) => c.id === id)?.code || "—";
  }

  function totalFor(category: string) {
    // نجمع فقط أرصدة العملة الأساسية للتحقق من التوازن (الأصول = الخصوم + حقوق الملكية)
    return accounts
      .filter((a) => a.category === category)
      .reduce((sum, a) => {
        const baseBalance = balances.find((b) => b.account_id === a.id && b.currency_id === null);
        return sum + (baseBalance ? parseFloat(valueFor(baseBalance) || "0") : 0);
      }, 0);
  }

  const totalAssets = totalFor("اصول");
  const totalLiabilities = totalFor("خصوم");
  const totalEquity = totalFor("حقوق_ملكية");
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">الأرصدة الافتتاحية</h1>
          <p className="text-forest-800/60 text-sm mt-1">
            أضف أي عدد من العملات لكل حساب — مثال: "البنك" برصيد سعودي ورصيد يمني معاً
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button onClick={saveAll} disabled={saving || changedIds.length === 0} className="btn-primary">
            {saving ? "جارِ الحفظ..." : `حفظ التغييرات ${changedIds.length > 0 ? `(${changedIds.length})` : ""}`}
          </button>
        </div>
      </div>

      {message && <p className="text-forest-600 text-sm mb-4">{message}</p>}

      {loading ? (
        <p className="text-forest-800/50 text-center py-8">جارِ التحميل...</p>
      ) : (
        <div className="space-y-6">
          {categoryOrder.map((cat) => {
            const catAccounts = accounts.filter((a) => a.category === cat);
            if (catAccounts.length === 0) return null;
            return (
              <div key={cat} className="card overflow-hidden">
                <div className="px-4 py-3 bg-forest-50 font-medium">{categoryLabels[cat]}</div>
                <div className="divide-y divide-forest-50">
                  {catAccounts.map((a) => {
                    const accBalances = balances.filter((b) => b.account_id === a.id);
                    return (
                      <div key={a.id} className="p-4">
                        <p className="font-medium mb-2">
                          <span className="font-mono text-forest-800/70 text-sm ml-2">{a.code}</span>
                          {a.name}
                        </p>
                        <div className="space-y-2">
                          {accBalances.map((b) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <span className="text-sm w-24 text-forest-800/60">{currencyLabel(b.currency_id)}</span>
                              <input
                                type="number"
                                step="0.01"
                                className="input max-w-[160px] no-print"
                                value={valueFor(b)}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              />
                              <span className="hidden print:inline">{Number(valueFor(b)).toLocaleString("ar")}</span>
                              {b.currency_id !== null && (
                                <button className="text-red-600 text-xs no-print" onClick={() => removeCurrencyRow(b.id)}>
                                  حذف
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2 no-print">
                          <select
                            className="input max-w-[180px] text-sm"
                            value={newCurrencyPick[a.id] || ""}
                            onChange={(e) => setNewCurrencyPick((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          >
                            <option value="">+ أضف عملة أخرى...</option>
                            {currencies.map((c) => (
                              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                          </select>
                          <button className="text-forest-600 text-sm" onClick={() => addCurrencyRow(a.id)}>
                            إضافة
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="card p-8 text-center text-forest-800/50">
              لا توجد حسابات بعد. أنشئ دليل الحسابات أولاً.
            </div>
          )}

          {accounts.length > 0 && (
            <div className={`card p-5 ${balanced ? "bg-forest-50" : "bg-amber-50"}`}>
              <p className="text-xs text-forest-800/50 mb-2">
                (التحقق من التوازن يعتمد على أرصدة العملة الأساسية فقط)
              </p>
              <div className="flex justify-between text-sm mb-1">
                <span>إجمالي الأصول</span>
                <span className="font-medium">{totalAssets.toLocaleString("ar")}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>إجمالي الخصوم + حقوق الملكية</span>
                <span className="font-medium">{(totalLiabilities + totalEquity).toLocaleString("ar")}</span>
              </div>
              <div className="border-t border-forest-100 mt-2 pt-2 text-sm">
                {balanced ? (
                  <span className="text-forest-800">✓ الأرصدة الافتتاحية متوازنة</span>
                ) : (
                  <span className="text-amber-800">
                    ⚠ فرق قدره {(totalAssets - (totalLiabilities + totalEquity)).toLocaleString("ar")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
