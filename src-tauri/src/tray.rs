use crate::{app_settings, session_store};
use std::{path::Path, process::Command};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager,
};

const SESSION_CHANGED_EVENT: &str = "claude-sprout://sessions-changed";
const SETTINGS_CHANGED_EVENT: &str = "claude-sprout://settings-changed";
const OPEN_SETTINGS_EVENT: &str = "claude-sprout://open-settings";

pub fn create_tray(app: &mut App) -> tauri::Result<()> {
    let show_panel = MenuItem::with_id(app, "open_panel", "Open Session Panel", true, None::<&str>)?;
    let show_pet = MenuItem::with_id(app, "toggle_pet", "Show / Hide Pet", true, None::<&str>)?;
    let dnd = MenuItem::with_id(app, "dnd", "Do Not Disturb", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh Sessions", true, None::<&str>)?;
    let open_data =
        MenuItem::with_id(app, "open_data", "Open Data Folder", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show_pet, &show_panel, &dnd, &refresh, &open_data, &settings, &quit],
    )?;

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

    tray = tray.icon(tray_icon_image());

    tray.build(app)?;

    Ok(())
}

fn tray_icon_image() -> Image<'static> {
    const SIZE: u32 = 32;
    let mut rgba = vec![0; (SIZE * SIZE * 4) as usize];

    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f64 - 16.0;
            let dy = y as f64 - 19.0;
            if (dx * dx) / 13.5_f64.powi(2) + (dy * dy) / 11.0_f64.powi(2) <= 1.0 {
                set_pixel(&mut rgba, x, y, [66, 136, 98, 255]);
            }

            let leaf_dx = x as f64 - 19.0;
            let leaf_dy = y as f64 - 8.5;
            if (leaf_dx * leaf_dx) / 8.5_f64.powi(2) + (leaf_dy * leaf_dy) / 5.0_f64.powi(2)
                <= 1.0
            {
                set_pixel(&mut rgba, x, y, [178, 216, 111, 255]);
            }
        }
    }

    for (x, y) in [(12, 18), (21, 18)] {
        for py in y..(y + 3) {
            for px in x..(x + 3) {
                set_pixel(&mut rgba, px, py, [16, 32, 26, 255]);
            }
        }
    }

    Image::new_owned(rgba, SIZE, SIZE)
}

fn set_pixel(rgba: &mut [u8], x: u32, y: u32, color: [u8; 4]) {
    let index = ((y * 32 + x) * 4) as usize;
    rgba[index..index + 4].copy_from_slice(&color);
}

fn open_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
