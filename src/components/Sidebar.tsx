import { LoaderCircle, RefreshCw, History } from "lucide-react";
import { BatchSrtIcon } from "./BatchSrtIcon";
import { Mode, Task, ResultFormat } from "../types";
import { statusMeta } from "../utils";
import { MODE_CONFIG } from "../constants";

interface SidebarProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  historyTasks: Task[];
  openTaskModal: (task: Task, initialTab: ResultFormat) => void;
  isCheckingUpdate: boolean;
  handleCheckUpdate: () => void;
}

export function Sidebar({
  mode,
  setMode,
  historyTasks,
  openTaskModal,
  isCheckingUpdate,
  handleCheckUpdate,
}: SidebarProps) {
  const activeMode = MODE_CONFIG[mode];
  const ActiveModeIcon = activeMode.icon;

  return (
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
            {(Object.keys(MODE_CONFIG) as Mode[]).map((itemMode) => {
              const item = MODE_CONFIG[itemMode];
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
  );
}
