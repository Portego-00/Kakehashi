"use client";

import { ArrowRight, CircleAlert, ExternalLink, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { safeInternalPath } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import styles from "./login.module.css";

type LoginPhase = "idle" | "loading" | "error" | "success";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, signIn } = useSession();
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [error, setError] = useState("");
  const redirecting = useRef(false);
  const nextPath = safeInternalPath(params.get("next"));

  useEffect(() => {
    if (status === "authenticated" && !redirecting.current) {
      redirecting.current = true;
      router.replace(nextPath);
    }
  }, [status, router, nextPath]);

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
    <Card padding="lg" className={styles.form} data-phase={phase}>
      <form className={styles.formBody} onSubmit={submit} aria-busy={isLoading}>
        <div className={styles.formHeading}>
          <KakehashiBrand className={styles.formMark} showName={false} />
          <h2>Connect WaniKani</h2>
          <p className={styles.formLead}>Bring your lessons, reviews, and study data into Kakehashi.</p>
          <p className={styles.privacy}>
            <ShieldCheck className={styles.inlineIcon} size={16} aria-hidden />
            Your token is encrypted into an HttpOnly session and never stored in browser storage.
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
          disabled={isLoading || isSuccess}
          required
        />

        <Button
          className={styles.submit}
          tone="primary"
          wide
          state={isLoading ? "loading" : isSuccess ? "success" : "idle"}
          disabled={token.length < 20 || isSuccess}
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
          Manage API tokens on WaniKani <ExternalLink className={styles.inlineIcon} size={14} aria-hidden />
        </a>
      </form>
    </Card>
  );
}

export function LoginFallback() {
  return (
    <Card padding="lg" className={styles.form} data-phase="loading">
      <div className={styles.fallback} role="status" aria-live="polite">
        <div className={styles.formHeading}>
          <KakehashiBrand className={styles.formMark} showName={false} />
          <h2>Connect WaniKani</h2>
          <p className={styles.privacy}>Checking for an existing secure session…</p>
        </div>
        <span className={styles.loadingTrack} aria-hidden>
          <span />
        </span>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.brandStage} aria-labelledby="login-title">
        <header className={styles.brandHeading}>
          <h1 id="login-title">
            <KakehashiBrand className={styles.heroBrand} />
          </h1>
          <p>Your WaniKani companion for reviews, focused study, and Japanese reading.</p>
        </header>

        <div className={styles.artwork} aria-hidden="true">
          <Image
            className={styles.artworkImage}
            src="/brand/kakehashi-login-hd.png"
            alt=""
            width={4344}
            height={1448}
            loading="eager"
            sizes="(max-width: 49.999rem) 92vw, (max-width: 78rem) 58vw, 46rem"
          />
        </div>

        <p className={styles.independent}>Independent companion app for WaniKani learners.</p>
      </section>

      <section className={styles.access} aria-label="Connect your WaniKani account">
        <Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
