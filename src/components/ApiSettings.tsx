import { Settings } from "lucide-react";
import { ApiConfig } from "../types";
import { inputClass, textAreaClass } from "../constants";

interface ApiSettingsProps {
  apiConfig: ApiConfig;
  updateApiConfig: (patch: Partial<ApiConfig>) => void;
}

export function ApiSettings({ apiConfig, updateApiConfig }: ApiSettingsProps) {
  return (
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
  );
}
