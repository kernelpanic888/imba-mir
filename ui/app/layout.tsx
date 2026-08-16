import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMBA / MIR — One Tick, One World",
  description: "A bilingual video game and mathematics project whose living World runs on Lean 4.",
  openGraph: {
    title: "IMBA / MIR — One Raven, One Road, a Living World",
    description: "Formal expressions become observable actions on the road to the Emerald Castle.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1728,
        height: 910,
        alt: "The digital Raven on the green road to the Emerald Castle",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IMBA / MIR — One Raven, One Road, a Living World",
    description: "Formal expressions become observable actions on the road to the Emerald Castle.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
