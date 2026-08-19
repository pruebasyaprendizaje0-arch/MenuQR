import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://menuqrpro.com";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MenuQR Pro | Menú Digital QR para Restaurantes en Ecuador",
    template: "%s | MenuQR Pro Ecuador",
  },
  description: "Crea el menú digital QR profesional para tu restaurante en Ecuador. Recibe pedidos completos por WhatsApp, configura mesas, IVA y servicio por solo $5 USD/mes con 30 días gratis.",
  keywords: [
    "Menú Digital QR Ecuador",
    "Carta Digital Restaurantes Quito",
    "Pedidos por WhatsApp Guayaquil",
    "Menu QR Cuenca",
    "SaaS Restaurantes Ecuador",
    "Menú QR gratis Ecuador",
    "Carta para restaurantes Ambato Manta Loja",
    "MenuQR Pro",
  ],
  authors: [{ name: "MenuQR Pro Ecuador" }],
  creator: "MenuQR Pro Ecuador",
  publisher: "MenuQR Pro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    title: "MenuQR Pro | Menú Digital QR para Restaurantes en Ecuador",
    description: "Digitaliza tu restaurante en Ecuador. Códigos QR para mesas, pedidos automáticos a WhatsApp y cero comisiones por venta. $5 USD/mes.",
    siteName: "MenuQR Pro Ecuador",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "MenuQR Pro Logo - Menú Digital QR Ecuador",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MenuQR Pro | Menú Digital QR para Restaurantes en Ecuador",
    description: "Crea tu menú QR interactivo y recibe pedidos por WhatsApp. El SaaS número 1 para restaurantes en Ecuador.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "geo.region": "EC",
    "geo.placename": "Ecuador",
    "icbm": "-1.831239, -78.183406",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Global SoftwareApplication and Organization Schema for AEO / GEO
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "MenuQR Pro",
    "operatingSystem": "All Web Browsers, iOS, Android, Windows, macOS",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "Offer",
      "price": "5.00",
      "priceCurrency": "USD",
      "priceValidUntil": "2027-12-31",
      "availability": "https://schema.org/InStock",
    },
    "description": "Plataforma SaaS en Ecuador para la creación de menús digitales QR con pedidos automáticos a WhatsApp para restaurantes, cafeterías y bares.",
    "areaServed": {
      "@type": "Country",
      "name": "Ecuador",
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MenuQR Pro Ecuador",
    "url": siteUrl,
    "logo": `${siteUrl}/icon.png`,
    "sameAs": [],
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "EC",
    },
  };

  return (
    <html lang="es" className="dark scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100 selection:bg-red-500 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
