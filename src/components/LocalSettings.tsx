import { HardDrive, FolderOpen, LoaderCircle, Download } from "lucide-react";
import { DownloadProgress } from "../types";

interface LocalSettingsProps {
  exePath: string;
  handleSelectExe: () => void;
  modelPath: string;
  handleSelectModel: () => void;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  handleDownloadModel: () => void;
}

export function LocalSettings({
  exePath,
  handleSelectExe,
  modelPath,
  handleSelectModel,
  isDownloading,
  downloadProgress,
  handleDownloadModel,
}: LocalSettingsProps) {
  return (
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
  );
}
