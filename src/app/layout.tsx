import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auditoria Diária | Victory",
  description: "Verificação diária de auditoria e logbooks — Victory Business, Victory Suites e Central de Reservas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
