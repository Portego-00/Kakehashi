"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { bunpro } from "./client";
import styles from "./connect-card.module.css";

export function BunproConnectCard({ username }: { username: string }) {
  const dismissalKey = `kakehashi:bunpro-connect-dismissed:${username.trim().toLowerCase()}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissalKey) === "true"; }
    catch { return false; }
  });
  const [token, setToken] = useState("");
  const cache = useQueryClient();
  const connect = useMutation({
    mutationFn: () => bunpro<{ connected: boolean }>("", {
      method: "POST", body: JSON.stringify({ action: "connect", token: token.trim() }),
    }),
    onSuccess: async (data) => {
      setToken("");
      // Refresh any cached queues from a previous connection before showing them.
      await cache.cancelQueries({ queryKey: ["bunpro", "connection"] });
      await cache.invalidateQueries({ queryKey: ["bunpro"], predicate: (query) => query.queryKey[1] !== "connection" });
      cache.setQueryData(["bunpro", "connection"], data);
    },
  });

  if (dismissed) return null;
  return <section className={styles.card} aria-labelledby="bunpro-connect-heading">
    <div className={styles.heading}>
      <h2 id="bunpro-connect-heading">Connect Bunpro</h2>
      <button className={styles.dismiss} type="button" aria-label="Dismiss Bunpro setup" disabled={connect.isPending} onClick={() => {
        try { localStorage.setItem(dismissalKey, "true"); } catch { /* Still dismiss for this visit when storage is unavailable. */ }
        setDismissed(true);
      }}><X size={20} aria-hidden="true" /></button>
    </div>
    <p>Add your API key to see your Bunpro lessons and reviews here.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (token.trim() && !connect.isPending) connect.mutate(); }}>
      <div className={styles.labelRow}>
        <label htmlFor="bunpro-connect-token">Bunpro API key</label>
        <a href="https://bunpro.jp/settings/api" target="_blank" rel="noreferrer">Get your API key</a>
      </div>
      <div className={styles.controls}>
        <input id="bunpro-connect-token" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={512} placeholder="Paste your API key" value={token} disabled={connect.isPending} onChange={(event) => { setToken(event.target.value); connect.reset(); }} aria-describedby={connect.error ? "bunpro-connect-error" : undefined} />
        <button type="submit" disabled={!token.trim() || connect.isPending}>{connect.isPending ? "Checking…" : "Check API key"}</button>
      </div>
      {connect.isPending ? <p role="status">Checking your Bunpro API key…</p> : null}
      {connect.error ? <p id="bunpro-connect-error" role="alert">{connect.error.message}</p> : null}
    </form>
  </section>;
}
