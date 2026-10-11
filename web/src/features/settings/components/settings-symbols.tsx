import type { CSSProperties } from "react";
import { SettingsIcon } from "./settings-artwork";
type Props = { size?: number; className?: string; style?: CSSProperties };
const symbol = (name: string) =>
  function SettingsSymbol(props: Props) {
    return <SettingsIcon name={name} {...props} />;
  };
export const ArrowDown = symbol("down"),
  ArrowUp = symbol("up"),
  BookOpenText = symbol("lessons"),
  Check = symbol("check"),
  ChevronRight = symbol("chevron"),
  Download = symbol("download"),
  ExternalLink = symbol("external"),
  EyeOff = symbol("eyeOff"),
  FileUp = symbol("upload"),
  GripVertical = symbol("grip"),
  HeartHandshake = symbol("support"),
  KeyRound = symbol("key"),
  Keyboard = symbol("keyboard"),
  LayoutDashboard = symbol("widget"),
  LogOut = symbol("logout"),
  Moon = symbol("moon"),
  Palette = symbol("palette"),
  Plus = symbol("plus"),
  RotateCcw = symbol("reset"),
  ReviewQueue = symbol("reviews"),
  SlidersHorizontal = symbol("settings"),
  Trash2 = symbol("trash"),
  Type = symbol("text"),
  UserRound = symbol("profile"),
  ShieldUser = symbol("account"),
  Volume2 = symbol("audio"),
  Search = symbol("search"),
  X = symbol("close");
