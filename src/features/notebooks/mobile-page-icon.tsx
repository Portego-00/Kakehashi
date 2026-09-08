import { Bookmark, BookOpen, Coffee, FileText, Flag, Flower2, Headphones, Languages, Lightbulb, MessageSquareText, Notebook, Sprout, SquarePen, Star, Target, type LucideIcon } from 'lucide-react';

// Keep stored web icons intact while presenting fixed presets consistently on
// devices whose emoji fonts do not include all of the notebook symbols.
const presetIcons: Record<string, LucideIcon> = {
  '📄': FileText, '📓': Notebook, '📖': BookOpen, '文': Languages,
  '栞': Bookmark, '桜': Flower2, '🌸': Flower2, '📝': SquarePen,
  '💬': MessageSquareText, '🎧': Headphones, '🎌': Flag, '💡': Lightbulb,
  '⭐': Star, '🍵': Coffee, '🌱': Sprout, '🎯': Target,
};

export function MobilePageIcon({ icon, size = 20 }: { icon?: string; size?: number }) {
  const Preset = icon ? presetIcons[icon] : FileText;
  return Preset ? <Preset size={size} strokeWidth={1.7} aria-hidden /> : <span className="nb-custom-icon" aria-hidden>{icon}</span>;
}
