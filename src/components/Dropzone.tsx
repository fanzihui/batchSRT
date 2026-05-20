import { UploadCloud, FolderOpen } from "lucide-react";

interface DropzoneProps {
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  onSelectFiles: () => void;
}

export function Dropzone({ isDragging, setIsDragging, onSelectFiles }: DropzoneProps) {
  return (
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
      onClick={onSelectFiles}
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
  );
}
