import * as React from "react";
import { icons } from "@hermes/plugin-sdk";

// This list is the bounded set of icon names used by the v0.9 basic catalog
// and the enabled legacy custom-widget catalog. Keep the mapping explicit so
// a payload can select only SDK-owned, theme-aware icon components.
const catalogIconNames = [
  "accountCircle", "add", "arrowBack", "arrowForward", "attachFile", "bot",
  "calendar", "calendarToday", "call", "camera", "chart", "check", "clock",
  "close", "delete", "download", "edit", "error", "event", "fastForward",
  "favorite", "favoriteOff", "file", "folder", "help", "home", "info", "link",
  "locationOn", "lock", "lockOpen", "mail", "menu", "moreHoriz", "moreVert",
  "notifications", "notificationsOff", "pause", "payment", "person", "phone",
  "photo", "play", "print", "refresh", "rewind", "search", "send", "server",
  "settings", "share", "shoppingCart", "skipNext", "skipPrevious", "star",
  "starHalf", "starOff", "stop", "storage", "task", "upload", "visibility",
  "visibilityOff", "volumeDown", "volumeMute", "volumeOff", "volumeUp", "warning",
] as const;

export type CatalogIconName = (typeof catalogIconNames)[number];
export const CATALOG_ICON_NAMES: readonly CatalogIconName[] = catalogIconNames;

const sdkIconByName = {
  accountCircle: icons.Users,
  add: icons.Plus,
  arrowBack: icons.ChevronLeft,
  arrowForward: icons.ChevronRight,
  attachFile: icons.Link,
  bot: icons.Cpu,
  calendar: icons.NotebookTabs,
  calendarToday: icons.NotebookTabs,
  call: icons.AudioLines,
  camera: icons.ImageIcon,
  chart: icons.BarChart3,
  check: icons.Check,
  clock: icons.Clock,
  close: icons.X,
  delete: icons.Trash2,
  download: icons.Download,
  edit: icons.Pencil,
  error: icons.AlertCircle,
  event: icons.NotebookTabs,
  fastForward: icons.ChevronRight,
  favorite: icons.BookmarkFilled,
  favoriteOff: icons.Bookmark,
  file: icons.FileText,
  folder: icons.FolderOpen,
  help: icons.HelpCircle,
  home: icons.LayoutDashboard,
  info: icons.Info,
  link: icons.Link,
  locationOn: icons.Globe,
  lock: icons.Lock,
  lockOpen: icons.LogIn,
  mail: icons.Mail,
  menu: icons.MoreHorizontal,
  moreHoriz: icons.MoreHorizontal,
  moreVert: icons.MoreVertical,
  notifications: icons.Bell,
  notificationsOff: icons.VolumeX,
  pause: icons.Pause,
  payment: icons.CreditCard,
  person: icons.Users,
  phone: icons.AudioLines,
  photo: icons.ImageIcon,
  play: icons.Play,
  print: icons.FileText,
  refresh: icons.RefreshCw,
  rewind: icons.ChevronLeft,
  search: icons.Search,
  send: icons.Send,
  server: icons.Network,
  settings: icons.Settings,
  share: icons.ExternalLink,
  shoppingCart: icons.Package,
  skipNext: icons.ChevronRight,
  skipPrevious: icons.ChevronLeft,
  star: icons.Starmap,
  starHalf: icons.Bookmark,
  starOff: icons.Bookmark,
  stop: icons.StopFilled,
  storage: icons.Box,
  task: icons.CheckCircle2,
  upload: icons.Upload,
  visibility: icons.Eye,
  visibilityOff: icons.EyeOff,
  volumeDown: icons.Volume2,
  volumeMute: icons.VolumeX,
  volumeOff: icons.VolumeX,
  volumeUp: icons.Volume2,
  warning: icons.AlertTriangle,
} satisfies Record<CatalogIconName, React.ComponentType<React.SVGProps<SVGSVGElement>>>;

export function CatalogIcon({
  name,
  ...props
}: React.SVGProps<SVGSVGElement> & { name: string }): React.ReactElement {
  const Icon = Object.hasOwn(sdkIconByName, name)
    ? sdkIconByName[name as CatalogIconName]
    : icons.HelpCircle;
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      height="1em"
      width="1em"
      strokeWidth={1.8}
      {...props}
    />
  );
}
