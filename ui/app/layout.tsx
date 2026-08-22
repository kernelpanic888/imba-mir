import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://imba-mir-aleksey.kernelpanic888.chatgpt.site";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "IMBA / MIR",
  alternateName: "IMBA / МИР",
  url: `${siteUrl}/`,
  description:
    "A free bilingual browser game where formal expressions become observable actions in a living procedural world.",
  image: `${siteUrl}/og.png`,
  inLanguage: ["en", "ru"],
  gamePlatform: "Web browser",
  playMode: "SinglePlayer",
  isAccessibleForFree: true,
  author: {
    "@type": "Person",
    name: "Aleksey Salkutsan",
    url: "https://orcid.org/0009-0006-8717-0492",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "IMBA / MIR — One Tick, One World",
  description: "A bilingual video game and mathematics project whose living World runs on Lean 4.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "IMBA / MIR — One Raven, One Road, a Living World",
    description: "Formal expressions become observable actions on the road to the Emerald Castle.",
    type: "website",
    url: `${siteUrl}/`,
    siteName: "IMBA / MIR",
    locale: "en_US",
    alternateLocale: ["ru_RU"],
    images: [
      {
        url: `${siteUrl}/og.png`,
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
    images: [`${siteUrl}/og.png`],
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
