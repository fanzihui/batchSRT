export type Mode = "website" | "local" | "api";
export type ResultFormat = "txt" | "srt";
export type TaskStatus = "pending" | "processing" | "completed" | "error";

export interface KeyValueField {
  key: string;
  value: string;
}

export interface OnlineSiteConfig {
  id: string;
  name: string;
  endpointUrl: string;
  fileField: string;
  responseTextPath: string;
  tokenField?: string;
  token?: string;
  fetchTokenUrl?: string;
  fetchTokenRegex?: string;
  extraFields: KeyValueField[];
}

export interface ApiConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  temperature: string;
  timeoutSeconds: string;
}

export interface TranscriptionResult {
  srt: string;
  txt: string;
}

export interface Task {
  id: string;
  filename: string;
  filePath: string;
  mode: Mode;
  status: TaskStatus;
  progress: number;
  result?: TranscriptionResult;
  errorMsg?: string;
  displayFormat: ResultFormat;
}

export interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number | null;
}

export interface AudioSource {
  mime: string;
  data: string;
}

export interface ModalState {
  title: string;
  content?: string;
  task?: Task;
  initialTab?: ResultFormat;
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
}

export interface SrtBlock {
  index: string;
  time: string;
  text: string;
}
