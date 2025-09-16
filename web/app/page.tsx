import { Logomark } from "./components/Logomark"
import { Wordmark } from "./components/Wordmark"

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-screen-xl px-6 md:px-10 lg:px-16 py-20 md:py-28">
        <div className="flex flex-col items-center gap-8 md:gap-10 lg:gap-12">
          <div className="text-stone-100" style={{ color: "#F6F1EC" }}>
            <div className="w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72">
              <Logomark />
            </div>
          </div>
          <div className="w-[18rem] sm:w-[22rem] md:w-[26rem] lg:w-[30rem] xl:w-[34rem]" style={{ color: "#F6F1EC" }}>
            <Wordmark />
          </div>
        </div>
      </div>
    </main>
  )
}
