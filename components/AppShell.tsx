"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, org, orgs, isPlatformAdmin } = useAuth();
  const router = useRouter();

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
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen p-6 md:p-8">{children}</main>
    </div>
  );
}
