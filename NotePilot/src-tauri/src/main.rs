#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod system_audio;

use tauri::Manager;
use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use system_audio::SystemAudioCapture;

struct AudioState(Arc<Mutex<SystemAudioCapture>>);

#[tauri::command]
fn start_system_audio(state: tauri::State<AudioState>) -> Result<(), String> {
    let capture = state.0.lock().map_err(|e| e.to_string())?;
    capture.start()
}

#[tauri::command]
fn stop_system_audio(state: tauri::State<AudioState>) -> Result<(), String> {
    let capture = state.0.lock().map_err(|e| e.to_string())?;
    capture.stop();
    Ok(())
}

#[tauri::command]
fn get_audio_chunk(state: tauri::State<AudioState>) -> Result<Option<String>, String> {
    let capture = state.0.lock().map_err(|e| e.to_string())?;
    Ok(capture.take_audio_base64())
}

#[tauri::command]
fn is_audio_running(state: tauri::State<AudioState>) -> bool {
    if let Ok(capture) = state.0.lock() {
        capture.is_running()
    } else {
        false
    }
}

fn main() {
    let audio_state = AudioState(Arc::new(Mutex::new(SystemAudioCapture::new())));

    tauri::Builder::default()
        .manage(audio_state)
        .invoke_handler(tauri::generate_handler![
            start_system_audio,
            stop_system_audio,
            get_audio_chunk,
            is_audio_running,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_always_on_top(true);

            #[cfg(target_os = "windows")]
            {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE,
                    SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE,
                    SetWindowLongW, GetWindowLongW, GWL_EXSTYLE,
                    WS_EX_NOACTIVATE, WS_EX_TOPMOST,
                };

                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        let hwnd_val = hwnd.0 as isize;
                        let hwnd_win = HWND(hwnd_val as _);

                        let _ = SetWindowDisplayAffinity(hwnd_win, WDA_EXCLUDEFROMCAPTURE);
                        let _ = SetWindowPos(
                            hwnd_win,
                            Some(HWND_TOPMOST),
                            0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE,
                        );
                        let ex_style = GetWindowLongW(hwnd_win, GWL_EXSTYLE);
                        SetWindowLongW(
                            hwnd_win,
                            GWL_EXSTYLE,
                            ex_style | WS_EX_NOACTIVATE.0 as i32 | WS_EX_TOPMOST.0 as i32,
                        );

                        thread::spawn(move || loop {
                            thread::sleep(Duration::from_millis(500));
                            let _ = SetWindowPos(
                                HWND(hwnd_val as _),
                                Some(HWND_TOPMOST),
                                0, 0, 0, 0,
                                SWP_NOMOVE | SWP_NOSIZE,
                            );
                        });
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Focused(false) = event {
                let _ = window.set_always_on_top(true);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}