# 小花生日程安排

本地桌面月历。Tauri 2 + React。

## 数据

- 目录：`~/Documents/小花生日程安排/data.json`（Windows：`文档\小花生日程安排\data.json`）
- 侧栏：**导出数据 / 导入数据 / 打开数据文件夹**（迁移用 JSON 备份）

## macOS 运行

```bash
export RUSTUP_HOME="$(pwd)/.rustup"
export CARGO_HOME="$(pwd)/.cargo"
export CARGO_TARGET_DIR="$(pwd)/src-tauri/target"
source "$CARGO_HOME/env"
./tauri.sh build --debug
open "src-tauri/target/debug/bundle/macos/小花生日程安排.app"
```

## Windows 安装包（.exe）

本机是 Mac，**不能直接编出 Windows exe**。见 [docs/WINDOWS_BUILD.md](docs/WINDOWS_BUILD.md)：

- Windows 上 `npm run tauri build` → NSIS setup.exe  
- 或用 GitHub Actions：`.github/workflows/xiaohuasheng-windows.yml`

## 日格标记

休 / 假 / 班（含 2025–2026 国务院放假安排）
