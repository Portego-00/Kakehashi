"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/session";
import { canAccessBunpro } from "./access";
import { bunpro } from "./client";
import styles from "./bunpro.module.css";

export function BunproSettings() {
  const { user, isDemo } = useSession();
  return !isDemo && canAccessBunpro(user?.data.username) ? <Connection /> : null;
}
function Connection() {
  const [token, setToken] = useState("");
  const cache = useQueryClient();
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  const save = useMutation({
    mutationFn: (disconnect: boolean) => bunpro<{ connected: boolean }>("", { method: disconnect ? "DELETE" : "POST", ...(disconnect ? {} : { body: JSON.stringify({ action: "connect", token }) }) }),
    onSuccess: (data) => { setToken(""); cache.removeQueries({ queryKey: ["bunpro", "details"] }); cache.setQueryData(["bunpro", "connection"], data); },
  });
  return <section id="bunpro-api-key" data-settings-search="" data-search-keywords="bunpro api key grammar vocabulary" className={styles.settings} aria-labelledby="bunpro-heading">
    <div className={styles.row}><h2 id="bunpro-heading">Bunpro</h2><span className={styles.connectionStatus} role="status">{connection.isPending ? "Checking…" : connection.data?.connected ? "Connected" : ""}</span></div>
    <Card><form className={styles.connection} onSubmit={(event) => { event.preventDefault(); save.mutate(false); }}>
      <div className={styles.row}><label htmlFor="bunpro-token">API key</label><a href="https://bunpro.jp/settings" target="_blank" rel="noreferrer">Get API key</a></div>
      <div className={styles.connectionControls}>
      <input id="bunpro-token" aria-label="Bunpro API key" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder={connection.data?.connected ? "Replace API key" : "Paste API key"} />
      <div className="cluster"><Button type="submit" disabled={!token.trim() || save.isPending} state={save.isPending ? "loading" : "idle"}>Save</Button>{connection.data?.connected ? <Button type="button" disabled={save.isPending} onClick={() => save.mutate(true)}>Disconnect</Button> : null}</div>
      </div>
      {save.error || connection.error ? <p role="alert">{(save.error || connection.error)?.message}</p> : null}
    </form></Card>
  </section>;
}
