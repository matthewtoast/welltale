import { Montserrat_Alternates } from "next/font/google";
import "./globals.css";

const mont = Montserrat_Alternates({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600", "700"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
      />
      <body className={mont.variable} style={{ fontFamily: 'var(--font-sans)', height: '100%', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
