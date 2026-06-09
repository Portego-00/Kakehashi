import { getNhkEasyNews } from "@/lib/nhk-easy";
import { Volume2 } from "lucide-react";
import Link from "next/link";

export default async function NewsPage() {
  const items = await getNhkEasyNews().catch(() => []);

  return (
    <section>
      <div>
        <p className="text-sm font-medium text-sakura-300">NHK Easy News</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Reader</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          Current learner-friendly news from NHK Easier, rendered as safe text
          with audio links when the feed provides them.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
          Could not load the NHK Easy feed right now.
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {items.slice(0, 12).map((item) => (
            <article
              className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[160px_1fr]"
              key={item.guid}
            >
              {item.imageUrl ? (
                <img
                  alt=""
                  className="h-36 w-full rounded-lg object-cover md:h-full"
                  src={item.imageUrl}
                />
              ) : (
                <div className="hidden rounded-lg bg-white/[0.04] md:block" />
              )}
              <div>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold leading-8">{item.title}</h2>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(item.pubDate)}</p>
                  </div>
                  <Link
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sakura-300 hover:text-white"
                    href={`/app/news/${item.id}`}
                  >
                    Read
                  </Link>
                </div>
                <p className="mt-4 text-sm leading-7 text-gray-300">{item.excerpt}</p>
                {item.audioUrl ? (
                  <audio className="mt-4 w-full" controls preload="none" src={item.audioUrl}>
                    <a href={item.audioUrl}>
                      <Volume2 className="h-4 w-4" />
                      Audio
                    </a>
                  </audio>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
