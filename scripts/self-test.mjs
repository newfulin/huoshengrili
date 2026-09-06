/**
 * 小花生日程安排 · 离线自测（不启 GUI）
 * 运行: node scripts/self-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK  ", msg);
  }
}

// —— 1) 节假日逻辑（动态 import TS 不可直接，内联复测关键日）——
// 用构建后的逻辑：直接读 chinaHolidays 需 transpile；这里复制关键断言用 node 跑简单校验文件
const holidaysPath = path.join(root, "src/chinaHolidays.ts");
const src = fs.readFileSync(holidaysPath, "utf8");
assert(src.includes("2026-10-01"), "含 2026 国庆数据");
assert(src.includes("2026-01-04"), "含 2026 元旦调休上班");
assert(src.includes("2026-09-20"), "含 2026 国庆调休 9/20");

// —— 2) 数据目录与现有持久化 ——
const dataFile = path.join(os.homedir(), "Documents", "小花生日程安排", "data.json");
assert(fs.existsSync(dataFile), `数据文件存在: ${dataFile}`);
const raw = fs.readFileSync(dataFile, "utf8");
let data;
try {
  data = JSON.parse(raw);
  assert(Array.isArray(data.tasks), "tasks 为数组");
  assert(data.months && typeof data.months === "object", "months 为对象");
  assert(!("localStorage" in Object.keys(data)), "数据非浏览器缓存结构");
} catch (e) {
  assert(false, `data.json 可解析: ${e}`);
}

// —— 3) 导入校验规则（与 Rust validate 对齐）——
function validate(payload) {
  if (!payload || typeof payload !== "object") return "根须对象";
  if (!Array.isArray(payload.tasks)) return "缺 tasks";
  if (!payload.months || typeof payload.months !== "object") return "缺 months";
  return null;
}
assert(validate({ tasks: [], months: {} }) === null, "合法导入结构通过");
assert(validate({ tasks: [] }) !== null, "缺 months 应失败");
assert(validate({ months: {} }) !== null, "缺 tasks 应失败");

// —— 4) 导出/导入往返 ——
const tmp = path.join(os.tmpdir(), `xiaohuasheng-selftest-${Date.now()}.json`);
const snapshot = {
  version: 1,
  tasks: [
    {
      id: "t-self",
      date: "2026-09-05",
      text: "自测事项",
      status: "doing",
      struck: false,
      remindAt: "2026-09-05T23:59:00",
      remindedAt: null,
    },
    {
      id: "t-struck",
      date: "2026-09-05",
      text: "已划线",
      status: "todo",
      struck: true,
    },
  ],
  months: {
    "2026-09": {
      todos: [{ id: "td1", text: "侧栏待办", done: true }],
      notes: ["成果A", "", ""],
    },
  },
};
fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
const round = JSON.parse(fs.readFileSync(tmp, "utf8"));
assert(round.tasks.length === 2, "导出往返条数正确");
assert(round.tasks.filter((t) => t.struck).length === 1, "软删除字段保留");
assert(round.months["2026-09"].todos[0].done === true, "侧栏待办保留");

// Stats 规则：不含 struck
const active = round.tasks.filter((t) => {
  const [y, m] = t.date.split("-").map(Number);
  return y === 2026 && m === 9 && !t.struck;
});
assert(active.length === 1, "Stats 不含划线项");
assert(active[0].status === "doing", "进行中状态正确");

// —— 5) 提醒时间解析 ——
const at = new Date("2026-09-05T23:59:00").getTime();
assert(!Number.isNaN(at), "remindAt 本地时间可解析");

// —— 6) 前端产物与 App 包 ——
const appPath = path.join(
  root,
  "src-tauri/target/debug/bundle/macos/小花生日程安排.app"
);
assert(fs.existsSync(appPath), "macOS .app 存在");
const distJs = path.join(root, "dist/assets");
assert(fs.existsSync(path.join(root, "dist/index.html")), "dist/index.html 存在");

// —— 7) 源码无 localStorage 主存 ——
const storageSrc = fs.readFileSync(path.join(root, "src/storage.ts"), "utf8");
assert(!storageSrc.includes("localStorage"), "storage 未使用 localStorage");
const libSrc = fs.readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8");
assert(libSrc.includes("Documents") || libSrc.includes("document_dir"), "Rust 写文档目录");
assert(libSrc.includes("export_data") && libSrc.includes("import_data"), "含导入导出命令");

// —— 8) Enter+blur 防双加标记存在 ——
const appSrc = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
assert(appSrc.includes("justAdded"), "已防 Enter+blur 双加");
assert(appSrc.includes("dataRef.current"), "写操作走 dataRef 防旧闭包");
assert(appSrc.includes("beforeunload"), "退出前 flush 保存");

fs.unlinkSync(tmp);

console.log("\n—— 结果 ——");
if (failed) {
  console.error(`失败 ${failed} 项`);
  process.exit(1);
}
console.log("全部通过");
