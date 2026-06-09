"use client";

import { validateWaniKaniApiToken } from "@kakehashi/core";
import { CheckCircle2, KeyRound, Loader2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  clearJpdbApiKey,
  loadJpdbApiKey,
  saveJpdbApiKey,
  validateJpdbApiKey,
} from "@/lib/jpdb";
import {
  clearWaniKaniSession,
  loadWaniKaniSession,
  saveWaniKaniSession,
  type StoredWaniKaniSession,
} from "@/lib/wanikani-session";

export default function SettingsPage() {
  const [session, setSession] = useState<StoredWaniKaniSession | null>(null);
  const [status, setStatus] = useState<"idle" | "validating">("idle");
  const [jpdbStatus, setJpdbStatus] = useState<"idle" | "validating">("idle");
  const [jpdbInput, setJpdbInput] = useState("");
  const [hasJpdbKey, setHasJpdbKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jpdbMessage, setJpdbMessage] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadWaniKaniSession());
    setHasJpdbKey(Boolean(loadJpdbApiKey()));
  }, []);

  async function handleValidate() {
    if (!session) return;

    setStatus("validating");
    setMessage(null);
    const result = await validateWaniKaniApiToken(session.apiToken);

    if (result.ok) {
      const updatedSession = saveWaniKaniSession({
        apiToken: session.apiToken,
        connectedAt: session.connectedAt,
        user: result.user.data,
      });
      setSession(updatedSession);
      setMessage("WaniKani token is valid.");
    } else {
      setMessage(result.message);
    }

    setStatus("idle");
  }

  function handleDisconnect() {
    clearWaniKaniSession();
    setSession(null);
    setMessage("WaniKani token removed from this browser.");
  }

  async function handleSaveJpdb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJpdbStatus("validating");
    setJpdbMessage(null);

    const isValid = await validateJpdbApiKey(jpdbInput);
    if (!isValid) {
      setJpdbStatus("idle");
      setJpdbMessage("JPDB did not accept that API key.");
      return;
    }

    saveJpdbApiKey(jpdbInput);
    setHasJpdbKey(true);
    setJpdbInput("");
    setJpdbStatus("idle");
    setJpdbMessage("JPDB API key saved. Full grammar mode is available in News and Songs.");
  }

  function handleClearJpdb() {
    clearJpdbApiKey();
    setHasJpdbKey(false);
    setJpdbInput("");
    setJpdbMessage("JPDB API key removed from this browser.");
  }

  return (
    <section>
      <p className="text-sm font-medium text-sakura-300">Settings</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Account and integrations</h1>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-6">
        {session ? (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-xl font-semibold">WaniKani connected</h2>
                </div>
                <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Username</dt>
                    <dd className="mt-1 font-medium text-white">{session.user.username}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Level</dt>
                    <dd className="mt-1 font-medium text-white">{session.user.level}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Connected</dt>
                    <dd className="mt-1 font-medium text-white">
                      {formatDate(session.connectedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Last checked</dt>
                    <dd className="mt-1 font-medium text-white">
                      {formatDate(session.lastValidatedAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-gray-200 transition-colors hover:border-sakura-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={status === "validating"}
                  onClick={handleValidate}
                  type="button"
                >
                  {status === "validating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Check token
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/20 px-4 py-3 text-sm font-semibold text-red-200 transition-colors hover:border-red-300/50 hover:text-white"
                  onClick={handleDisconnect}
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-sakura-300" />
                <h2 className="text-xl font-semibold">WaniKani not connected</h2>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                Connect a WaniKani personal access token to load your web review
                and lesson queues.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400"
              href="/login"
            >
              Connect WaniKani
            </Link>
          </div>
        )}

        {message ? (
          <p className="mt-5 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200">
            {message}
          </p>
        ) : null}
      </div>

      <div id="jpdb" className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sakura-300" />
          <h2 className="text-xl font-semibold">JPDB API key</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          Optional. Save a JPDB key to enable full grammar + vocabulary parsing in
          the web news and song readers. The key is stored only in this browser.
        </p>
        <p className="mt-3 text-sm text-gray-400">
          Status:{" "}
          <span className={hasJpdbKey ? "text-emerald-300" : "text-amber-300"}>
            {hasJpdbKey ? "Configured" : "Not configured"}
          </span>
        </p>
        <form className="mt-5 flex flex-col gap-3 md:flex-row" onSubmit={handleSaveJpdb}>
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-sakura-300"
            onChange={(event) => setJpdbInput(event.target.value)}
            placeholder={hasJpdbKey ? "Paste a replacement JPDB key" : "Paste JPDB API key"}
            type="password"
            value={jpdbInput}
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400 disabled:cursor-not-allowed disabled:bg-sakura-500/60"
            disabled={jpdbStatus === "validating"}
            type="submit"
          >
            {jpdbStatus === "validating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Save key
          </button>
          {hasJpdbKey ? (
            <button
              className="inline-flex items-center justify-center rounded-lg border border-red-300/20 px-4 py-3 text-sm font-semibold text-red-200 transition-colors hover:border-red-300/50 hover:text-white"
              onClick={handleClearJpdb}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </form>
        {jpdbMessage ? (
          <p className="mt-5 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200">
            {jpdbMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
