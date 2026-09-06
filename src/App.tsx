import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import {
  createChannel,
  Importance,
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { loadAppData, saveAppData, getDataFilePath, openDataFolder, exportAppData, importAppData } from "./storage";
import type { AppData, MonthMeta, Task, TaskStatus } from "./types";
import { dateKey, emptyData, monthKey, uid } from "./types";
import { getDayMark } from "./chinaHolidays";

const WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REMIND_CHANNEL = "xiaohuasheng-reminders";

type MenuState =
  | { kind: "task"; taskId: string; x: number; y: number }
  | null;

type RemindState =
  | { taskId: string; time: string }
  | null;

type ToastItem = { id: string; title: string; body: string };

/** Parse `YYYY-MM-DDTHH:mm[:ss]` as local time (avoid UTC/ISO parse quirks on Windows). */
function parseLocalDateTime(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return Number.NaN;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? "0")
  ).getTime();
}

async function ensureNotifyReady(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (!granted) return false;
    try {
      await createChannel({
        id: REMIND_CHANNEL,
        name: "日程提醒",
        description: "小花生日程安排到点提醒",
        importance: Importance.High,
      });
    } catch {
      /* channel may already exist or be unused on this OS */
    }
    return true;
  } catch {
    return false;
  }
}

async function pingWindowAttention() {
  try {
    const win = getCurrentWindow();
    await win.unminimize();
    await win.setFocus();
    await win.requestUserAttention(UserAttentionType.Critical);
  } catch {
    /* ignore */
  }
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function buildCalendarDays(year: number, month: number) {
  const first = startOfMonth(year, month);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const days: Date[] = [];
  const start = new Date(year, month, 1 - startPad);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function ensureMonth(data: AppData, key: string): MonthMeta {
  return data.months[key] ?? { todos: [], notes: ["", "", ""] };
}

function StatusIcon({ status, faded }: { status: TaskStatus; faded?: boolean }) {
  const label = status === "done" ? "✓" : status === "doing" ? "!" : "×";
  return (
    <span className={`status-icon status-${status}${faded ? " faded" : ""}`} aria-hidden>
      {label}
    </span>
  );
}

export default function App() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    y: today.getFullYear(),
    m: today.getMonth(),
  }));
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [dataPath, setDataPath] = useState("");
  const [menu, setMenu] = useState<MenuState>(null);
  const [remind, setRemind] = useState<RemindState>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const saveTimer = useRef<number | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const mk = monthKey(cursor.y, cursor.m);
  const monthMeta = ensureMonth(data, mk);
  const days = useMemo(() => buildCalendarDays(cursor.y, cursor.m), [cursor]);

  const monthTasks = useMemo(
    () =>
      data.tasks.filter((t) => {
        const [y, m] = t.date.split("-").map(Number);
        return y === cursor.y && m === cursor.m + 1 && !t.struck;
      }),
    [data.tasks, cursor]
  );

  const stats = useMemo(() => {
    const done = monthTasks.filter((t) => t.status === "done").length;
    const doing = monthTasks.filter((t) => t.status === "doing").length;
    const todo = monthTasks.filter((t) => t.status === "todo").length;
    const total = done + doing + todo;
    const pct = (n: number) => (total === 0 ? "0%" : `${((n / total) * 100).toFixed(1)}%`);
    return [
      { key: "done" as const, label: "已完成", count: done, pct: pct(done) },
      { key: "doing" as const, label: "进行中", count: doing, pct: pct(doing) },
      { key: "todo" as const, label: "未开始", count: todo, pct: pct(todo) },
      { key: "total" as const, label: "总计划", count: total, pct: total ? "100%" : "0%" },
    ];
  }, [monthTasks]);

  const persist = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveAppData(next);
    }, 120);
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void saveAppData(dataRef.current);
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await loadAppData();
      dataRef.current = loaded;
      setData(loaded);
      setReady(true);
      try {
        setDataPath(await getDataFilePath());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const onHide = () => flushSave();
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      flushSave();
    };
  }, [flushSave]);

  // Reminder poll — system toast (best-effort) + in-app banner (always, Windows-safe)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let notifyOk: boolean | null = null;

    async function tick() {
      if (cancelled) return;
      if (notifyOk === null) notifyOk = await ensureNotifyReady();

      const now = Date.now();
      const current = dataRef.current;
      let changed = false;
      const due: Task[] = [];
      const tasks = current.tasks.map((t) => {
        if (t.struck || !t.remindAt || t.remindedAt) return t;
        const at = parseLocalDateTime(t.remindAt);
        if (Number.isNaN(at) || at > now) return t;
        changed = true;
        due.push(t);
        return { ...t, remindedAt: new Date().toISOString() };
      });
      if (!changed) return;

      persist({ ...current, tasks });

      const toastItems = due.map((t) => ({
        id: `${t.id}-${Date.now()}`,
        title: t.text || "日程提醒",
        body: (t.remindAt || "").replace("T", " ").slice(0, 16),
      }));
      setToasts((prev) => [...toastItems, ...prev].slice(0, 5));
      void pingWindowAttention();

      if (notifyOk) {
        for (const t of due) {
          try {
            sendNotification({
              title: t.text || "日程提醒",
              body: (t.remindAt || "").replace("T", " ").slice(0, 16),
              channelId: REMIND_CHANNEL,
            });
          } catch {
            /* Windows may silently fail without Start Menu / Focus Assist */
          }
        }
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready, persist]);

  useEffect(() => {
    const close = () => {
      setMenu(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  function updateMonth(patch: Partial<MonthMeta>) {
    const current = dataRef.current;
    const prev = ensureMonth(current, mk);
    persist({
      ...current,
      months: { ...current.months, [mk]: { ...prev, ...patch } },
    });
  }

  function tasksForDate(dk: string) {
    return data.tasks
      .filter((t) => t.date === dk)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function addTask(dk: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const task: Task = {
      id: uid(),
      date: dk,
      text: trimmed,
      status: "todo",
      struck: false,
    };
    const current = dataRef.current;
    persist({ ...current, tasks: [...current.tasks, task] });
    setDrafts((d) => ({ ...d, [dk]: "" }));
  }

  function patchTask(id: string, patch: Partial<Task>) {
    const current = dataRef.current;
    persist({
      ...current,
      tasks: current.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }

  function errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  }

  function openMenu(e: MouseEvent, taskId: string) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ kind: "task", taskId, x: e.clientX, y: e.clientY });
  }

  function applyRemind() {
    if (!remind) return;
    const task = dataRef.current.tasks.find((t) => t.id === remind.taskId);
    if (!task) return;
    const iso = `${task.date}T${remind.time}:00`;
    patchTask(task.id, { remindAt: iso, remindedAt: null });
    setRemind(null);
    setMenu(null);
  }

  if (!ready) {
    return <div className="loading">加载中…</div>;
  }

  const titleMonth = `${String(cursor.m + 1).padStart(2, "0")} ${MONTH_SHORT[cursor.m]} / ${cursor.y}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">小花生日程安排 · {cursor.m + 1}月</div>
        <div className="month-hero">
          <div className="month-big">{String(cursor.m + 1).padStart(2, "0")}</div>
          <div className="month-sub">
            {MONTH_SHORT[cursor.m]} / {cursor.y}
          </div>
        </div>

        <div className="mini-cal">
          <div className="mini-head">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w.slice(2)}</span>
            ))}
          </div>
          <div className="mini-grid">
            {days.slice(0, 42).map((d) => {
              const inMonth = d.getMonth() === cursor.m;
              const isToday =
                d.getFullYear() === today.getFullYear() &&
                d.getMonth() === today.getMonth() &&
                d.getDate() === today.getDate();
              return (
                <span
                  key={dateKey(d)}
                  className={`mini-day${inMonth ? "" : " out"}${isToday ? " today" : ""}`}
                >
                  {d.getDate()}
                </span>
              );
            })}
          </div>
        </div>

        <section className="panel">
          <h3>Stats | 本月计划统计</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>图标</th>
                <th>状态</th>
                <th>数量</th>
                <th>比例</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.key}>
                  <td>
                    {s.key === "total" ? (
                      "—"
                    ) : (
                      <StatusIcon status={s.key} />
                    )}
                  </td>
                  <td>{s.label}</td>
                  <td>{s.count}</td>
                  <td>{s.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>To Do | 本月待办</h3>
          <ul className="todo-list">
            {monthMeta.todos.map((t) => (
              <li key={t.id} className={t.done ? "done" : ""}>
                <input
                  className="todo-text"
                  value={t.text}
                  onChange={(e) =>
                    updateMonth({
                      todos: monthMeta.todos.map((x) =>
                        x.id === t.id ? { ...x, text: e.target.value } : x
                      ),
                    })
                  }
                />
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) =>
                    updateMonth({
                      todos: monthMeta.todos.map((x) =>
                        x.id === t.id ? { ...x, done: e.target.checked } : x
                      ),
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              updateMonth({
                todos: [...monthMeta.todos, { id: uid(), text: "新待办", done: false }],
              })
            }
          >
            + 添加待办
          </button>
        </section>

        <section className="panel">
          <h3>Notes | 本月成果</h3>
          <ol className="notes-list">
            {(monthMeta.notes.length ? monthMeta.notes : ["", "", ""]).map((n, i) => (
              <li key={i}>
                <input
                  value={n}
                  placeholder={`成果 ${i + 1}`}
                  onChange={(e) => {
                    const base = monthMeta.notes.length
                      ? [...monthMeta.notes]
                      : ["", "", ""];
                    while (base.length <= i) base.push("");
                    base[i] = e.target.value;
                    updateMonth({ notes: base });
                  }}
                />
              </li>
            ))}
          </ol>
        </section>

        <div className="io-actions">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              void (async () => {
                try {
                  const path = await exportAppData(data);
                  window.alert(`已导出到：\n${path}`);
                } catch (e) {
                  const msg = errMsg(e);
                  if (!msg.includes("取消")) window.alert(`导出失败：${msg}`);
                }
              })();
            }}
          >
            导出数据
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              void (async () => {
                if (!window.confirm("导入将覆盖当前本地数据，是否继续？")) return;
                try {
                  const imported = await importAppData();
                  persist(imported);
                  window.alert("导入成功");
                } catch (e) {
                  const msg = errMsg(e);
                  if (!msg.includes("取消")) window.alert(`导入失败：${msg}`);
                }
              })();
            }}
          >
            导入数据
          </button>
        </div>

        {dataPath ? (
          <p className="data-path">
            <button
              type="button"
              className="link-btn"
              title={dataPath}
              onClick={() => void openDataFolder()}
            >
              打开数据文件夹
            </button>
            <span className="data-path-text" title={dataPath}>
              ~/Documents/小花生日程安排/
            </span>
          </p>
        ) : null}
      </aside>

      <main className="main">
        <header className="main-header">
          <h1>{titleMonth}</h1>
          <div className="nav-btns">
            <button type="button" onClick={() => setCursor((c) => {
              const d = new Date(c.y, c.m - 1, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}>
              ←
            </button>
            <button
              type="button"
              onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            >
              本月
            </button>
            <button type="button" onClick={() => setCursor((c) => {
              const d = new Date(c.y, c.m + 1, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}>
              →
            </button>
          </div>
        </header>

        <div className="cal-head">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-head-cell">
              {w}
            </div>
          ))}
        </div>

        <div className="cal-grid">
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.m;
            const dk = dateKey(d);
            const tasks = tasksForDate(dk);
            const mark = getDayMark(d);
            const dayClass = [
              "cal-cell",
              inMonth ? "" : "out-month",
              mark.kind === "holiday" ? "day-holiday" : "",
              mark.kind === "rest" ? "day-rest" : "",
              mark.kind === "makeup" ? "day-makeup" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={dk} className={dayClass}>
                <div className="day-head">
                  <span className="day-num">{d.getDate()}</span>
                  {mark.badge ? (
                    <span
                      className={`day-badge badge-${mark.kind}`}
                      title={mark.label}
                    >
                      {mark.badge}
                      {mark.kind === "holiday" ? (
                        <em className="day-holiday-name">{mark.label}</em>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className="task-rows">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`task-row${t.struck ? " struck" : ""}`}
                      onContextMenu={(e) => openMenu(e, t.id)}
                    >
                      <input
                        className="task-text"
                        value={t.text}
                        disabled={t.struck}
                        onChange={(e) => patchTask(t.id, { text: e.target.value })}
                      />
                      {t.remindAt && !t.struck ? (
                        <span className="remind-badge">
                          {t.remindAt.slice(11, 16)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="status-btn"
                        onClick={(e) => openMenu(e, t.id)}
                        title="状态 / 提醒 / 删除"
                      >
                        <StatusIcon status={t.status} faded={t.struck} />
                        <span className="caret">▾</span>
                      </button>
                    </div>
                  ))}
                  {inMonth ? (
                    <div className="task-row draft">
                      <input
                        className="task-text"
                        placeholder="单击添加事项…"
                        value={drafts[dk] ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [dk]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const text = (e.target as HTMLInputElement).value;
                          addTask(dk, text);
                          // 避免 Enter 后 blur 再加一条
                          (e.target as HTMLInputElement).dataset.justAdded = "1";
                        }}
                        onBlur={(e) => {
                          if (e.target.dataset.justAdded === "1") {
                            delete e.target.dataset.justAdded;
                            return;
                          }
                          const text = e.target.value;
                          if (text.trim()) addTask(dk, text);
                        }}
                      />
                      <span className="caret muted">▾</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {menu ? (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(["done", "doing", "todo"] as TaskStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                patchTask(menu.taskId, { status: s, struck: false });
                setMenu(null);
              }}
            >
              <StatusIcon status={s} />{" "}
              {s === "done" ? "已完成" : s === "doing" ? "进行中" : "未开始"}
            </button>
          ))}
          <hr />
          <button
            type="button"
            onClick={() => {
              const t = data.tasks.find((x) => x.id === menu.taskId);
              setRemind({
                taskId: menu.taskId,
                time: t?.remindAt?.slice(11, 16) || "09:00",
              });
              setMenu(null);
            }}
          >
            设置提醒
          </button>
          <button
            type="button"
            onClick={() => {
              patchTask(menu.taskId, { struck: true });
              setMenu(null);
            }}
          >
            删除（划线）
          </button>
          {data.tasks.find((x) => x.id === menu.taskId)?.struck ? (
            <button
              type="button"
              onClick={() => {
                patchTask(menu.taskId, { struck: false });
                setMenu(null);
              }}
            >
              恢复
            </button>
          ) : null}
        </div>
      ) : null}

      {remind ? (
        <div className="modal-backdrop" onClick={() => setRemind(null)}>
          <div className="remind-panel" onClick={(e) => e.stopPropagation()}>
            <h4>设置提醒</h4>
            <p className="hint">日期已锁定为事项所在日。到点时应用需保持运行；Windows 上也会弹出应用内提醒。</p>
            <label>
              时间
              <input
                type="time"
                value={remind.time}
                onChange={(e) => setRemind({ ...remind, time: e.target.value })}
              />
            </label>
            <div className="remind-actions">
              <button type="button" onClick={applyRemind}>
                确定
              </button>
              <button
                type="button"
                onClick={() => {
                  patchTask(remind.taskId, { remindAt: null, remindedAt: null });
                  setRemind(null);
                }}
              >
                清除提醒
              </button>
              <button type="button" className="ghost" onClick={() => setRemind(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toasts.length ? (
        <div className="toast-stack" aria-live="assertive">
          {toasts.map((t) => (
            <div key={t.id} className="toast-card">
              <div className="toast-title">{t.title}</div>
              <div className="toast-body">{t.body}</div>
              <button
                type="button"
                className="toast-close"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                知道了
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
