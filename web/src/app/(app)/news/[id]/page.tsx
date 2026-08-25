import { NewsArticleView } from "@/features/content/news";

export default async function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewsArticleView articleId={id} />;
}
