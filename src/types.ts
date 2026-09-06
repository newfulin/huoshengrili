export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  status: TaskStatus;
  struck: boolean;
  remindAt?: string | null; // ISO local-ish
  remindedAt?: string | null;
}

export interface MonthTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface MonthMeta {
  todos: MonthTodo[];
  notes: string[];
}

export interface AppData {
  version: 1;
  tasks: Task[];
  months: Record<string, MonthMeta>; // key YYYY-MM
}

export function emptyData(): AppData {
  return { version: 1, tasks: [], months: {} };
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
