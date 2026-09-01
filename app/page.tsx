"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user, loading, orgs, isPlatformAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (orgs.length === 0) {
      router.replace(isPlatformAdmin ? "/onboarding" : "/no-access");
    } else {
      router.replace("/dashboard");
    }
  }, [user, loading, orgs, isPlatformAdmin, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-forest-800/60 text-sm">جارِ التحميل...</p>
    </div>
  );
}
