import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "lolnote",
  description: "LOL上達用のメモ・振り返りノート",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={cn("dark h-full antialiased", "font-sans", geist.variable)}
    >
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
