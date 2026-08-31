"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/accounts", label: "دليل الحسابات" },
  { href: "/contacts", label: "العملاء والموردون" },
  { href: "/journal", label: "القيود المحاسبية" },
  { href: "/vouchers/receipt", label: "سندات القبض" },
  { href: "/vouchers/payment", label: "سندات الصرف" },
  { href: "/cash-bank", label: "الصناديق والبنوك" },
  { href: "/debts-assets", label: "الديون والأصول" },
  { href: "/users", label: "المستخدمون والصلاحيات" },
  { href: "/reports", label: "ميزان المراجعة" },
  { href: "/reports/statement", label: "كشف حساب" },
  { href: "/reports/income", label: "قائمة الدخل" },
  { href: "/reports/balance-sheet", label: "الميزانية العمومية" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, org, orgs, setOrgId } = useAuth();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="w-64 bg-forest-900 text-forest-50 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gold rounded-lg flex items-center justify-center text-forest-900 font-bold">
            م
          </div>
          <div>
            <p className="font-medium leading-tight">محاسي</p>
            <p className="text-xs text-forest-50/50">نظام المحاسبة الشخصية</p>
          </div>
        </div>
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

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
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
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-sm truncate">{user?.user_metadata?.full_name || user?.email}</p>
        <p className="text-xs text-forest-50/50 truncate mb-2">{user?.email}</p>
        <button onClick={signOut} className="text-xs text-forest-50/60 hover:text-forest-50">
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
