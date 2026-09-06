use serde_json::Value;
use std::fs;
use std::path::PathBuf;

const APP_FOLDER: &str = "小花生日程安排";
const DATA_FILE: &str = "data.json";

fn documents_dir() -> Result<PathBuf, String> {
    dirs::document_dir().ok_or_else(|| "无法解析「文稿/Documents」目录".to_string())
}

fn data_dir() -> Result<PathBuf, String> {
    let dir = documents_dir()?.join(APP_FOLDER);
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    Ok(dir)
}

fn data_path() -> Result<PathBuf, String> {
    Ok(data_dir()?.join(DATA_FILE))
}

fn legacy_data_path() -> Option<PathBuf> {
    dirs::data_dir().map(|b| b.join("com.aicompany.calendar-planner").join(DATA_FILE))
}

fn migrate_legacy_if_needed(dest: &PathBuf) -> Result<(), String> {
    if dest.exists() {
        return Ok(());
    }
    if let Some(legacy) = legacy_data_path() {
        if legacy.exists() {
            fs::copy(&legacy, dest).map_err(|e| format!("迁移旧数据失败: {e}"))?;
        }
    }
    Ok(())
}

fn validate_payload(payload: &Value) -> Result<(), String> {
    let obj = payload
        .as_object()
        .ok_or_else(|| "导入文件格式错误：根节点须为 JSON 对象".to_string())?;
    if !obj.get("tasks").map(|t| t.is_array()).unwrap_or(false) {
        return Err("导入文件缺少 tasks 数组".into());
    }
    if !obj.get("months").map(|t| t.is_object()).unwrap_or(false) {
        return Err("导入文件缺少 months 对象".into());
    }
    Ok(())
}

fn write_data_file(path: &PathBuf, payload: &Value) -> Result<(), String> {
    let pretty = serde_json::to_string_pretty(payload).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, pretty).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_data() -> Result<Value, String> {
    let path = data_path()?;
    migrate_legacy_if_needed(&path)?;
    if !path.exists() {
        return Ok(serde_json::json!({
            "version": 1,
            "tasks": [],
            "months": {}
        }));
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(payload: Value) -> Result<(), String> {
    let path = data_path()?;
    write_data_file(&path, &payload)
}

#[tauri::command]
fn data_file_path() -> Result<String, String> {
    let path = data_path()?;
    migrate_legacy_if_needed(&path)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let dir = data_dir()?;
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 弹出另存为对话框，导出当前数据（由前端传入最新 payload）
#[tauri::command]
fn export_data(payload: Value) -> Result<String, String> {
    validate_payload(&payload)?;
    let path = rfd::FileDialog::new()
        .set_title("导出小花生数据")
        .set_file_name("小花生日程安排-备份.json")
        .add_filter("JSON", &["json"])
        .save_file()
        .ok_or_else(|| "已取消导出".to_string())?;
    write_data_file(&path, &payload)?;
    Ok(path.to_string_lossy().to_string())
}

/// 弹出打开对话框，读取备份并写回本地数据目录，返回导入后的数据
#[tauri::command]
fn import_data() -> Result<Value, String> {
    let path = rfd::FileDialog::new()
        .set_title("导入小花生数据")
        .add_filter("JSON", &["json"])
        .pick_file()
        .ok_or_else(|| "已取消导入".to_string())?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))?;
    let mut payload: Value =
        serde_json::from_str(&raw).map_err(|e| format!("JSON 解析失败: {e}"))?;
    validate_payload(&payload)?;
    if payload.get("version").is_none() {
        payload
            .as_object_mut()
            .unwrap()
            .insert("version".into(), serde_json::json!(1));
    }
    let dest = data_path()?;
    write_data_file(&dest, &payload)?;
    Ok(payload)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            data_file_path,
            open_data_folder,
            export_data,
            import_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
