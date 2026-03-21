// system_audio.rs — WASAPI loopback capture using get_buffer/release_buffer (wasapi 0.19)
// Captures system audio (speaker output) and accumulates as mono f32 samples.

use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose};
use wasapi::{get_default_device, Direction, SampleType, StreamMode, WaveFormat};

pub struct SystemAudioCapture {
    is_running:  Arc<AtomicBool>,
    samples:     Arc<Mutex<VecDeque<f32>>>,
    sample_rate: Arc<Mutex<u32>>,
}

impl SystemAudioCapture {
    pub fn new() -> Self {
        Self {
            is_running:  Arc::new(AtomicBool::new(false)),
            samples:     Arc::new(Mutex::new(VecDeque::new())),
            sample_rate: Arc::new(Mutex::new(44100)),
        }
    }

    pub fn start(&self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.is_running.store(true, Ordering::SeqCst);

        let samples  = Arc::clone(&self.samples);
        let running  = Arc::clone(&self.is_running);
        let sr_out   = Arc::clone(&self.sample_rate);

        let (init_tx, init_rx) = mpsc::channel::<Result<u32, String>>();

        thread::spawn(move || {
            if let Err(e) = capture_loop(samples, running, sr_out, init_tx) {
                eprintln!("NotePilot audio capture loop failed: {e}");
            }
        });

        match init_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(rate)) => {
                eprintln!("✅ NotePilot loopback started at {}hz", rate);
                Ok(())
            }
            Ok(Err(e)) => {
                self.is_running.store(false, Ordering::SeqCst);
                Err(format!("Audio init failed: {e}"))
            }
            Err(_) => {
                self.is_running.store(false, Ordering::SeqCst);
                Err("Audio init timed out — is system audio device available?".to_string())
            }
        }
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    /// Drain accumulated samples into a base64-encoded WAV chunk.
    /// Returns None if fewer than ~100ms of audio is buffered.
    pub fn take_audio_base64(&self) -> Option<String> {
        let mut samples = self.samples.lock().unwrap();
        if samples.len() < 1000 {
            return None;
        }

        // Atomically drain all samples
        let data: Vec<f32> = samples.drain(..).collect();
        drop(samples);

        let sr = *self.sample_rate.lock().unwrap();

        // Convert f32 → i16 WAV
        let mut wav: Vec<u8> = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut wav);
            let spec = hound::WavSpec {
                channels: 1,
                sample_rate: sr,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            if let Ok(mut w) = hound::WavWriter::new(cursor, spec) {
                for &s in &data {
                    let clamped = s.clamp(-1.0, 1.0);
                    let _ = w.write_sample((clamped * i16::MAX as f32) as i16);
                }
                let _ = w.finalize();
            }
        }

        if wav.is_empty() {
            return None;
        }
        Some(general_purpose::STANDARD.encode(&wav))
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}

fn capture_loop(
    samples: Arc<Mutex<VecDeque<f32>>>,
    running: Arc<AtomicBool>,
    sr_out:  Arc<Mutex<u32>>,
    init_tx: mpsc::Sender<Result<u32, String>>,
) -> anyhow::Result<()> {
    // Initialize COM for this thread (MTA)
    let _co = wasapi::initialize_mta();

    // Get the default render (speaker) device for loopback capture
    let device = match get_default_device(&Direction::Render) {
        Ok(d) => d,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get render device: {e}")));
            return Ok(());
        }
    };

    let mut audio_client = match device.get_iaudioclient() {
        Ok(c) => c,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get IAudioClient: {e}")));
            return Ok(());
        }
    };

    // Get native mix format to read actual sample rate
    let mix_fmt = match audio_client.get_mixformat() {
        Ok(f) => f,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get mix format: {e}")));
            return Ok(());
        }
    };

    let actual_rate = mix_fmt.get_samplespersec();
    *sr_out.lock().unwrap() = actual_rate;
    eprintln!("NotePilot: device sample rate = {actual_rate}hz");

    // Request mono F32 capture format
    let capture_fmt = match WaveFormat::new(
        32,
        32,
        &SampleType::Float,
        actual_rate as usize,
        1,
        None,
    ) {
        Ok(f) => f,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to create WaveFormat: {e}")));
            return Ok(());
        }
    };

    // Get minimum device period for buffer sizing
    let (_def_time, min_time) = match audio_client.get_device_period() {
        Ok(p) => p,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get device period: {e}")));
            return Ok(());
        }
    };

    // EventsShared mode — WASAPI event-driven capture with auto-conversion
    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: min_time,
    };

    if let Err(e) = audio_client.initialize_client(&capture_fmt, &Direction::Capture, &mode) {
        let _ = init_tx.send(Err(format!("Failed to initialize client: {e}")));
        return Ok(());
    }

    let h_event = match audio_client.set_get_eventhandle() {
        Ok(h) => h,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get event handle: {e}")));
            return Ok(());
        }
    };

    let capture_client = match audio_client.get_audiocaptureclient() {
        Ok(c) => c,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get capture client: {e}")));
            return Ok(());
        }
    };

    if let Err(e) = audio_client.start_stream() {
        let _ = init_tx.send(Err(format!("Failed to start stream: {e}")));
        return Ok(());
    }

    // Signal success
    let _ = init_tx.send(Ok(actual_rate));

    // Capture loop — wait for WASAPI event, then read buffered audio
    while running.load(Ordering::SeqCst) {
        // Wait up to 2s for audio data
        if h_event.wait_for_event(2000).is_err() {
            continue; // timeout is normal when no audio is playing
        }

        // Read all available packets using get_buffer/release_buffer
        loop {
            let (frames_available, buffer_bytes) = match capture_client.get_buffer() {
                Ok((0, _)) | Err(_) => break, // no more data
                Ok((frames, buf)) => (frames, buf),
            };

            if frames_available > 0 && !buffer_bytes.is_empty() {
                // Decode raw LE bytes as f32 samples
                let mut new_samples = Vec::with_capacity(buffer_bytes.len() / 4);
                for chunk in buffer_bytes.chunks_exact(4) {
                    let bytes: [u8; 4] = chunk.try_into().unwrap_or([0; 4]);
                    let sample = f32::from_le_bytes(bytes);
                    if sample.is_finite() {
                        new_samples.push(sample);
                    }
                }

                // Append to shared buffer, capped at 30 seconds
                if !new_samples.is_empty() {
                    let mut buf = samples.lock().unwrap();
                    buf.extend(new_samples.iter());
                    let max = actual_rate as usize * 30;
                    if buf.len() > max {
                        let to_drop = buf.len() - max;
                        buf.drain(0..to_drop);
                    }
                }
            }

            // Release buffer so WASAPI can reuse it
            let _ = capture_client.release_buffer(frames_available);
        }
    }

    let _ = audio_client.stop_stream();
    eprintln!("NotePilot loopback capture stopped.");
    Ok(())
}
