#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("NotePilot")
            .maximized(true)
            .decorations(false)
            .always_on_top(true)
            .transparent(true)
            .build()?;

            #[cfg(target_os = "macos")]
            {
                let panel = window.to_panel()?;
                panel.set_level(4); 
                panel.set_style_mask(1 << 7); 
            }

            #[cfg(target_os = "windows")]
            {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};

                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                      
                        let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as _), WDA_EXCLUDEFROMCAPTURE);
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}