import { Cloud, LoaderCircle, Activity, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { OnlineSiteConfig, KeyValueField } from "../types";
import { inputClass } from "../constants";

interface OnlineSettingsProps {
  onlineSites: OnlineSiteConfig[];
  setOnlineSiteId: (id: string) => void;
  selectedSite?: OnlineSiteConfig;
  checkingHealthId: string | null;
  handleCheckHealth: (site: OnlineSiteConfig) => void;
  moveSite: (id: string, dir: -1 | 1) => void;
  removeSite: (id: string) => void;
  siteDraft: OnlineSiteConfig;
  setSiteDraft: React.Dispatch<React.SetStateAction<OnlineSiteConfig>>;
  extraFieldDraft: KeyValueField;
  setExtraFieldDraft: React.Dispatch<React.SetStateAction<KeyValueField>>;
  addExtraFieldToDraft: () => void;
  addCustomSite: () => void;
}

export function OnlineSettings({
  onlineSites,
  setOnlineSiteId,
  selectedSite,
  checkingHealthId,
  handleCheckHealth,
  moveSite,
  removeSite,
  siteDraft,
  setSiteDraft,
  extraFieldDraft,
  setExtraFieldDraft,
  addExtraFieldToDraft,
  addCustomSite,
}: OnlineSettingsProps) {
  return (
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
              <button onClick={() => handleCheckHealth(site)} disabled={checkingHealthId === site.id} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50" title="检测连通性">
                {checkingHealthId === site.id ? <LoaderCircle size={13} className="animate-spin" /> : <Activity size={13} />}
                检测
              </button>
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
            <input value={siteDraft.token || ""} onChange={(event) => setSiteDraft((prev) => ({ ...prev, token: event.target.value }))} placeholder="Token 值（静态），可空" className={inputClass} />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={siteDraft.fetchTokenUrl || ""} onChange={(event) => setSiteDraft((prev) => ({ ...prev, fetchTokenUrl: event.target.value }))} placeholder="动态Token提取地址，可空" className={inputClass} />
            <input value={siteDraft.fetchTokenRegex || ""} onChange={(event) => setSiteDraft((prev) => ({ ...prev, fetchTokenRegex: event.target.value }))} placeholder="Token提取正则，如 token='(.*?)'" className={inputClass} />
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
  );
}
