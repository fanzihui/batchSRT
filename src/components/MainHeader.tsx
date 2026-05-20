import { BatchSrtIcon } from "./BatchSrtIcon";
import { Mode } from "../types";
import { MODE_CONFIG } from "../constants";

interface MainHeaderProps {
  mode: Mode;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
}

export function MainHeader({ mode, totalTasks, activeTasks, completedTasks }: MainHeaderProps) {
  const activeMode = MODE_CONFIG[mode];
  const ActiveModeIcon = activeMode.icon;

  return (
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
        <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-slate-950">{totalTasks}</div><div className="text-[11px] text-slate-500">全部</div></div>
        <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-blue-700">{activeTasks}</div><div className="text-[11px] text-slate-500">进行中</div></div>
        <div className="rounded-md bg-white px-4 py-3 shadow-sm"><div className="text-lg font-semibold text-emerald-700">{completedTasks}</div><div className="text-[11px] text-slate-500">完成</div></div>
      </div>
    </header>
  );
}
