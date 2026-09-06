/** 中国大陆法定节假日 / 调休（国务院办公厅安排）。周末默认「休」，调休上班为「班」。 */

export type DayKind = "work" | "rest" | "holiday" | "makeup";

export interface DayMark {
  kind: DayKind;
  /** 短标：休 / 假 / 班 */
  badge: string;
  /** 悬停说明 */
  label: string;
}

type Override = { kind: "holiday" | "makeup"; label: string };

function range(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const last = new Date(ye, me - 1, de);
  while (cur <= last) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function put(
  map: Record<string, Override>,
  dates: string[],
  kind: Override["kind"],
  label: string
) {
  for (const d of dates) map[d] = { kind, label };
}

/** 国务院已公布年份的放假/调休覆盖表 */
const OVERRIDES: Record<string, Override> = {};

// —— 2025（国办发明电〔2024〕12号）——
put(OVERRIDES, range("2025-01-01", "2025-01-01"), "holiday", "元旦");
put(OVERRIDES, ["2025-01-26"], "makeup", "春节调休上班");
put(OVERRIDES, range("2025-01-28", "2025-02-04"), "holiday", "春节");
put(OVERRIDES, ["2025-02-08"], "makeup", "春节调休上班");
put(OVERRIDES, range("2025-04-04", "2025-04-06"), "holiday", "清明节");
put(OVERRIDES, ["2025-04-27"], "makeup", "劳动节调休上班");
put(OVERRIDES, range("2025-05-01", "2025-05-05"), "holiday", "劳动节");
put(OVERRIDES, range("2025-05-31", "2025-06-02"), "holiday", "端午节");
put(OVERRIDES, ["2025-09-28"], "makeup", "国庆中秋调休上班");
put(OVERRIDES, range("2025-10-01", "2025-10-08"), "holiday", "国庆节·中秋节");
put(OVERRIDES, ["2025-10-11"], "makeup", "国庆中秋调休上班");

// —— 2026（国办发明电〔2025〕7号，事实来源：中国政府网）——
put(OVERRIDES, range("2026-01-01", "2026-01-03"), "holiday", "元旦");
put(OVERRIDES, ["2026-01-04"], "makeup", "元旦调休上班");
put(OVERRIDES, ["2026-02-14"], "makeup", "春节调休上班");
put(OVERRIDES, range("2026-02-15", "2026-02-23"), "holiday", "春节");
put(OVERRIDES, ["2026-02-28"], "makeup", "春节调休上班");
put(OVERRIDES, range("2026-04-04", "2026-04-06"), "holiday", "清明节");
put(OVERRIDES, range("2026-05-01", "2026-05-05"), "holiday", "劳动节");
put(OVERRIDES, ["2026-05-09"], "makeup", "劳动节调休上班");
put(OVERRIDES, range("2026-06-19", "2026-06-21"), "holiday", "端午节");
put(OVERRIDES, range("2026-09-25", "2026-09-27"), "holiday", "中秋节");
put(OVERRIDES, ["2026-09-20"], "makeup", "国庆调休上班");
put(OVERRIDES, range("2026-10-01", "2026-10-07"), "holiday", "国庆节");
put(OVERRIDES, ["2026-10-10"], "makeup", "国庆调休上班");

export function getDayMark(date: Date | string): DayMark {
  const key =
    typeof date === "string"
      ? date
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const isWeekend = dow === 0 || dow === 6;
  const ov = OVERRIDES[key];

  if (ov?.kind === "holiday") {
    return { kind: "holiday", badge: "假", label: ov.label };
  }
  if (ov?.kind === "makeup") {
    return { kind: "makeup", badge: "班", label: ov.label };
  }
  if (isWeekend) {
    return {
      kind: "rest",
      badge: "休",
      label: dow === 6 ? "周六休息" : "周日休息",
    };
  }
  return { kind: "work", badge: "", label: "工作日" };
}
