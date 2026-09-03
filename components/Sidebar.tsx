"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const linkGroups = [
  {
    title: "الرئيسية",
    links: [{ href: "/dashboard", label: "لوحة التحكم" }],
  },
  {
    title: "الإعداد",
    links: [
      { href: "/accounts", label: "دليل الحسابات" },
      { href: "/opening-balances", label: "الأرصدة الافتتاحية" },
      { href: "/currencies", label: "العملات" },
      { href: "/cash-bank", label: "الصناديق والبنوك" },
      { href: "/contacts", label: "العملاء والموردون" },
    ],
  },
  {
    title: "العمليات اليومية",
    links: [
      { href: "/journal", label: "القيود المحاسبية" },
      { href: "/vouchers/receipt", label: "سندات القبض" },
      { href: "/vouchers/payment", label: "سندات الصرف" },
      { href: "/debts-assets", label: "الديون والأصول" },
    ],
  },
  {
    title: "التقارير",
    links: [
      { href: "/reports", label: "ميزان المراجعة" },
      { href: "/reports/statement", label: "كشف حساب" },
      { href: "/reports/income", label: "قائمة الدخل" },
      { href: "/reports/balance-sheet", label: "الميزانية العمومية" },
    ],
  },
  {
    title: "الإدارة",
    links: [
      { href: "/users", label: "المستخدمون والصلاحيات" },
      { href: "/year-end-closing", label: "إغلاق السنة المالية" },
    ],
  },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, org, orgs, setOrgId, isPlatformAdmin } = useAuth();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden no-print" onClick={onClose} />
      )}

      <aside
        className={`fixed md:sticky top-0 right-0 h-screen w-72 md:w-64 bg-forest-900 text-forest-50 flex flex-col z-50 no-print
          transition-transform duration-200 md:translate-x-0
          ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gold rounded-lg flex items-center justify-center text-forest-900 font-bold">
              م
            </div>
            <div>
              <p className="font-medium leading-tight">محاسي</p>
              <p className="text-xs text-forest-50/50">نظام المحاسبة الشخصية</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-forest-50/70 hover:text-forest-50 text-xl leading-none">
            ✕
          </button>
        </div>

        {orgs.length > 1 && (
          <div className="px-4 pt-3">
            <select
              className="w-full bg-white/10 text-sm rounded-md px-2 py-1.5 text-forest-50"
              value={org?.id}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="text-ink">
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isPlatformAdmin && (
          <div className="px-4 pt-3 space-y-2">
            <Link href="/admin" onClick={onClose} className="block text-center text-xs bg-white/10 text-forest-50 border border-white/20 rounded-md py-1.5 hover:bg-white/20">
              🛠️ لوحة النظام
            </Link>
            <Link href="/onboarding" onClick={onClose} className="block text-center text-xs bg-gold/20 text-gold border border-gold/40 rounded-md py-1.5 hover:bg-gold/30">
              + إنشاء مساحة جديدة
            </Link>
          </div>
        )}

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {linkGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-3 text-[11px] font-medium text-forest-50/40 uppercase tracking-wider mb-1">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.links.map((l) => {
                  const active = pathname === l.href;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={onClose}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-white/15 font-medium"
                          : "text-forest-50/75 hover:bg-white/10 hover:text-forest-50"
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-sm truncate">{user?.user_metadata?.full_name || user?.email}</p>
          <p className="text-xs text-forest-50/50 truncate mb-2">{user?.email}</p>
          <button onClick={signOut} className="text-xs text-forest-50/60 hover:text-forest-50">
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
