"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileArchive,
  FileImage,
  Files,
  ImageIcon,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  UserRound,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { getStoredSession } from "@/lib/auth";
import { getStoredCompanyId } from "@/lib/tenant";

type Team = {
  id: number;
  companyId: number;
  name: string;
  description?: string | null;
  securityKey: string;
  memberCount: number;
  members: Array<{ id: number; fullName: string; email: string; role: string }>;
};

type TeamMessage = {
  id: number;
  senderUserId: number;
  senderName: string;
  encryptedBody: string;
  iv: string;
  body?: string;
  createdAt: string;
};

type TeamFile = {
  id: number;
  uploadedByUserId?: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  encryptedPayload: string;
  iv: string;
  createdAt: string;
};

type ChatWallpaper = "soft-grid" | "volt-glow" | "blue-drift" | "custom";

type StoredChatWallpaperPreference = {
  wallpaper: ChatWallpaper;
  customDataUrl?: string;
};

const MAX_SAFE_FILE_BYTES = 10 * 1024 * 1024;

const allowedFileRules = [
  { ext: ".png", mimes: ["image/png"] },
  { ext: ".jpg", mimes: ["image/jpeg"] },
  { ext: ".jpeg", mimes: ["image/jpeg"] },
  { ext: ".webp", mimes: ["image/webp"] },
  { ext: ".gif", mimes: ["image/gif"] },
  { ext: ".pdf", mimes: ["application/pdf"] },
  { ext: ".doc", mimes: ["application/msword", "application/octet-stream"] },
  {
    ext: ".docx",
    mimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/octet-stream",
    ],
  },
  {
    ext: ".xls",
    mimes: ["application/vnd.ms-excel", "application/octet-stream"],
  },
  {
    ext: ".xlsx",
    mimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/octet-stream",
    ],
  },
  {
    ext: ".zip",
    mimes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "",
    ],
  },
  {
    ext: ".xml",
    mimes: ["text/xml", "application/xml", "application/octet-stream", ""],
  },
];

function getInitials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importTeamKey(securityKey: string) {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`volt-team-v1:${securityKey}`),
  );

  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptText(value: string, securityKey: string) {
  const key = await importTeamKey(securityKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );

  return {
    encryptedBody: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function decryptText(
  encryptedBody: string,
  iv: string,
  securityKey: string,
) {
  try {
    const key = await importTeamKey(securityKey);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      key,
      base64ToBytes(encryptedBody),
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return "Unable to decrypt this message";
  }
}

async function encryptFile(file: File, securityKey: string) {
  const key = await importTeamKey(securityKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await file.arrayBuffer(),
  );

  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function downloadEncryptedFile(file: TeamFile, securityKey: string) {
  const key = await importTeamKey(securityKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(file.iv) },
    key,
    base64ToBytes(file.encryptedPayload),
  );
  const blob = new Blob([decrypted], {
    type: file.mimeType || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isImageFile(file: TeamFile) {
  const name = file.fileName.toLowerCase();
  return (
    file.mimeType.startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif)$/.test(name)
  );
}

async function createDecryptedFilePreviewUrl(
  file: TeamFile,
  securityKey: string,
) {
  const key = await importTeamKey(securityKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(file.iv) },
    key,
    base64ToBytes(file.encryptedPayload),
  );
  const blob = new Blob([decrypted], {
    type: file.mimeType || "application/octet-stream",
  });
  return URL.createObjectURL(blob);
}

function getFileIcon(file: TeamFile) {
  const name = file.fileName.toLowerCase();
  if (isImageFile(file)) return FileImage;
  if (/\.(xls|xlsx)$/.test(name)) return FileSpreadsheet;
  if (/\.(doc|docx|pdf|xml|txt)$/.test(name)) return FileText;
  return FileArchive;
}

function getFileTypeLabel(file: TeamFile) {
  const name = file.fileName.toLowerCase();
  if (/\.zip$/.test(name)) return "ZIP Folder";
  if (isImageFile(file)) return "Image";
  if (/\.(xls|xlsx)$/.test(name)) return "Spreadsheet";
  if (/\.(doc|docx)$/.test(name)) return "Word Document";
  if (/\.pdf$/.test(name)) return "PDF";
  if (/\.xml$/.test(name)) return "XML";
  return "File";
}

function getFileGroup(file: TeamFile) {
  const name = file.fileName.toLowerCase();
  if (/\.zip$/.test(name)) return "zip";
  if (isImageFile(file)) return "images";
  return "documents";
}

function formatDateAdded(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type WorkspaceTab = "chat" | "files";

const workspaceTabs: {
  value: WorkspaceTab;
  title: string;
  description: string;
  icon: ElementType;
}[] = [
  {
    value: "chat",
    title: "Chat",
    description: "Secure team messages",
    icon: MessageCircle,
  },
  {
    value: "files",
    title: "File Share",
    description: "Explore team files",
    icon: Files,
  },
];

const voltyAnimations = {
  idle: [
    "/volty/team-idle-01.png",
    "/volty/team-idle-02.png",
    "/volty/team-idle-03.png",
    "/volty/team-idle-04.png",
    "/volty/team-idle-05.png",
    "/volty/team-idle-06.png",
    "/volty/team-idle-07.png",
    "/volty/team-idle-08.png",
    "/volty/team-idle-09.png",
    "/volty/team-idle-10.png",
  ],
  wave: [
    "/volty/wave-01.png",
    "/volty/wave-02.png",
    "/volty/wave-03.png",
    "/volty/wave-04.png",
    "/volty/wave-05.png",
    "/volty/wave-06.png",
    "/volty/wave-07.png",
    "/volty/wave-08.png",
    "/volty/wave-09.png",
    "/volty/wave-10.png",
  ],
  button: [
    "/volty/button-01.png",
    "/volty/button-02.png",
    "/volty/button-03.png",
    "/volty/button-04.png",
    "/volty/button-05.png",
    "/volty/button-06.png",
    "/volty/button-07.png",
    "/volty/button-08.png",
    "/volty/button-09.png",
    "/volty/button-10.png",
  ],
  spin: [
    "/volty/spin-01.png",
    "/volty/spin-02.png",
    "/volty/spin-03.png",
    "/volty/spin-04.png",
    "/volty/spin-05.png",
    "/volty/spin-06.png",
    "/volty/spin-07.png",
    "/volty/spin-08.png",
    "/volty/spin-09.png",
    "/volty/spin-10.png",
  ],
  fall: [
    "/volty/fall-01.png",
    "/volty/fall-02.png",
    "/volty/fall-03.png",
    "/volty/fall-04.png",
    "/volty/fall-05.png",
    "/volty/fall-06.png",
    "/volty/fall-07.png",
    "/volty/fall-08.png",
    "/volty/fall-09.png",
    "/volty/fall-10.png",
  ],
  celebrate: [
    "/volty/celebrate-01.png",
    "/volty/celebrate-02.png",
    "/volty/celebrate-03.png",
    "/volty/celebrate-04.png",
    "/volty/celebrate-05.png",
    "/volty/celebrate-06.png",
    "/volty/celebrate-07.png",
    "/volty/celebrate-08.png",
    "/volty/celebrate-09.png",
    "/volty/celebrate-10.png",
  ],
  jump: [
    "/volty/jump-01.png",
    "/volty/jump-02.png",
    "/volty/jump-03.png",
    "/volty/jump-04.png",
    "/volty/jump-05.png",
    "/volty/jump-06.png",
    "/volty/jump-07.png",
    "/volty/jump-08.png",
    "/volty/jump-09.png",
    "/volty/jump-10.png",
  ],
} as const;

const voltyAnimationCycle: Array<keyof typeof voltyAnimations> = [
  "wave",
  "button",
  "spin",
  "fall",
  "celebrate",
  "jump",
];

function WorkspaceTabButton({
  tab,
  active,
  highlighted,
  count,
  onClick,
}: {
  tab: (typeof workspaceTabs)[number];
  active: boolean;
  highlighted: boolean;
  count: number;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        active
          ? "border-primary/50 bg-primary/10 text-primary shadow-primary/10"
          : highlighted
            ? "border-accent/60 bg-accent/10 text-accent shadow-accent/10"
            : "border-border bg-background/45 text-foreground hover:border-primary/35 hover:bg-primary/[0.04]"
      }`}
    >
      <span
        className={`pointer-events-none absolute inset-0 -translate-x-[120%] rounded-2xl bg-gradient-to-r from-transparent via-accent/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%] ${highlighted ? "animate-team-tab-sweep" : ""}`}
      />
      <span
        className={`pointer-events-none absolute inset-x-4 bottom-0 h-[2px] origin-left rounded-full bg-gradient-to-r from-accent/0 via-accent to-accent/0 transition-transform duration-500 ease-out group-hover:scale-x-100 ${active || highlighted ? "scale-x-100" : "scale-x-0"}`}
      />
      <span
        className={`pointer-events-none absolute right-4 top-3.5 h-2 w-2 rounded-full bg-accent opacity-0 shadow-[0_0_18px_hsl(var(--accent))] transition-all duration-300 group-hover:scale-125 group-hover:opacity-80 ${highlighted ? "animate-team-tab-dot" : ""} ${active ? "scale-125 opacity-80" : ""}`}
      />

      <span className="relative flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${active || highlighted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-black">{tab.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {tab.description}
          </span>
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black ${active || highlighted ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

type TeamSelectOption = {
  value: string;
  label: string;
  description?: string;
};

function TeamSelectDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: TeamSelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative z-[80] space-y-1">
      <label className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-background/80 px-3 text-left text-xs font-black text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/10 ${open ? "border-primary ring-2 ring-primary/10" : "border-border"}`}
      >
        <span className="min-w-0">
          <span className={`block truncate ${selectedOption ? "text-foreground" : "text-muted-foreground"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.description && (
            <span className="block truncate text-[10px] font-semibold text-muted-foreground">
              {selectedOption.description}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${open ? "rotate-180 text-primary" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-[9999] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-2xl backdrop-blur">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-2.5 py-2 text-left transition ${value === option.value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
            >
              <span className="block truncate text-xs font-black">
                {option.label}
              </span>
              {option.description && (
                <span className="block truncate text-[10px] font-semibold text-muted-foreground">
                  {option.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getWallpaperClass(wallpaper: ChatWallpaper) {
  return `volt-chat-wallpaper volt-chat-wallpaper-${wallpaper}`;
}

function cssImageUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function getWallpaperStyle(wallpaper: ChatWallpaper, customUrl = ""): CSSProperties {
  const softGrid = `
    radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.28), transparent 30%),
    radial-gradient(circle at 80% 70%, hsl(var(--accent) / 0.24), transparent 32%),
    linear-gradient(hsl(var(--background) / 0.78), hsl(var(--background) / 0.78)),
    repeating-linear-gradient(90deg, hsl(var(--border) / 0.42) 0 1px, transparent 1px 34px),
    repeating-linear-gradient(0deg, hsl(var(--border) / 0.42) 0 1px, transparent 1px 34px)
  `;

  const voltGlow = `
    radial-gradient(circle at 18% 18%, hsl(var(--primary) / 0.50), transparent 34%),
    radial-gradient(circle at 86% 14%, hsl(var(--accent) / 0.44), transparent 30%),
    radial-gradient(circle at 58% 88%, hsl(var(--primary) / 0.25), transparent 34%),
    linear-gradient(135deg, hsl(var(--background) / 0.84), hsl(var(--muted) / 0.54))
  `;

  const blueDrift = `
    linear-gradient(135deg, hsl(var(--primary) / 0.38), transparent 42%),
    radial-gradient(circle at 80% 80%, hsl(var(--accent) / 0.38), transparent 34%),
    radial-gradient(circle at 12% 78%, hsl(var(--primary) / 0.24), transparent 28%),
    linear-gradient(hsl(var(--background) / 0.72), hsl(var(--background) / 0.72)),
    repeating-linear-gradient(45deg, hsl(var(--border) / 0.42) 0 1px, transparent 1px 20px)
  `;

  const custom = customUrl
    ? `
      linear-gradient(135deg, hsl(var(--background) / 0.16), hsl(var(--background) / 0.34)),
      ${cssImageUrl(customUrl)}
    `
    : softGrid;

  const background =
    wallpaper === "volt-glow"
      ? voltGlow
      : wallpaper === "blue-drift"
        ? blueDrift
        : wallpaper === "custom"
          ? custom
          : softGrid;

  return {
    ["--volt-chat-wallpaper-bg" as string]: background,
    backgroundImage: background,
    backgroundSize: wallpaper === "custom" ? "cover, cover" : "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  } as CSSProperties;
}

function TypingBubbles({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
      {label && <span>{label}</span>}
      <span className="typing-bubble inline-flex items-center gap-1">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

async function validateSafeFile(file: File) {
  if (!file.size) return "This file is empty or corrupted.";
  if (file.size > MAX_SAFE_FILE_BYTES) return "File limit is 10MB per upload.";

  const lowerName = file.name.toLowerCase();
  const rule = allowedFileRules.find((item) => lowerName.endsWith(item.ext));
  if (!rule)
    return "Only images, ZIP, Word, Excel, PDF, and XML files are allowed.";
  if (file.type && !rule.mimes.includes(file.type))
    return "This file type does not match the file extension.";

  const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const header = Array.from(headerBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const textHeader = new TextDecoder().decode(headerBytes).trimStart();

  if (lowerName.endsWith(".png") && !header.startsWith("89504e47"))
    return "This PNG appears corrupted.";
  if (
    (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) &&
    !header.startsWith("ffd8ff")
  )
    return "This image appears corrupted.";
  if (lowerName.endsWith(".gif") && !textHeader.startsWith("GIF"))
    return "This GIF appears corrupted.";
  if (lowerName.endsWith(".pdf") && !textHeader.startsWith("%PDF"))
    return "This PDF appears corrupted.";
  if (
    (lowerName.endsWith(".docx") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".zip")) &&
    !textHeader.startsWith("PK")
  )
    return "This ZIP or Office file appears corrupted.";
  if (lowerName.endsWith(".xml")) {
    try {
      const text = await file.text();
      const parsed = new DOMParser().parseFromString(text, "application/xml");
      if (parsed.querySelector("parsererror"))
        return "This XML file appears corrupted.";
    } catch {
      return "This XML file could not be read safely.";
    }
  }

  return "";
}

export default function TeamPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localTyping, setLocalTyping] = useState(false);
  const [remoteTypingMembers, setRemoteTypingMembers] = useState<string[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("chat");
  const [highlightedWorkspaceTab, setHighlightedWorkspaceTab] =
    useState<WorkspaceTab | null>(null);
  const [newestMessageId, setNewestMessageId] = useState<number | null>(null);
  const [voltyAnimation, setVoltyAnimation] =
    useState<keyof typeof voltyAnimations>("idle");
  const [voltyFrameIndex, setVoltyFrameIndex] = useState(0);
  const [fileExplorerView, setFileExplorerView] = useState<"details" | "icons">(
    "details",
  );
  const [activeFileFolder, setActiveFileFolder] = useState<
    "all" | "zip" | "images" | "documents"
  >("all");
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [copiedFileId, setCopiedFileId] = useState<number | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<number | null>(null);
  const [renamingFileName, setRenamingFileName] = useState("");
  const [savingFileRename, setSavingFileRename] = useState(false);
  const [fileThumbnailUrls, setFileThumbnailUrls] = useState<
    Record<number, string>
  >({});
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [chatWallpaper, setChatWallpaper] = useState<ChatWallpaper>("soft-grid");
  const [customChatWallpaperUrl, setCustomChatWallpaperUrl] = useState("");
  const [wallpaperVersion, setWallpaperVersion] = useState(0);
  const [wallpaperDesignerOpen, setWallpaperDesignerOpen] = useState(false);

  const chatWallpaperClassName = useMemo(
    () => getWallpaperClass(chatWallpaper),
    [chatWallpaper],
  );

  const chatWallpaperStyle = useMemo<CSSProperties>(
    () => getWallpaperStyle(chatWallpaper, customChatWallpaperUrl),
    [chatWallpaper, customChatWallpaperUrl, wallpaperVersion],
  );

  const session = typeof window !== "undefined" ? getStoredSession() : null;
  const companyId = getStoredCompanyId() || session?.companyId;

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || teams[0] || null,
    [teams, selectedTeamId],
  );

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: String(team.id),
        label: team.name,
        description: `${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`,
      })),
    [teams],
  );

  const wallpaperStorageKey = selectedTeam
    ? `volt-team-chat-wallpaper-${companyId || "global"}-${selectedTeam.id}`
    : "";

  const wallpaperTouchedRef = useRef(false);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const selectedTeamRef = useRef<number | null>(null);

  function applyWallpaperPreference(
    wallpaper: ChatWallpaper,
    customDataUrl = customChatWallpaperUrl,
  ) {
    setChatWallpaper(wallpaper);
    setCustomChatWallpaperUrl(customDataUrl || "");
    setWallpaperVersion((version) => version + 1);
  }

  async function saveWallpaperPreference(
    wallpaper: ChatWallpaper,
    customDataUrl = customChatWallpaperUrl,
  ) {
    wallpaperTouchedRef.current = true;
    applyWallpaperPreference(wallpaper, customDataUrl);
    window.requestAnimationFrame(() => {
      setWallpaperVersion((version) => version + 1);
    });

    const preference: StoredChatWallpaperPreference = {
      wallpaper,
      customDataUrl: wallpaper === "custom" ? customDataUrl : "",
    };

    if (wallpaperStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(wallpaperStorageKey, JSON.stringify(preference));
    }

    if (!selectedTeam || !session || !companyId) return;

    try {
      await fetch(`/api/teams/${selectedTeam.id}/wallpaper`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyId,
          userId: session.userId,
          wallpaper,
          customDataUrl: wallpaper === "custom" ? customDataUrl : "",
        }),
      });
    } catch {
      // The local preview still works. Add the optional wallpaper API route to sync across devices.
    }
  }

  const activeMemberIds = useMemo(() => {
    const now = Date.now();
    const recentIds = messages
      .filter(
        (message) =>
          now - new Date(message.createdAt).getTime() < 5 * 60 * 1000,
      )
      .map((message) => message.senderUserId);

    return new Set([session?.userId, ...recentIds].filter(Boolean) as number[]);
  }, [messages, session?.userId]);

  const teamPresence = useMemo(() => {
    const members = selectedTeam?.members || [];
    return {
      active: members.filter((member) => activeMemberIds.has(member.id)),
      offline: members.filter((member) => !activeMemberIds.has(member.id)),
    };
  }, [activeMemberIds, selectedTeam?.members]);

  const fileFolders = useMemo(
    () => [
      { id: "all" as const, name: "All Files", count: files.length },
      {
        id: "zip" as const,
        name: "Zip Folder",
        count: files.filter((file) => getFileGroup(file) === "zip").length,
      },
      {
        id: "images" as const,
        name: "Images",
        count: files.filter((file) => getFileGroup(file) === "images").length,
      },
      {
        id: "documents" as const,
        name: "Documents",
        count: files.filter((file) => getFileGroup(file) === "documents")
          .length,
      },
    ],
    [files],
  );

  const visibleFiles = useMemo(() => {
    if (activeFileFolder === "all") return files;
    return files.filter((file) => getFileGroup(file) === activeFileFolder);
  }, [activeFileFolder, files]);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) || null,
    [files, selectedFileId],
  );

  const canDeleteSelectedFile = Boolean(
    selectedFile &&
    (selectedFile.uploadedByUserId === session?.userId ||
      ["admin", "creator", "business_owner"].includes(String(session?.role))),
  );

  const canRenameSelectedFile = canDeleteSelectedFile;

  const currentVoltyFrames = voltyAnimations[voltyAnimation];
  const voltyFrame =
    currentVoltyFrames[voltyFrameIndex % currentVoltyFrames.length] ||
    "/volty/volty-1.png";

  function authHeaders() {
    if (!session || !companyId) throw new Error("You need to be logged in");
    return {
      "x-company-id": String(companyId),
      "x-user-id": String(session.userId),
    };
  }

  const loadTeams = useCallback(async () => {
    if (!session || !companyId) return;
    const response = await fetch(
      `/api/teams?companyId=${companyId}&userId=${session.userId}`,
      {
        cache: "no-store",
        headers: authHeaders(),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(data?.details || data?.error || "Failed to load teams");
    setTeams(Array.isArray(data) ? data : []);
    setSelectedTeamId((prev) => prev || data?.[0]?.id || null);
  }, [companyId, session?.userId]);

  const loadTeamWorkspace = useCallback(async () => {
    if (!selectedTeam || !session || !companyId) return;
    const [messageResponse, fileResponse] = await Promise.all([
      fetch(
        `/api/teams/${selectedTeam.id}/messages?companyId=${companyId}&userId=${session.userId}`,
        {
          cache: "no-store",
          headers: authHeaders(),
        },
      ),
      fetch(
        `/api/teams/${selectedTeam.id}/files?companyId=${companyId}&userId=${session.userId}`,
        {
          cache: "no-store",
          headers: authHeaders(),
        },
      ),
    ]);
    const messageData = await messageResponse.json().catch(() => null);
    const fileData = await fileResponse.json().catch(() => null);
    if (!messageResponse.ok)
      throw new Error(
        messageData?.details || messageData?.error || "Failed to load chat",
      );
    if (!fileResponse.ok)
      throw new Error(
        fileData?.details || fileData?.error || "Failed to load files",
      );

    const decrypted = await Promise.all(
      (messageData.messages || []).map(async (message: TeamMessage) => ({
        ...message,
        body: await decryptText(
          message.encryptedBody,
          message.iv,
          selectedTeam.securityKey,
        ),
      })),
    );

    const sameTeam = selectedTeamRef.current === selectedTeam.id;
    if (!sameTeam) {
      selectedTeamRef.current = selectedTeam.id;
      seenMessageIdsRef.current = new Set();
    }

    const previousIds = seenMessageIdsRef.current;
    const incomingMessages = decrypted.filter(
      (message) =>
        !previousIds.has(message.id) && message.senderUserId !== session.userId,
    );

    if (sameTeam && previousIds.size > 0 && incomingMessages.length > 0) {
      const newestIncoming = incomingMessages[incomingMessages.length - 1];
      setNewestMessageId(newestIncoming.id);
      setHighlightedWorkspaceTab("chat");
      // Play chat notification sound
      try {
        const audio = new Audio("/sounds/notif-chat.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
      window.setTimeout(() => {
        setHighlightedWorkspaceTab(null);
        setNewestMessageId(null);
      }, 1800);
    }

    seenMessageIdsRef.current = new Set(decrypted.map((message) => message.id));
    setMessages(decrypted);
    setFiles(fileData.files || []);
  }, [companyId, selectedTeam?.id, selectedTeam?.securityKey, session?.userId]);

  useEffect(() => {
    function handleRemoteTyping(event: Event) {
      const detail = (event as CustomEvent<{
        teamId?: number;
        userId?: number;
        name?: string;
      }>).detail;

      if (!detail?.name || detail.teamId !== selectedTeam?.id) return;
      if (detail.userId && detail.userId === session?.userId) return;

      const typingName = detail.name;

      setRemoteTypingMembers((prev) =>
        prev.includes(typingName) ? prev : [...prev, typingName].slice(-3),
      );

      window.setTimeout(() => {
        setRemoteTypingMembers((prev) =>
          prev.filter((name) => name !== typingName),
        );
      }, 2400);
    }

    window.addEventListener("volt-team-typing", handleRemoteTyping);
    return () =>
      window.removeEventListener("volt-team-typing", handleRemoteTyping);
  }, [selectedTeam?.id, session?.userId]);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError("");
        await loadTeams();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load team page",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, loadTeams]);

  useEffect(() => {
    loadTeamWorkspace().catch((error) =>
      setError(
        error instanceof Error ? error.message : "Failed to load workspace",
      ),
    );
    const timer = window.setInterval(() => {
      loadTeamWorkspace().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadTeamWorkspace]);

  useEffect(() => {
    if (!selectedTeam || !wallpaperStorageKey || typeof window === "undefined") return;

    wallpaperTouchedRef.current = false;
    const stored = window.localStorage.getItem(wallpaperStorageKey);
    if (stored) {
      try {
        const preference = JSON.parse(stored) as StoredChatWallpaperPreference;
        applyWallpaperPreference(
          preference.wallpaper || "soft-grid",
          preference.customDataUrl || "",
        );
      } catch {
        applyWallpaperPreference("soft-grid", "");
      }
    } else {
      applyWallpaperPreference("soft-grid", "");
    }

    async function loadSavedWallpaper() {
      try {
        const response = await fetch(
          `/api/teams/${selectedTeam.id}/wallpaper?companyId=${companyId}&userId=${session?.userId}`,
          { cache: "no-store", headers: authHeaders() },
        );

        if (!response.ok) return;

        const data = await response.json().catch(() => null);
        if (wallpaperTouchedRef.current) return;
        const wallpaper = data?.wallpaper as ChatWallpaper | undefined;

        if (!wallpaper) return;

        const customDataUrl = String(data?.customDataUrl || "");
        applyWallpaperPreference(wallpaper, customDataUrl);
        window.localStorage.setItem(
          wallpaperStorageKey,
          JSON.stringify({ wallpaper, customDataUrl }),
        );
      } catch {
        // Optional sync endpoint is not required for the live local wallpaper preview.
      }
    }

    loadSavedWallpaper();
  }, [selectedTeam?.id, wallpaperStorageKey]);

  useEffect(() => {
    setVoltyFrameIndex(0);
    const frameTimer = window.setInterval(() => {
      setVoltyFrameIndex((frame) => {
        const nextFrame = frame + 1;
        if (nextFrame >= voltyAnimations[voltyAnimation].length) {
          setVoltyAnimation("idle");
          return 0;
        }
        return nextFrame;
      });
    }, 520);

    return () => window.clearInterval(frameTimer);
  }, [voltyAnimation]);

  useEffect(() => {
    if (!selectedTeam) {
      setFileThumbnailUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadImageThumbnails() {
      const imageFiles = files.filter(isImageFile);
      const previews: Record<number, string> = {};

      await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const url = await createDecryptedFilePreviewUrl(
              file,
              selectedTeam.securityKey,
            );
            createdUrls.push(url);
            previews[file.id] = url;
          } catch {
            // Keep the normal image icon if the encrypted thumbnail cannot be previewed.
          }
        }),
      );

      if (!cancelled) {
        setFileThumbnailUrls((previous) => {
          Object.values(previous).forEach((url) => URL.revokeObjectURL(String(url)));
          return previews;
        });
      }
    }

    loadImageThumbnails();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files, selectedTeam?.id, selectedTeam?.securityKey]);

  function renderFileThumb(file: TeamFile, sizeClass = "h-8 w-8") {
    const Icon = getFileIcon(file);
    const isZip = getFileGroup(file) === "zip";
    const previewUrl = fileThumbnailUrls[file.id];

    if (previewUrl) {
      return (
        <span
          className={`${sizeClass} shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm`}
        >
          <img
            src={previewUrl}
            alt={file.fileName}
            className="h-full w-full object-cover"
          />
        </span>
      );
    }

    return (
      <span
        className={`relative flex ${sizeClass} shrink-0 items-center justify-center rounded-lg ${
          isZip ? "bg-amber-500/10 text-amber-600" : "bg-accent/10 text-accent"
        }`}
      >
        <Icon className="h-4 w-4" />
        {isZip && (
          <span className="absolute -bottom-1 rounded bg-amber-500 px-1 text-[7px] font-black text-white">
            ZIP
          </span>
        )}
      </span>
    );
  }

  function handleWallpaperUpload(file?: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the chat wallpaper.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Wallpaper images must be under 2MB so they can save safely.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;

      wallpaperTouchedRef.current = true;
      setChatWallpaper("custom");
      setCustomChatWallpaperUrl(dataUrl);
      setWallpaperVersion((version) => version + 1);
      setError("");

      void saveWallpaperPreference("custom", dataUrl);
    };
    reader.onerror = () => setError("Could not read this wallpaper image.");
    reader.readAsDataURL(file);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam || !messageText.trim()) return;
    try {
      setSending(true);
      const encrypted = await encryptText(
        messageText.trim(),
        selectedTeam.securityKey,
      );
      const response = await fetch(`/api/teams/${selectedTeam.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...encrypted,
          companyId,
          userId: session?.userId,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.details || data?.error || "Failed to send message",
        );
      setMessageText("");
      setLocalTyping(false);
      await loadTeamWorkspace();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file?: File | null) {
    if (!selectedTeam || !file) return;
    try {
      setUploading(true);
      setError("");
      const validationError = await validateSafeFile(file);
      if (validationError) throw new Error(validationError);
      const encrypted = await encryptFile(file, selectedTeam.securityKey);
      const response = await fetch(`/api/teams/${selectedTeam.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...encrypted,
          companyId,
          userId: session?.userId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.details || data?.error || "Failed to upload file",
        );
      setActiveWorkspaceTab("files");
      await loadTeamWorkspace();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(file: TeamFile) {
    if (!selectedTeam) return;
    try {
      setDeletingFileId(file.id);
      setError("");
      const response = await fetch(
        `/api/teams/${selectedTeam.id}/files?companyId=${companyId}&userId=${session?.userId}&fileId=${file.id}`,
        { method: "DELETE", headers: authHeaders() },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.details || data?.error || "Failed to delete file",
        );
      setFiles((prev) => prev.filter((item) => item.id !== file.id));
      setSelectedFileId((current) => (current === file.id ? null : current));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to delete file",
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  async function copyFileName(file?: TeamFile | null) {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.fileName);
      setCopiedFileId(file.id);
      window.setTimeout(() => setCopiedFileId(null), 1200);
    } catch {
      setError("Could not copy the file name.");
    }
  }

  function startRenameFile(file?: TeamFile | null) {
    if (!file) return;
    setSelectedFileId(file.id);
    setRenamingFileId(file.id);
    setRenamingFileName(file.fileName);
  }

  function cancelRenameFile() {
    setRenamingFileId(null);
    setRenamingFileName("");
  }

  async function saveFileRename() {
    const file = files.find((item) => item.id === renamingFileId);
    const nextName = renamingFileName.trim();

    if (!selectedTeam || !file) return;
    if (!nextName) {
      setError("Please enter a file name before saving.");
      return;
    }

    if (nextName === file.fileName) {
      cancelRenameFile();
      return;
    }

    try {
      setSavingFileRename(true);
      setError("");

      const response = await fetch(`/api/teams/${selectedTeam.id}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyId,
          userId: session?.userId,
          fileId: file.id,
          fileName: nextName,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to rename file");
      }

      setFiles((prev) =>
        prev.map((item) =>
          item.id === file.id ? { ...item, fileName: data?.fileName || nextName } : item,
        ),
      );
      cancelRenameFile();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to rename file");
    } finally {
      setSavingFileRename(false);
    }
  }

  function getMemberForMessage(message: TeamMessage) {
    return selectedTeam?.members.find(
      (member) => member.id === message.senderUserId,
    );
  }

  return (
    <DashboardLayout
      title="Teams"
      subtitle="Chat and file sharing for your team."
    >
      <style jsx global>{`
        @keyframes team-file-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 hsl(var(--primary) / 0);
          }
          45% {
            transform: scale(1.025);
            box-shadow: 0 20px 55px hsl(var(--primary) / 0.18);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 hsl(var(--primary) / 0);
          }
        }
        @keyframes typing-dot {
          0%,
          80%,
          100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
        .team-file-drop-active {
          animation: team-file-pulse 780ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .typing-bubble span {
          display: block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 9999px;
          background: hsl(var(--primary));
          animation: typing-dot 1s ease-in-out infinite;
        }
        .typing-bubble span:nth-child(2) {
          animation-delay: 120ms;
        }
        .typing-bubble span:nth-child(3) {
          animation-delay: 240ms;
        }
        @keyframes team-tab-sweep {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateX(120%);
            opacity: 0;
          }
        }
        @keyframes team-tab-dot {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.7);
          }
        }
        @keyframes team-message-enter {
          0% {
            transform: translateY(10px) scale(0.98);
            opacity: 0.35;
          }
          65% {
            transform: translateY(-2px) scale(1.01);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes volty-float {
          0%,
          100% {
            transform: translateY(0) rotate(-1deg);
          }
          50% {
            transform: translateY(-8px) rotate(1deg);
          }
        }
        .animate-team-tab-sweep {
          animation: team-tab-sweep 900ms ease-out both;
        }
        .animate-team-tab-dot {
          animation: team-tab-dot 900ms ease-in-out 2;
          opacity: 1;
        }
        .animate-team-message-enter {
          animation: team-message-enter 420ms cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }
        .volty-team-frame {
          animation: volty-float 3s ease-in-out infinite;
        }

        .volt-chat-wallpaper {
          position: relative;
          isolation: isolate;
          background-color: hsl(var(--background)) !important;
          background-image: var(--volt-chat-wallpaper-bg) !important;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          transition: background 260ms ease, background-image 260ms ease, box-shadow 260ms ease;
        }
        .volt-chat-wallpaper::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(135deg, hsl(var(--background) / 0.45), hsl(var(--background) / 0.62));
        }
        .volt-chat-wallpaper-soft-grid {
          background-image:
            radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.26), transparent 30%),
            radial-gradient(circle at 80% 70%, hsl(var(--accent) / 0.24), transparent 32%),
            linear-gradient(hsl(var(--background) / 0.82), hsl(var(--background) / 0.82)),
            repeating-linear-gradient(90deg, hsl(var(--border) / 0.42) 0 1px, transparent 1px 34px),
            repeating-linear-gradient(0deg, hsl(var(--border) / 0.42) 0 1px, transparent 1px 34px) !important;
        }
        .volt-chat-wallpaper-volt-glow {
          background-image:
            radial-gradient(circle at 18% 18%, hsl(var(--primary) / 0.48), transparent 34%),
            radial-gradient(circle at 86% 14%, hsl(var(--accent) / 0.42), transparent 30%),
            radial-gradient(circle at 58% 88%, hsl(var(--primary) / 0.24), transparent 34%),
            linear-gradient(135deg, hsl(var(--background) / 0.86), hsl(var(--muted) / 0.52)) !important;
        }
        .volt-chat-wallpaper-blue-drift {
          background-image:
            linear-gradient(135deg, hsl(var(--primary) / 0.36), transparent 42%),
            radial-gradient(circle at 80% 80%, hsl(var(--accent) / 0.35), transparent 34%),
            radial-gradient(circle at 12% 78%, hsl(var(--primary) / 0.20), transparent 28%),
            repeating-linear-gradient(45deg, hsl(var(--border) / 0.48) 0 1px, transparent 1px 20px) !important;
        }
        .volt-chat-wallpaper-custom {
          background-image: var(--volt-chat-wallpaper-image),
            radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.18), transparent 30%),
            linear-gradient(hsl(var(--background) / 0.25), hsl(var(--background) / 0.35)) !important;
        }
        .volt-chat-wallpaper-custom::before {
          background: linear-gradient(135deg, hsl(var(--background) / 0.25), hsl(var(--background) / 0.42));
        }
        .volt-chat-wallpaper-soft-grid,
        .volt-chat-wallpaper-volt-glow,
        .volt-chat-wallpaper-blue-drift,
        .volt-chat-wallpaper-custom {
          background-image: var(--volt-chat-wallpaper-bg) !important;
        }
        .volt-chat-wallpaper-custom {
          background-size: cover !important;
          background-position: center center !important;
        }
        .volt-chat-message-box {
          background: hsl(var(--card) / 0.90);
          color: hsl(var(--card-foreground));
          backdrop-filter: blur(12px);
        }
        .volt-chat-message-box.mine {
          background: linear-gradient(135deg, hsl(var(--primary) / 0.20), hsl(var(--accent) / 0.12));
        }
        .dark .volt-chat-message-box,
        [data-theme="dark"] .volt-chat-message-box {
          background: hsl(var(--card) / 0.84);
        }
        .volt-chat-input {
          background: hsl(var(--background) / 0.86) !important;
          color: hsl(var(--foreground));
          backdrop-filter: blur(12px);
        }
        .volt-chat-input:focus {
          background: hsl(var(--background) / 0.96) !important;
        }
      `}</style>

      <div className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {wallpaperDesignerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                handleWallpaperUpload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Chat Wallpaper
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Choose a Volt wallpaper or import your own image.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWallpaperDesignerOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70 text-lg font-black transition hover:border-primary/40 hover:bg-primary/10"
                  aria-label="Close wallpaper designer"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { id: "soft-grid", label: "Soft Grid" },
                      { id: "volt-glow", label: "Volt Glow" },
                      { id: "blue-drift", label: "Blue Drift" },
                    ].map((wallpaper) => (
                      <button
                        key={wallpaper.id}
                        type="button"
                        onClick={() =>
                          saveWallpaperPreference(wallpaper.id as ChatWallpaper, "")
                        }
                        className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                          chatWallpaper === wallpaper.id
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-muted/30 text-foreground hover:border-primary/30"
                        }`}
                      >
                        <span
                          className={`mb-2 block h-16 rounded-xl border border-border ${getWallpaperClass(wallpaper.id as ChatWallpaper)}`}
                          style={getWallpaperStyle(wallpaper.id as ChatWallpaper)}
                        />
                        <span className="text-xs font-black">
                          {wallpaper.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 ${
                      chatWallpaper === "custom"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/70 text-foreground hover:border-primary/30"
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" /> Import Image Wallpaper
                  </button>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  <div
                    key={`${chatWallpaper}-${wallpaperVersion}-${customChatWallpaperUrl.slice(0, 80)}`}
                    className={`h-44 overflow-hidden rounded-2xl border border-border p-3 shadow-inner ${chatWallpaperClassName}`}
                    style={chatWallpaperStyle}
                  >
                    <div className="mb-2 ml-auto w-28 rounded-2xl border border-primary/25 bg-primary/15 px-3 py-2 text-[10px] font-bold backdrop-blur">
                      Looks good
                    </div>
                    <div className="w-32 rounded-2xl border border-border bg-card/90 px-3 py-2 text-[10px] font-bold backdrop-blur">
                      Volt theme ready
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWallpaperDesignerOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <section className="glass-card p-2.5" style={{ overflow: "visible", zIndex: 80, position: "relative" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {selectedTeam && (
                <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
                  {workspaceTabs.map((tab) => (
                    <WorkspaceTabButton
                      key={tab.value}
                      tab={tab}
                      active={activeWorkspaceTab === tab.value}
                      highlighted={highlightedWorkspaceTab === tab.value}
                      count={
                        tab.value === "chat" ? messages.length : files.length
                      }
                      onClick={() => setActiveWorkspaceTab(tab.value)}
                    />
                  ))}
                </div>
              )}

              <div className="flex shrink-0 flex-col gap-1 lg:w-64">
                {loading ? (
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    teams...
                  </div>
                ) : teams.length === 0 ? (
                  <div className="flex h-10 items-center rounded-xl border border-border bg-background/70 px-3 text-xs text-muted-foreground">
                    No teams yet.
                  </div>
                ) : (
                  <TeamSelectDropdown
                    label="Choose Team"
                    value={String(selectedTeam?.id || "")}
                    placeholder="Choose a team"
                    options={teamOptions}
                    onChange={(value) => setSelectedTeamId(Number(value))}
                  />
                )}
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-3">
            <section className="glass-card overflow-hidden">
              {!selectedTeam ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Select a team to open its secure workspace.
                </div>
              ) : (
                <div className="grid min-h-[640px] xl:grid-cols-[220px_minmax(0,1fr)]">
                  <aside className="border-b border-border p-3 xl:border-b-0 xl:border-r">
                    <div className="mb-4">
                      <h2 className="text-base font-black">
                        {selectedTeam.name}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedTeam.description || "Team workspace"}
                      </p>
                    </div>

                    <div className="mb-4 flex justify-center">
                      <img
                        src={voltyFrame}
                        alt="Volty assistant"
                        className="volty-team-frame h-36 w-36 object-contain drop-shadow-xl"
                        onError={(event) => {
                          event.currentTarget.src = "/volty/volty-1.png";
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase tracking-wide text-primary">
                            Online
                          </p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">
                            {teamPresence.active.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {teamPresence.active.length === 0 ? (
                            <p className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              No one online yet.
                            </p>
                          ) : (
                            teamPresence.active.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-2 transition hover:border-primary/40 hover:bg-primary/15"
                              >
                                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-black text-primary">
                                  {getInitials(member.fullName)}
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground">
                                    {member.fullName}
                                  </p>
                                  <p className="truncate text-[10px] text-primary">
                                    Online
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                            Offline
                          </p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-black text-muted-foreground">
                            {teamPresence.offline.length}
                          </span>
                        </div>
                        <div className="max-h-44 space-y-1.5 overflow-auto pr-1">
                          {teamPresence.offline.length === 0 ? (
                            <p className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              Everyone is online.
                            </p>
                          ) : (
                            teamPresence.offline.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 rounded-xl border border-border bg-background/65 p-2 transition hover:border-primary/30 hover:bg-primary/[0.04]"
                              >
                                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-black text-muted-foreground">
                                  {getInitials(member.fullName)}
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground">
                                    {member.fullName}
                                  </p>
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    Offline
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </aside>

                  <div className="flex min-h-[640px] flex-col">
                    {activeWorkspaceTab === "chat" ? (
                      <div className="flex min-h-0 flex-1 flex-col p-4">
                        <div
                          key={`${chatWallpaper}-${wallpaperVersion}-${customChatWallpaperUrl.slice(0, 80)}`}
                          className={`flex-1 space-y-3 overflow-auto rounded-3xl border border-border p-4 shadow-inner ${chatWallpaperClassName}`}
                          data-wallpaper={chatWallpaper}
                          style={chatWallpaperStyle}
                        >
                          {messages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No messages yet. Start the team conversation.
                            </p>
                          ) : (
                            messages.map((message) => {
                              const mine =
                                message.senderUserId === session?.userId;
                              const member = getMemberForMessage(message);
                              return (
                                <div
                                  key={message.id}
                                  className={`flex ${mine ? "justify-end" : "justify-start"} ${newestMessageId === message.id ? "animate-team-message-enter" : ""}`}
                                >
                                  <div
                                    className={`flex max-w-[86%] gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                                  >
                                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">
                                      {getInitials(
                                        member?.fullName || message.senderName,
                                      )}
                                    </div>
                                    <div
                                      className={`volt-chat-message-box rounded-3xl border px-4 py-3 shadow-sm ${mine ? "mine border-primary/25" : "border-border"} ${newestMessageId === message.id ? "ring-2 ring-accent/25" : ""}`}
                                    >
                                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                        <UserRound className="h-3.5 w-3.5" />
                                        <span className="font-bold text-foreground">
                                          {message.senderName}
                                        </span>
                                        <span>
                                          • {new Date(message.createdAt).toLocaleTimeString("en-ZA", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </p>
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {message.body}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          {remoteTypingMembers.length > 0 && (
                            <div className="flex justify-start">
                              <TypingBubbles
                                label={`${remoteTypingMembers.join(", ")} ${remoteTypingMembers.length === 1 ? "is" : "are"} typing`}
                              />
                            </div>
                          )}
                          {(sending || localTyping) && (
                            <div className="flex justify-start">
                              <TypingBubbles />
                            </div>
                          )}
                        </div>

                        <form
                          onSubmit={sendMessage}
                          className="mt-4 flex gap-2"
                        >
                          <input
                            className="volt-chat-input flex-1 rounded-2xl border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                            placeholder="Type an encrypted team message..."
                            value={messageText}
                            onChange={(e) => {
                              setMessageText(e.target.value);
                              setLocalTyping(Boolean(e.target.value.trim()));
                              window.dispatchEvent(
                                new CustomEvent("volt-team-typing", {
                                  detail: {
                                    teamId: selectedTeam?.id,
                                    userId: session?.userId,
                                    name: session?.fullName || session?.email || "Someone",
                                    isTyping: Boolean(e.target.value.trim()),
                                  },
                                }),
                              );
                            }}
                          />
                          <Button
                            type="submit"
                            disabled={sending || !messageText.trim()}
                            className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
                          >
                            {sending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                            Send
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl px-4"
                            onClick={() => setWallpaperDesignerOpen(true)}
                          >
                            <ImageIcon className="h-4 w-4" /> Customise
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 bg-background/25 p-4">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => uploadFile(e.target.files?.[0])}
                        />

                        <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-border bg-background/45 p-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
                              <FolderOpen className="h-4 w-4 text-primary" />{" "}
                              File Explorer
                            </h3>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Choose a file then copy, download, or delete.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="flex h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black text-primary transition hover:-translate-y-0.5 hover:bg-primary/15 disabled:opacity-60"
                            >
                              {uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              Import
                            </button>
                            <button
                              type="button"
                              onClick={() => copyFileName(selectedFile)}
                              disabled={!selectedFile}
                              className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background/60 px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {copiedFileId &&
                              copiedFileId === selectedFile?.id ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => startRenameFile(selectedFile)}
                              disabled={!selectedFile || !canRenameSelectedFile}
                              className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background/60 px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                selectedFile && deleteFile(selectedFile)
                              }
                              disabled={
                                !selectedFile ||
                                !canDeleteSelectedFile ||
                                deletingFileId === selectedFile?.id
                              }
                              className="flex h-9 items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 text-xs font-bold text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {deletingFileId === selectedFile?.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          </div>
                        </div>

                        {renamingFileId && (
                          <div className="mb-3 rounded-2xl border border-primary/25 bg-primary/10 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-black text-primary">Rename selected file</p>
                              <button
                                type="button"
                                onClick={cancelRenameFile}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/70 text-muted-foreground transition hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={renamingFileName}
                                onChange={(event) => setRenamingFileName(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveFileRename();
                                  }
                                  if (event.key === "Escape") {
                                    cancelRenameFile();
                                  }
                                }}
                                className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                                placeholder="New file name"
                                autoFocus
                              />
                              <Button
                                type="button"
                                onClick={saveFileRename}
                                disabled={savingFileRename || !renamingFileName.trim()}
                                className="h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground"
                              >
                                {savingFileRename ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Save
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 pr-1">
                          {fileFolders.map((folder) => (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => setActiveFileFolder(folder.id)}
                              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${activeFileFolder === folder.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/50 hover:border-primary/30"}`}
                            >
                              {folder.id === "zip" ? (
                                <FileArchive className="h-3.5 w-3.5" />
                              ) : (
                                <FolderOpen className="h-3.5 w-3.5" />
                              )}
                              <span className="text-[11px] font-black">
                                {folder.name}
                              </span>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">
                                {folder.count}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-muted-foreground">
                            {
                              fileFolders.find(
                                (folder) => folder.id === activeFileFolder,
                              )?.name
                            }
                          </p>
                          <div className="flex rounded-xl border border-border bg-background/60 p-1">
                            <button
                              type="button"
                              onClick={() => setFileExplorerView("details")}
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${fileExplorerView === "details" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setFileExplorerView("icons")}
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${fileExplorerView === "icons" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              Icons
                            </button>
                          </div>
                        </div>

                        <div className="max-h-[500px] overflow-auto pr-1">
                          {visibleFiles.length === 0 ? (
                            <div className="rounded-3xl border border-border bg-background/40 p-5 text-center text-sm text-muted-foreground">
                              <FolderOpen className="mx-auto mb-2 h-8 w-8 text-primary" />
                              No files in this folder yet.
                            </div>
                          ) : fileExplorerView === "icons" ? (
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                              {visibleFiles.map((file) => {
                                const fileType = getFileTypeLabel(file);
                                const canDelete =
                                  file.uploadedByUserId === session?.userId ||
                                  [
                                    "admin",
                                    "creator",
                                    "business_owner",
                                  ].includes(String(session?.role));
                                return (
                                  <div
                                    key={file.id}
                                    onClick={() => setSelectedFileId(file.id)}
                                    className={`group cursor-pointer rounded-xl border bg-background/50 p-2 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.04] ${selectedFileId === file.id ? "border-primary/50 bg-primary/10" : "border-border"}`}
                                  >
                                    <div className="mb-2 flex justify-center">
                                      {renderFileThumb(file, "h-12 w-12")}
                                    </div>
                                    <p
                                      className="truncate text-center text-xs font-black"
                                      title={file.fileName}
                                    >
                                      {file.fileName}
                                    </p>
                                    <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                                      {fileType}
                                    </p>
                                    <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                                      {formatDateAdded(file.createdAt)}
                                    </p>
                                    <div className="mt-2 flex gap-1.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 flex-1 text-[10px]"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          downloadEncryptedFile(
                                            file,
                                            selectedTeam.securityKey,
                                          );
                                        }}
                                      >
                                        <Download className="h-3.5 w-3.5" />{" "}
                                        Download
                                      </Button>
                                      {canDelete && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            deleteFile(file);
                                          }}
                                          disabled={deletingFileId === file.id}
                                        >
                                          {deletingFileId === file.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-2xl border border-border bg-background/40">
                              <div className="grid grid-cols-[minmax(0,1.5fr)_105px_78px_112px] gap-2 border-b border-border bg-muted/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                                <span>Name</span>
                                <span>Date Added</span>
                                <span>Type</span>
                                <span className="text-right">Actions</span>
                              </div>
                              <div className="divide-y divide-border">
                                {visibleFiles.map((file) => {
                                  const fileType = getFileTypeLabel(file);
                                  const canDelete =
                                    file.uploadedByUserId === session?.userId ||
                                    [
                                      "admin",
                                      "creator",
                                      "business_owner",
                                    ].includes(String(session?.role));
                                  return (
                                    <div
                                      key={file.id}
                                      onClick={() => setSelectedFileId(file.id)}
                                      className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_100px_80px_88px] items-center gap-3 px-3 py-2 text-xs transition hover:bg-primary/[0.04] ${selectedFileId === file.id ? "bg-primary/10 ring-1 ring-primary/20" : ""}`}
                                    >
                                      <div className="flex min-w-0 items-center gap-3">
                                        {renderFileThumb(file, "h-9 w-9")}
                                        <div className="min-w-0">
                                          <p
                                            className="truncate font-black"
                                            title={file.fileName}
                                          >
                                            {file.fileName}
                                          </p>
                                          <p className="truncate text-[10px] text-muted-foreground">
                                            Imported by {file.uploadedByName}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="truncate text-[11px] text-muted-foreground">
                                        {formatDateAdded(file.createdAt)}
                                      </span>
                                      <span className="truncate rounded-full border border-border bg-background/60 px-2 py-1 text-center text-[10px] font-bold text-muted-foreground">
                                        {fileType}
                                      </span>
                                      <div className="flex justify-end gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[10px]"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            startRenameFile(file);
                                          }}
                                          disabled={!canDelete}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[10px]"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            copyFileName(file);
                                          }}
                                        >
                                          {copiedFileId === file.id ? (
                                            <Check className="h-3.5 w-3.5" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[10px]"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            downloadEncryptedFile(
                                              file,
                                              selectedTeam.securityKey,
                                            );
                                          }}
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </Button>
                                        {canDelete && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              deleteFile(file);
                                            }}
                                            disabled={
                                              deletingFileId === file.id
                                            }
                                          >
                                            {deletingFileId === file.id ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
