import { FileAudio, RefreshCw, X } from "lucide-react";
import { Task } from "../types";
import { statusMeta } from "../utils";

interface TaskItemProps {
  task: Task;
  onRetry: (task: Task) => void;
  onRemove: (taskId: string) => void;
  renderActions: (task: Task) => React.ReactNode;
}

export function TaskItem({ task, onRetry, onRemove, renderActions }: TaskItemProps) {
  const meta = statusMeta(task.status);
  const StatusIcon = meta.icon;

  return (
    <article id={`task-${task.id}`} className="p-5 transition hover:bg-slate-50">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <FileAudio size={21} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900" title={task.filename}>
              {task.filename}
            </h4>
            <p className="mt-1 truncate text-xs text-slate-400" title={task.filePath}>
              {task.filePath}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${meta.className}`}>
            <StatusIcon size={14} className={task.status === "processing" ? "animate-spin" : ""} />
            {meta.label}
          </span>
          {task.status === "error" && (
            <button onClick={() => onRetry(task)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700" title="重试">
              <RefreshCw size={16} />
            </button>
          )}
          <button onClick={() => onRemove(task.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="移除任务">
            <X size={16} />
          </button>
        </div>
      </div>

      {(task.status === "processing" || task.status === "pending") && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500">
            <span>处理进度</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4">{renderActions(task)}</div>

      {task.status === "error" && task.errorMsg && (
        <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {task.errorMsg}
        </div>
      )}
    </article>
  );
}
