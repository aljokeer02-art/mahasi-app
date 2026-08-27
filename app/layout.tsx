import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "محاسي | نظام المحاسبة العائلية",
  description: "نظام محاسبة سحابي متعدد المستخدمين للعائلة",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-sans bg-sand text-ink`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
