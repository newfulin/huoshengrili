# 在 Mac 上如何得到 Windows 安装包

## 结论（事实）

| 方式 | 能否在本机 Mac 直接出 exe |
|------|---------------------------|
| 本机 `tauri build` | **不能**（缺 Windows 链接器 / WebView2） |
| GitHub Actions 云打包 | **能**（推荐） |
| Mac 上装 Windows 虚拟机再打包 | **能**（Parallels / VMware） |
| 另一台 Windows 跑 build-windows.bat | **能** |

---

## 方案 A：GitHub Actions（推荐，不用 Windows 电脑）

1. 把本仓库推到 GitHub（需要 GitHub 账号）  
2. 打开仓库 → **Actions** → **Build Xiaohuasheng Windows Setup** → **Run workflow**  
3. 跑完后点进该次运行 → **Artifacts** → 下载 `xiaohuasheng-windows-setup`  
4. 解压得到 `*-setup.exe`，拷到 Windows 上安装即可  

工作流文件：`.github/workflows/xiaohuasheng-windows.yml`

首次若仓库还没有 git：

```bash
cd /Users/fulin/API/only
git init
git add 06-ai-agent-workflow/calendar-planner .github/workflows/xiaohuasheng-windows.yml
git commit -m "Add Xiaohuasheng calendar and Windows CI"
# 在 GitHub 新建空仓库后：
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

之后改代码再 `git push`，或手动点 Run workflow，都会重新出 exe。

---

## 方案 B：Windows 电脑 / 虚拟机

解压 `calendar-planner-windows-buildkit.zip` 到 `D:\xiaohuasheng\`，双击：

`scripts\build-windows.bat`

（缺 MSVC 时先跑 `scripts\install-msvc.bat`）

---

## 数据

安装包更新一般不丢数据：`文档\小花生日程安排\data.json`  
更新前建议 App 内导出一次备份。
