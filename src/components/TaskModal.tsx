import { X } from "lucide-react";
import { ModalState, ResultFormat, Task } from "../types";
import { parseSrt, splitParagraphs } from "../utils";

interface TaskModalProps {
  modal: ModalState;
  modalTab: ResultFormat;
  setModalTab: (tab: ResultFormat) => void;
  onClose: () => void;
  onSave: (task: Task, format: ResultFormat) => Promise<void>;
  renderActions: (task: Task) => React.ReactNode;
}

export function TaskModal({ modal, modalTab, setModalTab, onClose, onSave, renderActions }: TaskModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/42 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">BatchSRT</h3>
            {modal.title && modal.title !== "BatchSRT" && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{modal.title.replace(/^BatchSRT\s*-\s*/, "")}</p>
            )}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="关闭弹窗"><X size={17} /></button>
        </div>

        {modal.task ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button onClick={() => setModalTab("txt")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${modalTab === "txt" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>分段 TXT</button>
                <button onClick={() => setModalTab("srt")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${modalTab === "srt" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>SRT 字幕</button>
              </div>
              {renderActions(modal.task)}
            </div>
            <div className="max-h-[60vh] overflow-auto bg-slate-50 px-5 py-4">{renderResultBody(modal.task, modalTab)}</div>
          </>
        ) : (
          <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700">{modal.content || "无内容"}</pre>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">关闭</button>
          {(modal.onAction || modal.task) && (
            <button
              onClick={async () => {
                if (modal.task) {
                  await onSave(modal.task, modalTab);
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
  );
}
