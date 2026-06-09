"use client";

import {
  WANIKANI_PERSONAL_ACCESS_TOKENS_URL,
  validateWaniKaniApiToken,
} from "@kakehashi/core";
import {
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { saveWaniKaniSession } from "@/lib/wanikani-session";

export function WaniKaniTokenLogin() {
  const router = useRouter();
  const [apiToken, setApiToken] = useState("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await validateWaniKaniApiToken(apiToken);

    if (result.ok) {
      saveWaniKaniSession({
        apiToken,
        user: result.user.data,
      });
      router.push("/app/dashboard");
      router.refresh();
      return;
    }

    setError(result.message);
    setIsSubmitting(false);
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sakura-500/15 text-sakura-200">
        <KeyRound className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Connect WaniKani</h2>
      <p className="mt-3 text-sm leading-6 text-gray-400">
        Paste a WaniKani personal access token to unlock the web dashboard in this
        browser. Kakehashi validates it directly with WaniKani.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium text-gray-300" htmlFor="wanikani-token">
            Personal access token
          </label>
          <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 focus-within:border-sakura-300">
            <input
              id="wanikani-token"
              autoComplete="off"
              spellCheck={false}
              type={isTokenVisible ? "text" : "password"}
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder="Paste your token"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              aria-label={isTokenVisible ? "Hide token" : "Show token"}
              className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              type="button"
              onClick={() => setIsTokenVisible((current) => !current)}
            >
              {isTokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400 disabled:cursor-not-allowed disabled:bg-sakura-500/60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isSubmitting ? "Checking token" : "Connect"}
        </button>
      </form>

      <a
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sakura-300 hover:text-sakura-200"
        href={WANIKANI_PERSONAL_ACCESS_TOKENS_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open WaniKani token settings
        <ExternalLink className="h-4 w-4" />
      </a>
    </section>
  );
}
