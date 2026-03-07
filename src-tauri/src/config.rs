use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct TabConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_tab_type")]
    pub tab_type: String,
    #[serde(default)]
    pub manually_renamed: bool,
}

fn default_tab_type() -> String {
    "claude".to_string()
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct GroupConfig {
    pub id: String,
    pub name: String,
    pub tabs: Vec<TabConfig>,
    pub active_tab_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WindowConfig {
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub maximized: bool,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            width: 1200.0,
            height: 800.0,
            x: 100.0,
            y: 100.0,
            maximized: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SettingsConfig {
    #[serde(default = "default_streak_timer")]
    pub streak_timer: u64,
    #[serde(default = "default_cooldown_timer")]
    pub cooldown_timer: u64,
}

fn default_streak_timer() -> u64 {
    10000
}
fn default_cooldown_timer() -> u64 {
    30000
}

impl Default for SettingsConfig {
    fn default() -> Self {
        Self {
            streak_timer: 10000,
            cooldown_timer: 30000,
        }
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct ForgeConfig {
    #[serde(default)]
    pub groups: Vec<GroupConfig>,
    #[serde(default)]
    pub active_group_id: String,
    #[serde(default)]
    pub window: WindowConfig,
    #[serde(default)]
    pub settings: SettingsConfig,
}

fn config_path() -> PathBuf {
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".forge").join("config.json")
}

#[tauri::command]
pub fn load_config() -> Result<ForgeConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(ForgeConfig::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: ForgeConfig = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn save_config(config: ForgeConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}
