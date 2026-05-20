import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Cloud,
  Cpu,
  Download,
  FileAudio,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Subtitles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";

type Mode = "website" | "local" | "api";
type ResultFormat = "txt" | "srt";
type TaskStatus = "pending" | "processing" | "completed" | "error";

interface KeyValueField {
  key: string;
  value: string;
}

interface OnlineSiteConfig {
  id: string;
  name: string;
  endpointUrl: string;
  fileField: string;
  responseTextPath: string;
  tokenField?: string;
  token?: string;
  extraFields: KeyValueField[];
}

interface ApiConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  temperature: string;
  timeoutSeconds: string;
}

interface TranscriptionResult {
  srt: string;
  txt: string;
}

interface Task {
  id: string;
  filename: string;
  filePath: string;
  mode: Mode;
  status: TaskStatus;
  progress: number;
  result?: TranscriptionResult;
  errorMsg?: string;
  displayFormat: ResultFormat;
}

interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number | null;
}

interface AudioSource {
  mime: string;
  data: string;
}

interface ModalState {
  title: string;
  content?: string;
  task?: Task;
  initialTab?: ResultFormat;
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
}

interface SrtBlock {
  index: string;
  time: string;
  text: string;
}

const DEFAULT_ONLINE_SITES: OnlineSiteConfig[] = [
  {
    id: "text-to-speech-cn",
    name: "text-to-speech.cn",
    endpointUrl: "https://www.text-to-speech.cn/getSrt.php",
    fileField: "video",
    responseTextPath: "text",
    tokenField: "token",
    token: "980a862af0f63e77d1b1aff6212cc38c",
    extraFields: [{ key: "type", value: "stt" }],
  },
];

const DEFAULT_API_CONFIG: ApiConfig = {
  providerName: "OpenAI",
  baseUrl: "https://api.openai.com/v1/audio/transcriptions",
  apiKey: "",
  model: "whisper-1",
  language: "zh",
  prompt: "",
  temperature: "0",
  timeoutSeconds: "120",
};

const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "flac", "mp4", "aac", "ogg", "webm"];
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-3 focus:ring-blue-100";
const textAreaClass =
  "min-h-24 w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-3 focus:ring-blue-100";

function BatchSrtIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="BatchSRT icon">
      <rect width="64" height="64" rx="14" fill="#2563eb" />
      <path d="M18 19h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H28l-9 7v-7h-1a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6Z" fill="#fff" opacity=".96" />
      <path d="M24 28h18M24 36h10M39 36h5" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 16h8M16 12h18" stroke="#bfdbfe" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileStem(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function statusMeta(status: TaskStatus) {
  if (status === "pending") return { label: "等待中", className: "bg-slate-100 text-slate-600", icon: Clock };
  if (status === "processing") return { label: "处理中", className: "bg-blue-50 text-blue-700", icon: LoaderCircle };
  if (status === "completed") return { label: "已完成", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle };
  return { label: "失败", className: "bg-rose-50 text-rose-700", icon: AlertCircle };
}

function splitParagraphs(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  return normalized
    .split(/(?<=[。！？.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSrt(srt: string): SrtBlock[] {
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

function audioSourceToObjectUrl(source: AudioSource) {
  const binary = atob(source.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: source.mime }));
}

function App() {
  const [mode, setMode] = useState<Mode>("website");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [onlineSites, setOnlineSites] = useState<OnlineSiteConfig[]>(() =>
    loadJson("onlineSites", DEFAULT_ONLINE_SITES),
  );
  const [onlineSiteId, setOnlineSiteId] = useState(() => localStorage.getItem("onlineSiteId") || "text-to-speech-cn");
  const [siteDraft, setSiteDraft] = useState<OnlineSiteConfig>({
    id: "",
    name: "",
    endpointUrl: "",
    fileField: "file",
    responseTextPath: "text",
    extraFields: [],
  });
  const [extraFieldDraft, setExtraFieldDraft] = useState<KeyValueField>({ key: "", value: "" });
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => loadJson("apiConfig", DEFAULT_API_CONFIG));
  const [modelPath, setModelPath] = useState(() => localStorage.getItem("modelPath") || "");
  const [exePath, setExePath] = useState(() => localStorage.getItem("exePath") || "");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalTab, setModalTab] = useState<ResultFormat>("txt");
  const [player, setPlayer] = useState<HTMLAudioElement | null>(null);
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const selectedSite = useMemo(
    () => onlineSites.find((site) => site.id === onlineSiteId) || onlineSites[0],
    [onlineSiteId, onlineSites],
  );
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const activeTasks = tasks.filter((task) => task.status === "processing" || task.status === "pending").length;
  const historyTasks = tasks.filter((task) => task.status === "completed" || task.status === "error").slice(-10).reverse();

  const modeConfig = {
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
  } satisfies Record<Mode, { title: string; badge: string; description: string; icon: typeof Cloud }>;

  const activeMode = modeConfig[mode];
  const ActiveModeIcon = activeMode.icon;

  useEffect(() => localStorage.setItem("onlineSites", JSON.stringify(onlineSites)), [onlineSites]);
  useEffect(() => localStorage.setItem("onlineSiteId", onlineSiteId), [onlineSiteId]);
  useEffect(() => localStorage.setItem("apiConfig", JSON.stringify(apiConfig)), [apiConfig]);
  useEffect(() => {
    if (modal?.initialTab) setModalTab(modal.initialTab);
  }, [modal]);

  useEffect(() => {
    return () => {
      player?.pause();
    };
  }, [player]);

  useEffect(() => {
    if (!isTauri || !exePath) return;
    invoke("validate_local_executable", { executablePath: exePath }).catch(() => {
      setExePath("");
      localStorage.removeItem("exePath");
    });
  }, []);

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;

    if (isTauri) {
      listen<DownloadProgress>("download_progress", (event) => {
        setDownloadProgress(event.payload);
      })
        .then((f) => {
          unlistenProgress = f;
        })
        .catch(console.error);

      getCurrentWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type !== "drop") return;
          for (const path of event.payload.paths) {
            const filename = path.split(/[\\/]/).pop() || path;
            const ext = filename.split(".").pop()?.toLowerCase() || "";
            if (AUDIO_EXTENSIONS.includes(ext)) void processFilePath(path, filename);
          }
          setIsDragging(false);
        })
        .then((f) => {
          unlistenDrop = f;
        })
        .catch(console.error);
    }

    return () => {
      unlistenProgress?.();
      unlistenDrop?.();
    };
  }, [mode, selectedSite, apiConfig, modelPath, exePath]);

  const updateApiConfig = (patch: Partial<ApiConfig>) => setApiConfig((prev) => ({ ...prev, ...patch }));

  const validateRuntime = () => {
    if (!isTauri) throw new Error("请在 Tauri 桌面环境中运行应用，例如 npm run tauri dev。");
  };

  const stopAudio = () => {
    player?.pause();
    if (player) player.currentTime = 0;
    setPlayer(null);
    setPlayingTaskId(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const playTaskAudio = async (task: Task) => {
    try {
      stopAudio();
      const source = isTauri
        ? await invoke<AudioSource>("read_audio_source", { filePath: task.filePath })
        : { mime: "audio/mpeg", data: "" };
      const src = isTauri ? audioSourceToObjectUrl(source) : task.filePath;
      const audio = new Audio(src);
      audio.onended = () => {
        URL.revokeObjectURL(src);
        setAudioUrl(null);
        setPlayer(null);
        setPlayingTaskId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(src);
        setAudioUrl(null);
        setModal({
          title: "BatchSRT",
          content: "无法播放该音频文件。已使用 Tauri 后端读取本地文件，但当前系统 WebView 仍不支持该编码格式，请尝试 MP3、WAV、FLAC 或 WEBM。",
        });
        setPlayingTaskId(null);
      };
      setAudioUrl(src);
      setPlayer(audio);
      setPlayingTaskId(task.id);
      await audio.play();
    } catch (error) {
      setModal({ title: "BatchSRT", content: String(error).replace(/^Error:\s*/, "") });
    }
  };

  const moveSite = (siteId: string, direction: -1 | 1) => {
    setOnlineSites((prev) => {
      const index = prev.findIndex((site) => site.id === siteId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeSite = (siteId: string) => {
    if (onlineSites.length === 1) return;
    setOnlineSites((prev) => prev.filter((site) => site.id !== siteId));
    if (onlineSiteId === siteId) {
      setOnlineSiteId(onlineSites.find((site) => site.id !== siteId)?.id || DEFAULT_ONLINE_SITES[0].id);
    }
  };

  const addExtraFieldToDraft = () => {
    if (!extraFieldDraft.key.trim()) return;
    setSiteDraft((prev) => ({
      ...prev,
      extraFields: [...prev.extraFields, { key: extraFieldDraft.key.trim(), value: extraFieldDraft.value }],
    }));
    setExtraFieldDraft({ key: "", value: "" });
  };

  const addCustomSite = () => {
    if (!siteDraft.name.trim() || !siteDraft.endpointUrl.trim() || !siteDraft.fileField.trim()) return;
    const nextSite: OnlineSiteConfig = {
      ...siteDraft,
      id: createId(),
      name: siteDraft.name.trim(),
      endpointUrl: siteDraft.endpointUrl.trim(),
      fileField: siteDraft.fileField.trim(),
      responseTextPath: siteDraft.responseTextPath.trim() || "text",
      tokenField: siteDraft.tokenField?.trim() || undefined,
      token: siteDraft.token?.trim() || undefined,
    };
    setOnlineSites((prev) => [...prev, nextSite]);
    setOnlineSiteId(nextSite.id);
    setSiteDraft({ id: "", name: "", endpointUrl: "", fileField: "file", responseTextPath: "text", extraFields: [] });
    setExtraFieldDraft({ key: "", value: "" });
  };

  const runTranscription = async (task: Task) => {
    validateRuntime();
    if (task.mode === "website") {
      if (!selectedSite) throw new Error("请先选择在线网站。");
      return invoke<TranscriptionResult>("upload_audio_online", { site: selectedSite, filePaths: [task.filePath] });
    }
    if (task.mode === "local") {
      const localConfig = await ensureLocalModelConfig();
      return invoke<TranscriptionResult>("run_local_model", {
        executablePath: localConfig.executablePath,
        modelPath: localConfig.modelPath,
        audioPath: task.filePath,
      });
    }
    if (!apiConfig.apiKey.trim()) throw new Error("请先填写在线模型 API Key。");
    return invoke<TranscriptionResult>("whisper_api_transcribe", { config: apiConfig, filePath: task.filePath });
  };

  const downloadTinyModel = async () => {
    setIsDownloading(true);
    setDownloadProgress(null);
    try {
      const downloadedModelPath = await invoke<string>("download_dependency", {
        url: "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        filename: "ggml-tiny.bin",
      });
      setModelPath(downloadedModelPath);
      localStorage.setItem("modelPath", downloadedModelPath);
      return downloadedModelPath;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const ensureLocalModelConfig = async () => {
    validateRuntime();
    let nextExePath = exePath;
    let nextModelPath = modelPath;

    if (!nextExePath) {
      setModal({
        title: "BatchSRT",
        content: "本地解析需要先选择 whisper.cpp 的 Windows 可执行文件。请选择 whisper-cli.exe、main.exe 或同类 exe 文件。",
      });
      const selected = await open({ multiple: false, filters: [{ name: "Windows executable", extensions: ["exe"] }] });
      if (!selected) throw new Error("已取消选择本地模型程序。");
      nextExePath = String(selected);
      await invoke("validate_local_executable", { executablePath: nextExePath });
      setExePath(nextExePath);
      localStorage.setItem("exePath", nextExePath);
    }

    if (!nextModelPath) {
      setModal({
        title: "BatchSRT",
        content: "未选择 ggml 模型文件，正在自动下载 Tiny 模型。下载完成后会继续解析当前音频。",
      });
      nextModelPath = await downloadTinyModel();
    }

    return { executablePath: nextExePath, modelPath: nextModelPath };
  };

  const handleCheckUpdate = async () => {
    try {
      validateRuntime();
      setIsCheckingUpdate(true);
      const update = await check();
      
      if (update) {
        setModal({
          title: "发现新版本",
          content: `发现新版本 ${update.version}！\n\n更新说明：\n${update.body || "无详细说明"}\n\n是否立即下载并安装更新？`,
          actionLabel: "下载并安装",
          onAction: async () => {
            setModal({ title: "正在更新", content: "正在下载并安装更新，请稍候...\n这可能需要一些时间，期间请勿关闭应用。" });
            let downloaded = 0;
            
            await update.downloadAndInstall((event) => {
              switch (event.event) {
                case 'Started':
                  console.log('Update started:', event.data.contentLength);
                  break;
                case 'Progress':
                  downloaded += event.data.chunkLength;
                  // 这里可以考虑将下载进度更新到 UI，目前暂时简化为文字提示
                  console.log('Update progress:', downloaded);
                  break;
                case 'Finished':
                  break;
              }
            });
            
            setModal({
              title: "更新完成",
              content: "更新下载并安装完成！即将重启应用。",
              actionLabel: "立即重启",
              onAction: async () => {
                await relaunch();
              }
            });
          }
        });
      } else {
        setModal({ title: "检查更新", content: "当前已是最新版本！" });
      }
    } catch (err) {
      setModal({ title: "检查更新失败", content: String(err).replace(/^Error:\s*/, "") });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const executeTask = async (task: Task) => {
    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, status: "processing", progress: 18, errorMsg: undefined } : item)),
    );
    try {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, progress: 56 } : item)));
      const result = await runTranscription(task);
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, status: "completed", progress: 100, result, errorMsg: undefined } : item,
        ),
      );
    } catch (error) {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? { ...item, status: "error", progress: 100, errorMsg: String(error).replace(/^Error:\s*/, "") }
            : item,
        ),
      );
    }
  };

  const processFilePath = async (filePath: string, filename: string) => {
    const task: Task = { id: createId(), filename, filePath, mode, status: "pending", progress: 0, displayFormat: "txt" };
    setTasks((prev) => [...prev, task]);
    await executeTask(task);
  };

  const retryTask = async (task: Task) => executeTask({ ...task, mode, result: undefined });

  const retryFailedTasks = async () => {
    for (const task of tasks.filter((item) => item.status === "error")) await retryTask(task);
  };

  const handleSelectFiles = async () => {
    try {
      validateRuntime();
      const selected = await open({ multiple: true, filters: [{ name: "Audio", extensions: AUDIO_EXTENSIONS }] });
      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      for (const path of paths) {
        const pathStr = String(path);
        await processFilePath(pathStr, pathStr.split(/[\\/]/).pop() || pathStr);
      }
    } catch (err) {
      setModal({ title: "选择文件失败", content: String(err).replace(/^Error:\s*/, "") });
    }
  };

  const handleSelectExe = async () => {
    try {
      validateRuntime();
      const selected = await open({ multiple: false, filters: [{ name: "Windows executable", extensions: ["exe"] }] });
      if (!selected) return;
      const path = String(selected);
      await invoke("validate_local_executable", { executablePath: path });
      setExePath(path);
      localStorage.setItem("exePath", path);
      setModal({ title: "程序已选择", content: `已选择本地模型程序：\n${path}` });
    } catch (err) {
      setExePath("");
      localStorage.removeItem("exePath");
      setModal({
        title: "选择程序失败",
        content:
          `${String(err).replace(/^Error:\s*/, "")}\n\n` +
          "请在 whisper.cpp 的 Windows 发布包中选择 whisper-cli.exe、main.exe 或类似的 .exe 文件；不要选择 .bin 模型文件、压缩包、快捷方式或旧版本误下载的 whisper.exe。",
      });
    }
  };

  const handleSelectModel = async () => {
    try {
      validateRuntime();
      const selected = await open({ multiple: false, filters: [{ name: "Whisper model", extensions: ["bin"] }] });
      if (selected) {
        const path = String(selected);
        setModelPath(path);
        localStorage.setItem("modelPath", path);
      }
    } catch (err) {
      setModal({ title: "选择模型失败", content: String(err).replace(/^Error:\s*/, "") });
    }
  };

  const handleDownloadModel = async () => {
    try {
      validateRuntime();
      setIsDownloading(true);
      setDownloadProgress(null);
      const downloadedModelPath = await invoke<string>("download_dependency", {
        url: "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        filename: "ggml-tiny.bin",
      });
      setModelPath(downloadedModelPath);
      localStorage.setItem("modelPath", downloadedModelPath);
      setModal({ title: "BatchSRT", content: `Tiny 模型已下载到：\n${downloadedModelPath}` });
    } catch (error) {
      setModal({ title: "BatchSRT", content: `下载失败：${String(error).replace(/^Error:\s*/, "")}` });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const saveTaskResult = async (task: Task, format: ResultFormat = task.displayFormat) => {
    if (!task.result) return;
    const content = format === "srt" ? task.result.srt : task.result.txt;
    
    // 直接保存在音频文件相同目录下
    const directoryMatch = task.filePath.match(/^(.*[\\/])/);
    const directory = directoryMatch ? directoryMatch[1] : "";
    const baseFilename = fileStem(task.filename);
    const targetPath = `${directory}${baseFilename}.${format}`;
    
    try {
      await writeTextFile(targetPath, content);
      alert(`已保存 ${format.toUpperCase()} 文件：\n${targetPath}`);
    } catch (err) {
      setModal({ title: "保存失败", content: String(err).replace(/^Error:\s*/, "") });
    }
  };

  const bulkDownload = async () => {
    const completed = tasks.filter((task) => task.status === "completed" && task.result);
    if (completed.length === 0) return;
    try {
      validateRuntime();
      const selectedDir = await open({ directory: true, multiple: false });
      if (!selectedDir) return;
      const dir = String(selectedDir);
      const separator = dir.includes("\\") ? "\\" : "/";
      for (const task of completed) {
        await writeTextFile(`${dir}${separator}${fileStem(task.filename)}.txt`, task.result!.txt);
        await writeTextFile(`${dir}${separator}${fileStem(task.filename)}.srt`, task.result!.srt);
      }
      setModal({ title: "批量下载完成", content: `已保存 ${completed.length} 个任务的 TXT 和 SRT 到：\n${dir}` });
    } catch (err) {
      setModal({ title: "批量下载失败", content: String(err).replace(/^Error:\s*/, "") });
    }
  };

  const openTaskModal = (task: Task, initialTab: ResultFormat = "txt") => {
    setModal({
      title: `BatchSRT - ${task.filename}`,
      task,
      initialTab,
      actionLabel: "保存当前格式",
      onAction: () => saveTaskResult({ ...task, displayFormat: modalTab }, modalTab),
    });
  };

  const renderResultBody = (task: Task, tab: ResultFormat) => {
    if (!task.result) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          {task.errorMsg ? `任务失败：${task.errorMsg}` : "暂无结果。"}
        </div>
      );
    }
    if (tab === "txt") {
      const paragraphs = splitParagraphs(task.result.txt);
      return (
        <div className="space-y-3">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 8)}`} className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
              {paragraph}
            </p>
          ))}
        </div>
      );
    }

    const blocks = parseSrt(task.result.srt);
    return (
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={`${block.index}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {block.index && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">#{block.index}</span>}
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{block.time}</span>
            </div>
            <p className="text-sm leading-7 text-slate-800">{block.text}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderTaskActions = (task: Task) => (
    <div className="flex flex-wrap gap-2">
      {playingTaskId === task.id ? (
        <button onClick={stopAudio} className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
          <Pause size={14} />
          停止
        </button>
      ) : (
        <button onClick={() => playTaskAudio(task)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
          <Play size={14} />
          播放
        </button>
      )}
      {task.result && (
        <>
          <button onClick={() => openTaskModal(task, "txt")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
            <FileText size={14} />
            分段 TXT
          </button>
          <button onClick={() => openTaskModal(task, "srt")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
            <Subtitles size={14} />
            SRT 字幕
          </button>
          <button onClick={() => saveTaskResult(task)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-blue-700">
            <Save size={14} />
            保存本地
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-800">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[304px] shrink-0 border-r border-slate-200 bg-white shadow-[1px_0_20px_rgba(15,23,42,0.05)] lg:flex lg:flex-col">
          <div className="border-b border-slate-100 px-6 py-6">
            <h1 className="flex items-center gap-3 text-[22px] font-semibold text-slate-950">
              <span className="grid h-10 w-10 place-items-center rounded-lg shadow-sm">
                <BatchSrtIcon size={40} />
              </span>
              BatchSRT
            </h1>
            <p className="mt-2 text-sm text-slate-500">批量音频转写工作台</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <section>
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">处理模式</h2>
              <div className="mt-3 space-y-2">
                {(Object.keys(modeConfig) as Mode[]).map((itemMode) => {
                  const item = modeConfig[itemMode];
                  const Icon = item.icon;
                  return (
                    <button
                      key={itemMode}
                      onClick={() => setMode(itemMode)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        mode === itemMode
                          ? "border-blue-200 bg-blue-50 text-blue-900"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 place-items-center rounded-lg ${mode === itemMode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{item.title}</span>
                          <span className="block truncate text-xs text-slate-500">{item.badge}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <ActiveModeIcon size={18} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">{activeMode.title}</h2>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">{activeMode.badge}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{activeMode.description}</p>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <History size={13} />
                历史记录
              </h2>
              <div className="mt-3 space-y-2">
                {historyTasks.length === 0 && <p className="px-1 text-xs text-slate-400">暂无历史任务</p>}
                {historyTasks.map((task) => {
                  const meta = statusMeta(task.status);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={task.id}
                      onClick={() => openTaskModal(task, task.result ? "txt" : "srt")}
                      className="w-full rounded-lg border border-slate-100 bg-white px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{task.filename}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
          
          <div className="mt-auto border-t border-slate-100 px-5 py-4">
            <button
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingUpdate ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {isCheckingUpdate ? "检查中..." : "检查更新"}
            </button>
            <p className="mt-2 text-center text-[10px] text-slate-400">v0.1.0</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 lg:px-10">
            <header className="rounded-lg border border-white bg-white p-5 shadow-[0_14px_44px_rgba(15,23,42,0.06)] md:flex md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  <BatchSrtIcon size={16} />
                  BatchSRT
                  <span className="h-3 w-px bg-slate-300" />
                  <ActiveModeIcon size={14} />
                  当前模式：{activeMode.title}
                </div>
                <h2 className="text-2xl font-semibold text-slate-950 md:text-3xl">上传音频并生成字幕</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  支持批量选择、拖拽上传、播放音频、失败重试、TXT/SRT 预览与保存。
                </p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-2 text-center md:mt-0">
                <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-slate-950">{tasks.length}</div><div className="text-[11px] text-slate-500">全部</div></div>
                <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-blue-700">{activeTasks}</div><div className="text-[11px] text-slate-500">进行中</div></div>
                <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-emerald-700">{completedTasks}</div><div className="text-[11px] text-slate-500">完成</div></div>
              </div>
            </header>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-6">
                <section
                  className={`rounded-lg border p-7 transition ${isDragging ? "border-blue-400 bg-blue-50" : "border-blue-100 bg-white hover:border-blue-300"} shadow-[0_14px_44px_rgba(15,23,42,0.06)]`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onClick={handleSelectFiles}
                >
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className={`grid h-18 w-18 place-items-center rounded-lg ${isDragging ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                      <UploadCloud size={36} strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">选择音频文件或拖拽到这里</h3>
                      <p className="mt-2 text-sm text-slate-500">支持 MP3、WAV、M4A、FLAC、MP4、AAC、OGG、WEBM</p>
                    </div>
                    <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
                      <FolderOpen size={18} />
                      浏览文件
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold text-slate-950">处理任务列表</h3>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                          {tasks.length} 个任务
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">播放、查看字幕、保存、重试和删除都在列表项内完成。</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:flex-nowrap">
                      <button onClick={bulkDownload} disabled={completedTasks === 0} className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45"><Download size={14} />下载</button>
                      <button onClick={retryFailedTasks} disabled={!tasks.some((task) => task.status === "error")} className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45"><RefreshCw size={14} />重试</button>
                      <button onClick={() => setTasks([])} disabled={tasks.length === 0} className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"><Trash2 size={14} />清空</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_72px_112px] gap-3 border-b border-slate-100 bg-white px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:grid-cols-[minmax(0,1fr)_120px_330px]">
                    <span>音频任务</span>
                    <span>状态</span>
                    <span>操作</span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-400"><Clock size={22} /></div>
                      <p className="text-sm font-medium text-slate-600">暂无处理任务</p>
                      <p className="mt-1 text-sm text-slate-400">选择文件后，转写进度和结果会出现在这里。</p>
                    </div>
                  ) : (
                    <>
                    <div className="divide-y divide-slate-100">
                      {tasks.map((task) => {
                        const meta = statusMeta(task.status);
                        const StatusIcon = meta.icon;
                        return (
                          <article id={`task-${task.id}`} key={task.id} className="p-5 transition hover:bg-slate-50">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="flex min-w-0 gap-3">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileAudio size={21} /></span>
                                <div className="min-w-0">
                                  <h4 className="truncate text-sm font-semibold text-slate-900" title={task.filename}>{task.filename}</h4>
                                  <p className="mt-1 truncate text-xs text-slate-400" title={task.filePath}>{task.filePath}</p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${meta.className}`}>
                                  <StatusIcon size={14} className={task.status === "processing" ? "animate-spin" : ""} />
                                  {meta.label}
                                </span>
                                {task.status === "error" && <button onClick={() => retryTask(task)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700" title="重试"><RefreshCw size={16} /></button>}
                                <button onClick={() => setTasks((prev) => prev.filter((item) => item.id !== task.id))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="移除任务"><X size={16} /></button>
                              </div>
                            </div>

                            {(task.status === "processing" || task.status === "pending") && (
                              <div className="mt-4">
                                <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500"><span>处理进度</span><span>{task.progress}%</span></div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${task.progress}%` }} />
                                </div>
                              </div>
                            )}

                            <div className="mt-4">{renderTaskActions(task)}</div>

                            {task.status === "error" && task.errorMsg && (
                              <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">{task.errorMsg}</div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    </>
                  )}
                </section>
              </div>

              <aside className="min-w-0 space-y-6">
                {mode === "website" && (
                  <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_44px_rgba(15,23,42,0.05)]">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Cloud size={18} />在线网站</h3>
                    <div className="mt-4 space-y-3">
                      {onlineSites.map((site, index) => (
                        <div key={site.id} className={`rounded-lg border p-3 ${selectedSite?.id === site.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
                          <label className="flex items-start gap-3">
                            <input type="radio" className="mt-1" checked={selectedSite?.id === site.id} onChange={() => setOnlineSiteId(site.id)} />
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{site.name}</span><span className="block truncate text-xs text-slate-500">{site.endpointUrl}</span></span>
                          </label>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => moveSite(site.id, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-35" title="上移"><ArrowUp size={14} /></button>
                            <button onClick={() => moveSite(site.id, 1)} disabled={index === onlineSites.length - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-35" title="下移"><ArrowDown size={14} /></button>
                            <button onClick={() => removeSite(site.id)} disabled={onlineSites.length === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-35" title="删除"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Plus size={15} />添加自定义网站</h4>
                      <div className="grid min-w-0 gap-3">
                        <input value={siteDraft.name} onChange={(event) => setSiteDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="网站名称，例如 My STT" className={inputClass} />
                        <input value={siteDraft.endpointUrl} onChange={(event) => setSiteDraft((prev) => ({ ...prev, endpointUrl: event.target.value }))} placeholder="上传接口 URL，例如 https://example.com/stt" className={inputClass} />
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                          <input value={siteDraft.fileField} onChange={(event) => setSiteDraft((prev) => ({ ...prev, fileField: event.target.value }))} placeholder="文件字段名，如 file" className={inputClass} />
                          <input value={siteDraft.responseTextPath} onChange={(event) => setSiteDraft((prev) => ({ ...prev, responseTextPath: event.target.value }))} placeholder="结果字段路径，如 data.text" className={inputClass} />
                        </div>
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                          <input value={siteDraft.tokenField || ""} onChange={(event) => setSiteDraft((prev) => ({ ...prev, tokenField: event.target.value }))} placeholder="Token 字段名，可空" className={inputClass} />
                          <input value={siteDraft.token || ""} onChange={(event) => setSiteDraft((prev) => ({ ...prev, token: event.target.value }))} placeholder="Token 值，可空" className={inputClass} />
                        </div>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2">
                          <input value={extraFieldDraft.key} onChange={(event) => setExtraFieldDraft((prev) => ({ ...prev, key: event.target.value }))} placeholder="额外字段" className={inputClass} />
                          <input value={extraFieldDraft.value} onChange={(event) => setExtraFieldDraft((prev) => ({ ...prev, value: event.target.value }))} placeholder="字段值" className={inputClass} />
                          <button onClick={addExtraFieldToDraft} className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700" title="添加字段"><Plus size={16} /></button>
                        </div>
                        {siteDraft.extraFields.length > 0 && <p className="text-xs text-slate-500">已添加字段：{siteDraft.extraFields.map((field) => field.key).join("、")}</p>}
                        <button onClick={addCustomSite} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"><Plus size={16} />添加网站</button>
                      </div>
                    </div>
                  </section>
                )}

                {mode === "api" && (
                  <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_44px_rgba(15,23,42,0.05)]">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Settings size={18} />在线模型配置</h3>
                    <div className="mt-3 rounded-lg bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-900">
                      默认兼容 OpenAI 音频转写接口。Base URL 填完整转写端点；模型默认 whisper-1；语言填 ISO 代码，如 zh、en；提示词可填专有名词、人名或行业词；温度通常 0 到 1。
                    </div>
                    <div className="mt-4 grid min-w-0 gap-3">
                      <label className="grid gap-1 text-xs font-semibold text-slate-600">服务商名称<input value={apiConfig.providerName} onChange={(event) => updateApiConfig({ providerName: event.target.value })} placeholder="OpenAI / 自建 OpenAI 兼容服务" className={inputClass} /></label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-600">Base URL<input value={apiConfig.baseUrl} onChange={(event) => updateApiConfig({ baseUrl: event.target.value })} placeholder="https://api.openai.com/v1/audio/transcriptions" className={inputClass} /></label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-600">API Key<input type="password" value={apiConfig.apiKey} onChange={(event) => updateApiConfig({ apiKey: event.target.value })} placeholder="sk-..." className={inputClass} /></label>
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-semibold text-slate-600">模型<input value={apiConfig.model} onChange={(event) => updateApiConfig({ model: event.target.value })} placeholder="whisper-1" className={inputClass} /></label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-600">语言<input value={apiConfig.language} onChange={(event) => updateApiConfig({ language: event.target.value })} placeholder="zh" className={inputClass} /></label>
                      </div>
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-semibold text-slate-600">温度<input value={apiConfig.temperature} onChange={(event) => updateApiConfig({ temperature: event.target.value })} placeholder="0" className={inputClass} /></label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-600">超时秒数<input value={apiConfig.timeoutSeconds} onChange={(event) => updateApiConfig({ timeoutSeconds: event.target.value })} placeholder="120" className={inputClass} /></label>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold text-slate-600">提示词 / 上下文<textarea value={apiConfig.prompt} onChange={(event) => updateApiConfig({ prompt: event.target.value })} placeholder="例如：会议涉及 Batch STT、Whisper、Tauri、字幕切分。" className={textAreaClass} /></label>
                    </div>
                  </section>
                )}

                {mode === "local" && (
                  <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_44px_rgba(15,23,42,0.05)]">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950"><HardDrive size={18} />本地模型</h3>
                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                      需要选择 whisper.cpp 的 Windows 可执行文件和 ggml 模型。模型可点下方下载 Tiny；程序请从 whisper.cpp 发布包中选择 whisper-cli.exe 或 main.exe。
                    </div>
                    <div className="mt-4 space-y-3">
                      <button onClick={handleSelectExe} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"><FolderOpen size={16} />选择 whisper 可执行文件</button>
                      {exePath && <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" title={exePath}>程序：{exePath}</p>}
                      <button onClick={handleSelectModel} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"><FolderOpen size={16} />选择模型文件</button>
                      {modelPath && <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" title={modelPath}>模型：{modelPath}</p>}
                      <button onClick={handleDownloadModel} disabled={isDownloading} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {isDownloading ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
                        {isDownloading ? "下载中..." : "下载 Tiny 模型"}
                      </button>
                      {isDownloading && downloadProgress && (
                        <div>
                          <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
                            <span className="truncate">{downloadProgress.filename}</span>
                            <span>{downloadProgress.total ? `${Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%` : `${(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB`}</span>
                          </div>
                          {downloadProgress.total && <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(downloadProgress.downloaded / downloadProgress.total) * 100}%` }} /></div>}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </aside>
            </section>
          </div>
        </main>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/42 px-4 py-6">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-950">BatchSRT</h3>
                {modal.title && modal.title !== "BatchSRT" && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{modal.title.replace(/^BatchSRT\s*-\s*/, "")}</p>
                )}
              </div>
              <button onClick={() => setModal(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="关闭弹窗"><X size={17} /></button>
            </div>

            {modal.task ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                  <div className="inline-flex rounded-lg bg-slate-100 p-1">
                    <button onClick={() => setModalTab("txt")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${modalTab === "txt" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>分段 TXT</button>
                    <button onClick={() => setModalTab("srt")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${modalTab === "srt" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>SRT 字幕</button>
                  </div>
                  {renderTaskActions(modal.task)}
                </div>
                <div className="max-h-[60vh] overflow-auto bg-slate-50 px-5 py-4">{renderResultBody(modal.task, modalTab)}</div>
              </>
            ) : (
              <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700">{modal.content || "无内容"}</pre>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setModal(null)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">关闭</button>
              {(modal.onAction || modal.task) && (
                <button
                  onClick={async () => {
                    if (modal.task) {
                      await saveTaskResult(modal.task, modalTab);
                    } else {
                      await modal.onAction?.();
                    }
                  }}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  {modal.actionLabel || (modal.task ? "保存当前格式" : "确认")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
