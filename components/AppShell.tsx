"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, org, orgs, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (orgs.length === 0) router.replace(isPlatformAdmin ? "/onboarding" : "/no-access");
  }, [user, loading, orgs, isPlatformAdmin, router]);

  if (loading || !user || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-forest-800/60 text-sm">جارِ التحميل...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden no-print sticky top-0 z-30 bg-white border-b border-forest-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="فتح القائمة"
            className="text-forest-900 text-2xl leading-none px-1"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">محاسي</span>
            <div className="w-7 h-7 bg-forest-600 rounded-md flex items-center justify-center text-white text-sm font-bold">
              م
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
