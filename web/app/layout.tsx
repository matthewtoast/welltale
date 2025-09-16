import "./globals.css"
import { Montserrat_Alternates } from "next/font/google"

const mont = Montserrat_Alternates({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "600", "700"] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${mont.variable} font-sans text-stone-100 antialiased`}>{children}</body>
    </html>
  )
}
