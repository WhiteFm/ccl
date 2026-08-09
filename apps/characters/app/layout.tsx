import type { Metadata, Viewport } from "next";
import { Alegreya, Cormorant_Garamond, Forum, Literata } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const forum = Forum({
  variable: "--font-forum",
  subsets: ["latin", "cyrillic"],
  weight: "400"
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"]
});

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"]
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"]
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : host.startsWith("localhost") ? "http" : "https";
  const baseUrl = new URL(protocol + "://" + host);
  const socialImage = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "WSGuild — Character Vault",
    description: "Mobile-first D&D 5.5e character creation, management, and portable character data.",
    applicationName: "WSGuild Character Vault",
    openGraph: {
      title: "WSGuild — Character Vault",
      description: "Every great story begins with a character sheet.",
      type: "website",
      url: baseUrl,
      images: [{ url: socialImage, width: 1792, height: 909, alt: "WSGuild Character Vault" }]
    },
    twitter: {
      card: "summary_large_image",
      title: "WSGuild — Character Vault",
      description: "Every great story begins with a character sheet.",
      images: [socialImage]
    }
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#152131",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={[forum.variable, cormorant.variable, alegreya.variable, literata.variable].join(" ")}>
        {children}
      </body>
    </html>
  );
}
