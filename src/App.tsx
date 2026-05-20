import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Pause, Play, FileText, Subtitles, Save } from "lucide-react";

import {
  Mode,
  ResultFormat,
  KeyValueField,
  OnlineSiteConfig,
  ApiConfig,
  TranscriptionResult,
  Task,
  DownloadProgress,
  AudioSource,
  ModalState,
} from "./types";

import {
  DEFAULT_ONLINE_SITES,
  DEFAULT_API_CONFIG,
  AUDIO_EXTENSIONS,
  isTauri,
} from "./constants";

import { createId, fileStem, loadJson, audioSourceToObjectUrl } from "./utils";
import { TaskModal } from "./components/TaskModal";
import { Sidebar } from "./components/Sidebar";
import { MainHeader } from "./components/MainHeader";
import { Dropzone } from "./components/Dropzone";
import { TaskList } from "./components/TaskList";
import { OnlineSettings } from "./components/OnlineSettings";
import { ApiSettings } from "./components/ApiSettings";
import { LocalSettings } from "./components/LocalSettings";
import "./App.css";

function App() {
  const [mode, setMode] = useState<Mode>("website");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [onlineSites, setOnlineSites] = useState<OnlineSiteConfig[]>(() => {
    const loaded = loadJson<OnlineSiteConfig[]>("onlineSites", DEFAULT_ONLINE_SITES);
    return loaded.map(site => {
      if (site.id === "text-to-speech-cn" && !site.fetchTokenUrl) {
        return { ...site, fetchTokenUrl: DEFAULT_ONLINE_SITES[0].fetchTokenUrl, fetchTokenRegex: DEFAULT_ONLINE_SITES[0].fetchTokenRegex, token: "" };
      }
      return site;
    });
  });
  const [onlineSiteId, setOnlineSiteId] = useState(() => localStorage.getItem("onlineSiteId") || "text-to-speech-cn");
  const [siteDraft, setSiteDraft] = useState<OnlineSiteConfig>({
    id: "",
    name: "",
    endpointUrl: "",
    fileField: "file",
    responseTextPath: "text",
    fetchTokenUrl: "",
    fetchTokenRegex: "",
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
  const [checkingHealthId, setCheckingHealthId] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("0.1.0");

  useEffect(() => {
    if (isTauri) {
      getVersion().then((version) => setAppVersion(version)).catch(console.error);
    }
  }, []);

  const selectedSite = useMemo(
    () => onlineSites.find((site) => site.id === onlineSiteId) || onlineSites[0],
    [onlineSiteId, onlineSites],
  );
  const activeTasks = tasks.filter((t) => t.status === "processing").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const historyTasks = useMemo(() => tasks.filter((t) => t.status === "completed" || t.status === "error").slice(0, 10), [tasks]);

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
      fetchTokenUrl: siteDraft.fetchTokenUrl?.trim() || undefined,
      fetchTokenRegex: siteDraft.fetchTokenRegex?.trim() || undefined,
    };
    setOnlineSites((prev) => [...prev, nextSite]);
    setOnlineSiteId(nextSite.id);
    setSiteDraft({ id: "", name: "", endpointUrl: "", fileField: "file", responseTextPath: "text", fetchTokenUrl: "", fetchTokenRegex: "", extraFields: [] });
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

  const handleCheckHealth = async (site: OnlineSiteConfig) => {
    try {
      validateRuntime();
      setCheckingHealthId(site.id);
      const isHealthy = await invoke<boolean>("check_site_health", { site });
      if (isHealthy) {
        setModal({ title: "检测连通性", content: `✅ ${site.name} 连接正常！\n服务器已成功响应。` });
      }
    } catch (err) {
      setModal({ title: "检测连通性", content: `❌ ${site.name} 连接失败！\n原因：${String(err).replace(/^Error:\s*/, "")}` });
    } finally {
      setCheckingHealthId(null);
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
        <Sidebar
          mode={mode}
          setMode={setMode}
          historyTasks={historyTasks}
          openTaskModal={openTaskModal}
          isCheckingUpdate={isCheckingUpdate}
          handleCheckUpdate={handleCheckUpdate}
          appVersion={appVersion}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 lg:px-10">
            <MainHeader
              mode={mode}
              totalTasks={tasks.length}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
            />

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-6">
                <Dropzone
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  onSelectFiles={handleSelectFiles}
                />

                <TaskList
                  tasks={tasks}
                  setTasks={setTasks}
                  retryTask={retryTask}
                  retryFailedTasks={retryFailedTasks}
                  bulkDownload={bulkDownload}
                  completedTasks={completedTasks}
                  renderTaskActions={renderTaskActions}
                />
              </div>

              <aside className="min-w-0 space-y-6">
                {mode === "website" && (
                  <OnlineSettings
                    onlineSites={onlineSites}
                    setOnlineSiteId={setOnlineSiteId}
                    selectedSite={selectedSite}
                    checkingHealthId={checkingHealthId}
                    handleCheckHealth={handleCheckHealth}
                    moveSite={moveSite}
                    removeSite={removeSite}
                    siteDraft={siteDraft}
                    setSiteDraft={setSiteDraft}
                    extraFieldDraft={extraFieldDraft}
                    setExtraFieldDraft={setExtraFieldDraft}
                    addExtraFieldToDraft={addExtraFieldToDraft}
                    addCustomSite={addCustomSite}
                  />
                )}

                {mode === "api" && (
                  <ApiSettings
                    apiConfig={apiConfig}
                    updateApiConfig={updateApiConfig}
                  />
                )}

                {mode === "local" && (
                  <LocalSettings
                    exePath={exePath}
                    handleSelectExe={handleSelectExe}
                    modelPath={modelPath}
                    handleSelectModel={handleSelectModel}
                    isDownloading={isDownloading}
                    downloadProgress={downloadProgress}
                    handleDownloadModel={handleDownloadModel}
                  />
                )}
              </aside>
            </section>
          </div>
        </main>
      </div>

      {modal && (
        <TaskModal
          modal={modal}
          modalTab={modalTab}
          setModalTab={setModalTab}
          onClose={() => setModal(null)}
          onSave={saveTaskResult}
          renderActions={renderTaskActions}
        />
      )}
    </div>
  );
}

export default App;
