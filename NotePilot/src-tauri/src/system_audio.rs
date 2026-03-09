// system_audio.rs
// Captures system audio (loopback) using WASAPI via cpal
// This captures ALL audio playing on the PC — including video call audio from others

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, SupportedStreamConfig};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use base64::{Engine as _, engine::general_purpose};

pub struct SystemAudioCapture {
    is_running: Arc<AtomicBool>,
    samples: Arc<Mutex<Vec<f32>>>,
}

impl SystemAudioCapture {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            samples: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Start capturing system loopback audio
    pub fn start(&self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        let host = cpal::host_from_id(
            cpal::available_hosts()
                .into_iter()
                .find(|id| *id == cpal::HostId::Wasapi)
                .ok_or("WASAPI not available")?
        ).map_err(|e| e.to_string())?;

        // Get the loopback device (system audio output = what you hear)
        let device = host
            .default_output_device()
            .ok_or("No output device found")?;

        let config = device
            .default_output_config()
            .map_err(|e| e.to_string())?;

        self.is_running.store(true, Ordering::SeqCst);

        let samples = Arc::clone(&self.samples);
        let is_running = Arc::clone(&self.is_running);

        std::thread::spawn(move || {
            let err_fn = |err| eprintln!("Stream error: {}", err);

            let stream = match config.sample_format() {
                SampleFormat::F32 => {
                    let s = Arc::clone(&samples);
                    device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _| {
                            let mut buf = s.lock().unwrap();
                            buf.extend_from_slice(data);
                            // Keep only last 30 seconds worth (at 44100hz stereo)
                            let max_samples = 44100 * 2 * 30;
                            if buf.len() > max_samples {
                                let drain_count = buf.len() - max_samples;
                                buf.drain(0..drain_count);
                            }
                        },
                        err_fn,
                        None,
                    )
                }
                SampleFormat::I16 => {
                    let s = Arc::clone(&samples);
                    device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _| {
                            let mut buf = s.lock().unwrap();
                            for &sample in data {
                                buf.push(sample as f32 / i16::MAX as f32);
                            }
                        },
                        err_fn,
                        None,
                    )
                }
                _ => {
                    eprintln!("Unsupported sample format");
                    return;
                }
            };

            match stream {
                Ok(s) => {
                    if let Err(e) = s.play() {
                        eprintln!("Failed to play stream: {}", e);
                        return;
                    }
                    // Keep thread alive while recording
                    while is_running.load(Ordering::SeqCst) {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                }
                Err(e) => eprintln!("Failed to build stream: {}", e),
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    /// Take all captured samples and encode as base64 WAV
    /// Returns base64 string ready to send to Gemini
    pub fn take_audio_base64(&self) -> Option<String> {
        let mut samples = self.samples.lock().unwrap();
        if samples.is_empty() {
            return None;
        }

        let data = samples.clone();
        samples.clear();

        // Encode as WAV in memory
        let mut wav_bytes: Vec<u8> = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut wav_bytes);
            let spec = hound::WavSpec {
                channels: 2,
                sample_rate: 44100,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            if let Ok(mut writer) = hound::WavWriter::new(cursor, spec) {
                for sample in &data {
                    let int_sample = (sample * i16::MAX as f32) as i16;
                    let _ = writer.write_sample(int_sample);
                }
                let _ = writer.finalize();
            }
        }

        Some(general_purpose::STANDARD.encode(&wav_bytes))
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}