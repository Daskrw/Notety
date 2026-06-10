import type { Metadata } from "next";
import { Inter, Prompt } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  title: "Quiet Notes",
  description: "Minimalist note-taking application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${prompt.variable} antialiased h-full`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900 selection:bg-stone-200 font-sans">
        {children}
      </body>
    </html>
  );
}
