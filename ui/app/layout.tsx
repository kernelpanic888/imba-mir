import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imba — Один тик, один Мир",
  description: "Одна стопка Imba растёт подтверждёнными тиками, пока её не перебьёт Природа.",
  openGraph: {
    title: "IMBA / МИР — Один Ворон, одна дорога, живой Мир",
    description: "Магические формулы становятся наблюдаемыми действиями на дороге к Изумрудному замку.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1728,
        height: 910,
        alt: "Цифровой Ворон на зелёной дороге к Изумрудному замку",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IMBA / МИР — Один Ворон, одна дорога, живой Мир",
    description: "Магические формулы становятся наблюдаемыми действиями на дороге к Изумрудному замку.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
