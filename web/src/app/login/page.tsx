import Image from "next/image";
import { Suspense } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { LoginFallback, LoginForm } from "./LoginForm";
import styles from "./login.module.css";

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
