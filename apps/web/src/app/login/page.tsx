import Link from "next/link";
import { WaniKaniTokenLogin } from "@/components/WaniKaniTokenLogin";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-dark-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <section className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-sakura-300 transition-colors hover:text-sakura-200"
            >
              Kakehashi
            </Link>
            <h1 className="mt-8 text-4xl font-bold tracking-normal md:text-5xl">
              Connect WaniKani to study on the web.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-400">
              The web app uses your WaniKani personal access token, just like the
              mobile app. Your token stays in this browser and is only sent to
              WaniKani&apos;s official API.
            </p>
          </div>

          <WaniKaniTokenLogin />
        </section>
      </div>
    </main>
  );
}
