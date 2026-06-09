import {
  BookOpen,
  Brain,
  Brush,
  Dice5,
  Grid3X3,
  Headphones,
  Languages,
  ListChecks,
  Mic,
  Newspaper,
  Puzzle,
  Search,
  Sparkles,
  Type,
} from "lucide-react";
import Link from "next/link";

const modes = [
  {
    title: "Reviews",
    subtitle: "Keyboard-first WaniKani review shell",
    href: "/app/reviews",
    icon: BookOpen,
    status: "Live shell",
  },
  {
    title: "Lessons",
    subtitle: "Lesson queue and session foundation",
    href: "/app/lessons",
    icon: Brain,
    status: "Live shell",
  },
  {
    title: "Search",
    subtitle: "Subject/text search and paste-Japanese flow",
    href: "/app/search",
    icon: Search,
    status: "Live shell",
  },
  {
    title: "NHK Easy News",
    subtitle: "Read current learner-friendly Japanese news",
    href: "/app/news",
    icon: Newspaper,
    status: "Ported",
  },
  {
    title: "Songs",
    subtitle: "YouTube video search plus LRCLIB lyrics",
    href: "/app/songs",
    icon: Headphones,
    status: "Ported",
  },
  {
    title: "Crossword",
    subtitle: "Generate hiragana crosswords from your WaniKani vocabulary",
    href: "/app/crossword",
    icon: Grid3X3,
    status: "Ported",
  },
  {
    title: "Random Test",
    subtitle: "Answer learned items from flexible pools",
    href: "/app/reviews",
    icon: Dice5,
    status: "Next extraction",
  },
  {
    title: "Vocab Reading",
    subtitle: "English-to-kana reading practice",
    href: "/app/reviews",
    icon: Languages,
    status: "Next extraction",
  },
  {
    title: "Hiragana Vocab",
    subtitle: "Hiragana prompts with English answers",
    href: "/app/reviews",
    icon: Type,
    status: "Next extraction",
  },
  {
    title: "Kana to Kanji",
    subtitle: "Read kana prompts and answer in kanji",
    href: "/app/reviews",
    icon: Sparkles,
    status: "Next extraction",
  },
  {
    title: "Context Sentences",
    subtitle: "Fill missing vocabulary from sentence context",
    href: "/app/search",
    icon: Puzzle,
    status: "Next extraction",
  },
  {
    title: "Kanji Writing",
    subtitle: "Stroke-order practice needs a web drawing surface",
    href: "/app/reviews",
    icon: Brush,
    status: "Needs web UI",
  },
  {
    title: "Subject Lists",
    subtitle: "Saved collections for custom study",
    href: "/app/settings",
    icon: ListChecks,
    status: "Settings",
  },
  {
    title: "ASR Reading Debug",
    subtitle: "Native speech tooling remains mobile-only",
    href: "/app/settings",
    icon: Mic,
    status: "Mobile-only",
  },
];

export default function ModesPage() {
  return (
    <section>
      <div>
        <p className="text-sm font-medium text-sakura-300">Extra study</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Modes</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          The web port now has real routes for the browser-safe modes and marks
          the native-heavy surfaces that need separate web implementations.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modes.map((mode) => (
          <Link
            className="rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-sakura-300/60 hover:bg-white/[0.05]"
            href={mode.href}
            key={mode.title}
          >
            <div className="flex items-start justify-between gap-4">
              <mode.icon className="h-5 w-5 text-sakura-300" />
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-gray-400">
                {mode.status}
              </span>
            </div>
            <h2 className="mt-5 text-base font-semibold">{mode.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">{mode.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
