use crate::{app_settings, session_store};
use std::{path::Path, process::Command};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Listener, Manager, Wry,
};

const SESSION_CHANGED_EVENT: &str = "claude-sprout://sessions-changed";
const SETTINGS_CHANGED_EVENT: &str = "claude-sprout://settings-changed";
const OPEN_SETTINGS_EVENT: &str = "claude-sprout://open-settings";

#[derive(Clone)]
struct TrayMenuItems {
    show_panel: MenuItem<Wry>,
    show_pet: MenuItem<Wry>,
    dnd: MenuItem<Wry>,
    refresh: MenuItem<Wry>,
    open_data: MenuItem<Wry>,
    settings: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

#[derive(Clone, Copy)]
enum TrayLanguage {
    En,
    ZhCn,
}

struct TrayLabels {
    show_panel: &'static str,
    show_pet: &'static str,
    dnd: &'static str,
    refresh: &'static str,
    open_data: &'static str,
    settings: &'static str,
    quit: &'static str,
}

impl TrayMenuItems {
    fn apply_language(&self, language: TrayLanguage) {
        let labels = tray_labels(language);
        let _ = self.show_panel.set_text(labels.show_panel);
        let _ = self.show_pet.set_text(labels.show_pet);
        let _ = self.dnd.set_text(labels.dnd);
        let _ = self.refresh.set_text(labels.refresh);
        let _ = self.open_data.set_text(labels.open_data);
        let _ = self.settings.set_text(labels.settings);
        let _ = self.quit.set_text(labels.quit);
    }
}

pub fn create_tray(app: &mut App) -> tauri::Result<()> {
    let labels = tray_labels(current_tray_language());
    let show_panel = MenuItem::with_id(app, "open_panel", labels.show_panel, true, None::<&str>)?;
    let show_pet = MenuItem::with_id(app, "toggle_pet", labels.show_pet, true, None::<&str>)?;
    let dnd = MenuItem::with_id(app, "dnd", labels.dnd, true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", labels.refresh, true, None::<&str>)?;
    let open_data = MenuItem::with_id(app, "open_data", labels.open_data, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", labels.settings, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show_pet, &show_panel, &dnd, &refresh, &open_data, &settings, &quit],
    )?;
    let menu_items = TrayMenuItems {
        show_panel,
        show_pet,
        dnd,
        refresh,
        open_data,
        settings,
        quit,
    };
    let language_menu_items = menu_items.clone();

    app.listen(SETTINGS_CHANGED_EVENT, move |event| {
        if let Ok(settings) = serde_json::from_str::<app_settings::AppSettings>(event.payload()) {
            language_menu_items.apply_language(language_for_settings(&settings));
        }
    });

    let mut tray = TrayIconBuilder::with_id("claude-sprout-tray")
        .tooltip("Claude Sprout")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "open_panel" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit(OPEN_SETTINGS_EVENT, ());
            }
            "dnd" => {
                if let Ok(mut settings) = app_settings::load() {
                    settings.do_not_disturb = !settings.do_not_disturb;
                    if let Ok(saved_settings) = app_settings::save(&settings) {
                        let _ = app.emit(SETTINGS_CHANGED_EVENT, saved_settings);
                    }
                }
            }
            "refresh" => {
                let _ = session_store::ensure_layout();
                let _ = app.emit(SESSION_CHANGED_EVENT, ());
            }
            "open_data" => {
                if let Ok(path) = session_store::ensure_layout() {
                    let _ = open_path(&path);
                }
            }
            "toggle_pet" => {
                if let Some(window) = app.get_webview_window("pet") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(app) = tray.app_handle().get_webview_window("main") {
                    let _ = app.unminimize();
                    let _ = app.show();
                    let _ = app.set_focus();
                }
            }
        });

    tray = tray.icon(tray_icon_image()?);

    tray.build(app)?;

    Ok(())
}

fn current_tray_language() -> TrayLanguage {
    app_settings::load()
        .map(|settings| language_for_settings(&settings))
        .unwrap_or_else(|_| system_tray_language())
}

fn language_for_settings(settings: &app_settings::AppSettings) -> TrayLanguage {
    match settings.language {
        app_settings::AppLanguage::ZhCn => TrayLanguage::ZhCn,
        app_settings::AppLanguage::En => TrayLanguage::En,
        app_settings::AppLanguage::System => system_tray_language(),
    }
}

fn system_tray_language() -> TrayLanguage {
    let locale = sys_locale::get_locale().unwrap_or_default().to_lowercase();
    if locale.starts_with("zh") {
        TrayLanguage::ZhCn
    } else {
        TrayLanguage::En
    }
}

fn tray_labels(language: TrayLanguage) -> TrayLabels {
    match language {
        TrayLanguage::En => TrayLabels {
            show_panel: "Open Session Panel",
            show_pet: "Show / Hide Pet",
            dnd: "Do Not Disturb",
            refresh: "Refresh Sessions",
            open_data: "Open Data Folder",
            settings: "Settings",
            quit: "Quit",
        },
        TrayLanguage::ZhCn => TrayLabels {
            show_panel: "打开会话面板",
            show_pet: "显示 / 隐藏宠物",
            dnd: "勿扰",
            refresh: "刷新会话",
            open_data: "打开数据文件夹",
            settings: "设置",
            quit: "退出",
        },
    }
}

fn tray_icon_image() -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
}

fn open_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
