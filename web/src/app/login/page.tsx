import Image from "next/image";
import { Suspense } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { LoginFallback, LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.identity} aria-labelledby="login-title">
          <header className={styles.brandHeading}>
            <h1 id="login-title">
              <KakehashiBrand className={styles.heroBrand} />
            </h1>
          </header>

          <div className={styles.identityCopy}>
            <h2>Review. Read. Keep going.</h2>
            <p>A focused companion for your WaniKani study.</p>

            <figure className={styles.artwork} aria-hidden="true">
              <Image
                className={styles.artworkImage}
                src="/brand/kakehashi-login-hd.png"
                alt=""
                width={4344}
                height={1448}
                loading="eager"
                sizes="(max-width: 39.999rem) 12rem, (max-width: 59.999rem) 14rem, 16rem"
              />
            </figure>
          </div>

          <p className={styles.independent}>Independent WaniKani companion.</p>
        </section>

        <section className={styles.access} aria-label="Connect your WaniKani account">
          <Suspense fallback={<LoginFallback />}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
