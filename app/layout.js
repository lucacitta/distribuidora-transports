import "./globals.css";

export const metadata = {
  title: "Generador de hojas de ruta · Pulqui",
  description: "Cargá las paradas y copiá la hoja de ruta lista para WhatsApp.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
