import { TaskStatus, SrtBlock, AudioSource } from "./types";
import { Clock, LoaderCircle, CheckCircle, AlertCircle } from "lucide-react";

export function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fileStem(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function statusMeta(status: TaskStatus) {
  if (status === "pending") return { label: "等待中", className: "bg-slate-100 text-slate-600", icon: Clock };
  if (status === "processing") return { label: "处理中", className: "bg-blue-50 text-blue-700", icon: LoaderCircle };
  if (status === "completed") return { label: "已完成", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle };
  return { label: "失败", className: "bg-rose-50 text-rose-700", icon: AlertCircle };
}

export function splitParagraphs(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  return normalized
    .split(/(?<=[。！？.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSrt(srt: string): SrtBlock[] {
  return srt
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex < 0) return null;
      return {
        index: timeIndex > 0 ? lines[0] : "",
        time: lines[timeIndex],
        text: lines.slice(timeIndex + 1).join(" "),
      };
    })
    .filter((block): block is SrtBlock => Boolean(block && block.text));
}

export function audioSourceToObjectUrl(source: AudioSource) {
  const binary = atob(source.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: source.mime }));
}
