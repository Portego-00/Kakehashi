"use client";

import { ArrowRight, CircleAlert, ExternalLink, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { safeInternalPath } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import styles from "./login.module.css";

type LoginPhase = "idle" | "loading" | "error" | "success";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, isDemo, signIn, startDemo } = useSession();
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [error, setError] = useState("");
  const [openingDemo, setOpeningDemo] = useState(false);
  const redirecting = useRef(false);
  const nextPath = safeInternalPath(params.get("next"));

  useEffect(() => {
    if (status === "authenticated" && !isDemo && !redirecting.current) {
      redirecting.current = true;
      router.replace(nextPath);
    }
  }, [status, isDemo, router, nextPath]);

  async function openDemo() {
    if (openingDemo || phase === "loading" || phase === "success") return;
    setError("");
    setOpeningDemo(true);
    redirecting.current = true;
    try {
      await startDemo();
      router.replace(nextPath);
    } catch (cause) {
      redirecting.current = false;
      setError(cause instanceof Error ? cause.message : "The demo could not be opened. Try again.");
      setOpeningDemo(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "loading" || phase === "success") return;

    redirecting.current = true;
    setError("");
    setPhase("loading");

    try {
      await signIn(token);
      setPhase("success");
      router.replace(nextPath);
    } catch (cause) {
      redirecting.current = false;
      setError(cause instanceof Error ? cause.message : "That token could not be verified. Check it and try again.");
      setPhase("error");
    }
  }

  const isLoading = phase === "loading";
  const isSuccess = phase === "success";
  const tokenError = token && token.length < 20 ? "That token is incomplete. Paste the full value." : undefined;

  return (
    <div className={styles.form} data-phase={phase}>
      <section className={styles.demoEntry} aria-label="Try Kakehashi without an API key">
        <h2>Try Kakehashi first</h2>
        <p>Explore a level 21 sample account, read manga, watch Japanese content, and try every extra study mode. No API keys needed.</p>
        <Button type="button" tone="default" wide state={openingDemo ? "loading" : "idle"} disabled={isLoading || isSuccess} onClick={() => void openDemo()}>{openingDemo ? "Opening demo…" : isDemo ? "Continue demo" : "Explore the demo"}<ArrowRight size={17} aria-hidden /></Button>
      </section>
      <form className={styles.formBody} onSubmit={submit} aria-busy={isLoading}>
        <div className={styles.formHeading}>
          <h2>Connect WaniKani</h2>
          <p className={styles.formLead}>Use your personal access token to open Kakehashi.</p>
          <p className={styles.privacy}>
            <ShieldCheck className={styles.inlineIcon} size={16} aria-hidden />
            Encrypted in a secure session. Never saved to browser storage.
          </p>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            <CircleAlert size={17} aria-hidden />
            <span>{error}</span>
          </p>
        )}

        <Field
          label="API token"
          name="wanikani-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste your personal access token…"
          helper="Create a read/write token in your WaniKani account settings."
          error={tokenError}
          success={isSuccess ? "Token verified. Opening your workspace…" : undefined}
          loading={isLoading}
          disabled={isLoading || isSuccess || openingDemo}
          required
        />

        <Button
          className={styles.submit}
          tone="primary"
          wide
          state={isLoading ? "loading" : isSuccess ? "success" : "idle"}
          disabled={token.length < 20 || isSuccess || openingDemo}
        >
          {isLoading ? (
            "Verifying token…"
          ) : isSuccess ? (
            "Connected. Opening…"
          ) : (
            <>
              Open Kakehashi <ArrowRight size={17} aria-hidden />
            </>
          )}
        </Button>

        <a
          href="https://www.wanikani.com/settings/personal_access_tokens"
          target="_blank"
          rel="noreferrer"
          className={styles.privacy}
        >
          Manage token on WaniKani <ExternalLink className={styles.inlineIcon} size={14} aria-hidden />
        </a>
      </form>
    </div>
  );
}

export function LoginFallback() {
  return (
    <div className={styles.form} data-phase="loading">
      <div className={styles.fallback} role="status" aria-live="polite">
        <div className={styles.formHeading}>
          <h2>Connect WaniKani</h2>
          <p className={styles.privacy}>Checking for an existing secure session…</p>
        </div>
      </div>
    </div>
  );
}
