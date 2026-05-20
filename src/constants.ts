import { OnlineSiteConfig, ApiConfig, Mode } from "./types";
import { Cloud, Cpu, Server, LucideIcon } from "lucide-react";

export const MODE_CONFIG: Record<Mode, { title: string; badge: string; description: string; icon: LucideIcon }> = {
  website: {
    title: "在线网站",
    badge: "可自定义",
    description: "使用内置或自定义 multipart 上传站点，支持排序和字段配置。",
    icon: Cloud,
  },
  local: {
    title: "本地模型",
    badge: "离线处理",
    description: "选择 whisper.cpp 的 Windows exe 和 ggml 模型文件，音频不离开本机。",
    icon: Cpu,
  },
  api: {
    title: "在线模型",
    badge: "API 配置",
    description: "支持 OpenAI 兼容转写接口，可配置地址、模型、语言、提示词和超时。",
    icon: Server,
  },
};

export const DEFAULT_ONLINE_SITES: OnlineSiteConfig[] = [
  {
    id: "text-to-speech-cn",
    name: "text-to-speech.cn",
    endpointUrl: "https://www.text-to-speech.cn/getSrt.php",
    fileField: "video",
    responseTextPath: "text",
    tokenField: "token",
    token: "",
    fetchTokenUrl: "https://www.text-to-speech.cn/stt.html",
    fetchTokenRegex: "token['\"\\s:=]+([a-fA-F0-9]{32})",
    extraFields: [{ key: "type", value: "stt" }],
  },
  {
    id: "huggingface-whisper-api",
    name: "HuggingFace Whisper API (示例)",
    endpointUrl: "https://api-inference.huggingface.co/models/openai/whisper-small",
    fileField: "file",
    responseTextPath: "text",
    tokenField: "",
    token: "",
    fetchTokenUrl: "",
    fetchTokenRegex: "",
    extraFields: [],
  },
];

export const DEFAULT_API_CONFIG: ApiConfig = {
  providerName: "OpenAI",
  baseUrl: "https://api.openai.com/v1/audio/transcriptions",
  apiKey: "",
  model: "whisper-1",
  language: "zh",
  prompt: "",
  temperature: "0",
  timeoutSeconds: "120",
};

export const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "flac", "mp4", "aac", "ogg", "webm"];
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-3 focus:ring-blue-100";
export const textAreaClass =
  "min-h-24 w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-3 focus:ring-blue-100";
