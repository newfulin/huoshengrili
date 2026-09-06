import { invoke } from "@tauri-apps/api/core";
import type { AppData } from "./types";
import { emptyData } from "./types";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 非 Tauri 时的内存回退（仅开发预览）；正式运行走磁盘文件夹 */
let memoryFallback: AppData | null = null;

export async function loadAppData(): Promise<AppData> {
  if (!isTauri()) {
    if (!memoryFallback) memoryFallback = emptyData();
    return structuredClone(memoryFallback);
  }
  const data = await invoke<AppData>("load_data");
  if (!data || !Array.isArray(data.tasks)) return emptyData();
  return {
    version: 1,
    tasks: data.tasks ?? [],
    months: data.months ?? {},
  };
}

export async function saveAppData(data: AppData): Promise<void> {
  if (!isTauri()) {
    memoryFallback = structuredClone(data);
    return;
  }
  await invoke("save_data", { payload: data });
}

export async function getDataFilePath(): Promise<string> {
  if (!isTauri()) return "(开发预览：内存；正式版在「文稿/小花生日程安排」)";
  return invoke<string>("data_file_path");
}

export async function openDataFolder(): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_data_folder");
}

export async function exportAppData(data: AppData): Promise<string> {
  if (!isTauri()) throw new Error("请在桌面应用中导出");
  return invoke<string>("export_data", { payload: data });
}

export async function importAppData(): Promise<AppData> {
  if (!isTauri()) throw new Error("请在桌面应用中导入");
  const data = await invoke<AppData>("import_data");
  return {
    version: 1,
    tasks: data.tasks ?? [],
    months: data.months ?? {},
  };
}
