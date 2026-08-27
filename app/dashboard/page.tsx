"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-forest-800/60">{label}</p>
      <p className="text-2xl font-medium mt-1">{value}</p>
      {hint && <p className="text-xs text-forest-800/40 mt-1">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { org } = useAuth();
  const [stats, setStats] = useState({ accounts: 0, entries: 0, contacts: 0, cashTotal: 0 });

  useEffect(() => {
    if (!org) return;
    (async () => {
      const [accRes, entRes, conRes] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      ]);
      setStats({
        accounts: accRes.count || 0,
        entries: entRes.count || 0,
        contacts: conRes.count || 0,
        cashTotal: 0,
      });
    })();
  }, [org]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">لوحة التحكم</h1>
        <p className="text-forest-800/60 text-sm mt-1">نظرة عامة على وضعك المالي — {org?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="عدد الحسابات" value={String(stats.accounts)} />
        <StatCard label="عدد القيود" value={String(stats.entries)} />
        <StatCard label="العملاء والموردون" value={String(stats.contacts)} />
      </div>

      {stats.accounts === 0 && (
        <div className="card p-6">
          <p className="font-medium mb-1">ابدأ من هنا</p>
          <p className="text-sm text-forest-800/60 mb-4">
            لم يتم إنشاء أي حساب بعد. أنشئ دليل الحسابات أولاً (مثل: الصندوق، البنك، المصروفات)
            قبل تسجيل أي قيد.
          </p>
          <a href="/accounts" className="btn-primary inline-block">
            الانتقال إلى دليل الحسابات
          </a>
        </div>
      )}
    </AppShell>
  );
}
