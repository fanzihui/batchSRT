import { Clock, Download, RefreshCw, Trash2 } from "lucide-react";
import { Task } from "../types";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  retryTask: (task: Task) => void;
  retryFailedTasks: () => void;
  bulkDownload: () => void;
  completedTasks: number;
  renderTaskActions: (task: Task) => React.ReactNode;
}

export function TaskList({
  tasks,
  setTasks,
  retryTask,
  retryFailedTasks,
  bulkDownload,
  completedTasks,
  renderTaskActions,
}: TaskListProps) {
  return (
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
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onRetry={retryTask}
              onRemove={(id) => setTasks((prev) => prev.filter((item) => item.id !== id))}
              renderActions={renderTaskActions}
            />
          ))}
        </div>
      )}
    </section>
  );
}
