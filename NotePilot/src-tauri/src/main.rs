#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            {
                let panel = window.to_panel()?;
                panel.set_level(4); 
                panel.set_style_mask(1 << 7); 
            }

            #[cfg(target_os = "windows")]
            {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE,
                    SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE
                };

                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        // 1. Hide from screen capture overlays (Zoom, Discord, OBS, etc.)
                        let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as _), WDA_EXCLUDEFROMCAPTURE);

                        // 2. Force window to stay topmost regardless of focus
                        let _ = SetWindowPos(
                            HWND(hwnd.0 as _),
                            HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE
                        );
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}