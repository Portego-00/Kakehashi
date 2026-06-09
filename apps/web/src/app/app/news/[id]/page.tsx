import { NewsArticleReader } from "@/components/NewsArticleReader";
import {
  getNhkEasyContentBlocks,
  getNhkEasyItemById,
  getNhkEasyNews,
} from "@/lib/nhk-easy";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export async function generateStaticParams() {
  const items = await getNhkEasyNews().catch(() => []);
  return items.slice(0, 24).map((item) => ({ id: item.id }));
}

export default async function NewsArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const item = await getNhkEasyItemById(params.id);
  if (!item) {
    notFound();
  }

  const blocks = getNhkEasyContentBlocks(item);

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-sakura-300">NHK Easy News</p>
          <h1 className="mt-2 max-w-4xl font-japanese text-3xl font-bold leading-[1.45] md:text-4xl">
            {item.title}
          </h1>
          <p className="mt-3 text-sm text-gray-500">{formatDate(item.pubDate)}</p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-sakura-300 hover:text-white"
          href="/app/news"
        >
          Back to news
        </Link>
      </div>

      {item.audioUrl ? (
        <audio className="mt-6 w-full" controls preload="none" src={item.audioUrl} />
      ) : null}

      <NewsArticleReader blocks={blocks} item={item} />
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
