# 音频转文本工具 (Audio-to-Text Tool) Spec

## Why
用户需要一个多功能的音频文件转文本工具，既能满足本地隐私安全和离线使用的需求（使用 ffmpeg 和 whisper 本地模型），又能利用在线网站接口或云端大模型 API 进行高效的批量转换。

## What Changes
- 初始化 Tauri 2 桌面应用框架。
- 搭建 React 19 + Vite + TypeScript + Tailwind CSS 的现代前端界面。
- 构建基于 Rust + Tokio + Axum 的高性能后端，处理本地任务与并发网络请求。
- 集成 Reqwest 用于模拟在线网站请求及调用在线大模型 API。
- 集成文件系统操作与子进程管理，用于下载及运行 ffmpeg 和 whisper 等本地模型。

## Impact
- Affected specs: 核心音频处理能力、网络请求管理、本地进程调度。
- Affected code: 全新项目结构，无历史代码影响。

## ADDED Requirements
### Requirement: 本地模型转换
系统 SHALL 支持下载 ffmpeg 和 whisper 模型，并在本地调用子进程进行音频到文本的转换。
#### Scenario: 成功进行本地转换
- **WHEN** 用户选择本地模型并上传音频文件
- **THEN** 系统启动本地进程进行推理，并输出转换后的文本。

### Requirement: 模拟在线网站批量转换
系统 SHALL 支持通过构造 HTTP 请求模拟访问在线网站进行批量的音频转换任务。
#### Scenario: 成功进行在线网站模拟转换
- **WHEN** 用户选择在线网站模式并批量提交音频文件
- **THEN** 系统并发发送模拟请求，并在前端展示各个文件的转换进度和结果。

### Requirement: 在线大模型 API 转换
系统 SHALL 支持配置 API Key 调用如 OpenAI Whisper 等在线大模型服务进行转换。
#### Scenario: 成功调用 API 转换
- **WHEN** 用户配置 API Key 并选择在线大模型模式
- **THEN** 系统通过 API 发送音频并接收、展示文本结果。