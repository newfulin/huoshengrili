# Windows 安装包（.exe / NSIS）

**事实**：当前开发机是 macOS，无法在本机直接产出可运行的 Windows `.exe`。  
需在 **Windows 电脑** 或 **GitHub Actions（windows-latest）** 上打包。

## 方式 A：Windows 一键脚本（推荐）

解压 `calendar-planner-windows-buildkit.zip` 后，双击：

`calendar-planner\scripts\build-windows.bat`

脚本会：

1. 检测 Node.js / Rust；**没有则自动安装**（优先 winget，否则下载官方安装包）  
2. `npm install`  
3. `tauri build --bundles nsis` → 生成 `*-setup.exe`  

若提示「请关闭窗口再双击一次」：刚装完工具 PATH 未刷新，重跑即可。  
Win10/11 一般已有 WebView2；若打包失败再装 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)。

产物目录：`src-tauri\target\release\bundle\nsis\`

## 方式 B：GitHub Actions

`.github/workflows/xiaohuasheng-windows.yml`  
推送相关改动或手动 `workflow_dispatch` 后，在 Actions 下载 Windows 安装包。

## 数据迁移

侧栏「导出 / 导入」；Windows 数据目录：`文档\小花生日程安排\data.json`
