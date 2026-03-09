// system_audio.rs — WASAPI loopback using Pluely's proven approach (wasapi 0.19)
// Uses EventsShared mode + read_from_device_to_deque, matching Pluely's windows.rs exactly.

use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose};
use wasapi::{
    get_default_device, Direction, SampleType, StreamMode, WaveFormat,
};

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

        // Channel to get the sample rate back from the audio thread
        let (init_tx, init_rx) = mpsc::channel::<Result<u32, String>>();

        thread::spawn(move || {
            if let Err(e) = capture_loop(samples, running, sr_out, init_tx) {
                eprintln!("NotePilot audio capture loop failed: {}", e);
            }
        });

        // Wait up to 5 seconds for the audio thread to initialize
        match init_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(rate)) => {
                eprintln!("✅ NotePilot loopback started at {}hz", rate);
                Ok(())
            }
            Ok(Err(e)) => {
                self.is_running.store(false, Ordering::SeqCst);
                Err(format!("Audio init failed: {}", e))
            }
            Err(_) => {
                self.is_running.store(false, Ordering::SeqCst);
                Err("Audio init timed out".to_string())
            }
        }
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn take_audio_base64(&self) -> Option<String> {
        let mut samples = self.samples.lock().unwrap();
        if samples.len() < 1000 {
            return None;
        }

        let data: Vec<f32> = samples.drain(..).collect();
        drop(samples);

        let sr = *self.sample_rate.lock().unwrap();

        // Convert f32 samples → i16 WAV
        let mut wav: Vec<u8> = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut wav);
            let spec = hound::WavSpec {
                channels:        1,
                sample_rate:     sr,
                bits_per_sample: 16,
                sample_format:   hound::SampleFormat::Int,
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
    let _ = wasapi::initialize_mta();

    // Get the default render (speaker) device for loopback
    let device = match get_default_device(&Direction::Render) {
        Ok(d) => d,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get render device: {}", e)));
            return Ok(());
        }
    };

    let mut audio_client = match device.get_iaudioclient() {
        Ok(c) => c,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get IAudioClient: {}", e)));
            return Ok(());
        }
    };

    // Get the device's native mix format to find actual sample rate
    let mix_fmt = match audio_client.get_mixformat() {
        Ok(f) => f,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get mix format: {}", e)));
            return Ok(());
        }
    };

    let actual_rate = mix_fmt.get_samplespersec();
    *sr_out.lock().unwrap() = actual_rate;

    // Request mono F32 — Pluely uses (32, 32, Float, rate, 1, None)
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
            let _ = init_tx.send(Err(format!("Failed to create WaveFormat: {}", e)));
            return Ok(());
        }
    };

    // Get device period for buffer sizing
    let (_def_time, min_time) = match audio_client.get_device_period() {
        Ok(p) => p,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get device period: {}", e)));
            return Ok(());
        }
    };

    // Use EventsShared — this is what Pluely uses and it actually works
    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: min_time,
    };

    if let Err(e) = audio_client.initialize_client(&capture_fmt, &Direction::Capture, &mode) {
        let _ = init_tx.send(Err(format!("Failed to initialize client: {}", e)));
        return Ok(());
    }

    // Set up event handle for EventsShared mode
    let h_event = match audio_client.set_get_eventhandle() {
        Ok(h) => h,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get event handle: {}", e)));
            return Ok(());
        }
    };

    let capture_client = match audio_client.get_audiocaptureclient() {
        Ok(c) => c,
        Err(e) => {
            let _ = init_tx.send(Err(format!("Failed to get capture client: {}", e)));
            return Ok(());
        }
    };

    if let Err(e) = audio_client.start_stream() {
        let _ = init_tx.send(Err(format!("Failed to start stream: {}", e)));
        return Ok(());
    }

    // Signal success with the sample rate
    let _ = init_tx.send(Ok(actual_rate));

    // Capture loop — wait for event, then drain available packets
    while running.load(Ordering::SeqCst) {
        // Wait up to 3 seconds for an audio event
        if h_event.wait_for_event(3000).is_err() {
            eprintln!("NotePilot: audio event timeout, stopping capture");
            break;
        }

        // Read all available frames into a temporary deque
        let mut temp_queue: VecDeque<u8> = VecDeque::new();
        if let Err(e) = capture_client.read_from_device_to_deque(&mut temp_queue) {
            eprintln!("NotePilot: read error: {}", e);
            continue;
        }

        if temp_queue.is_empty() {
            continue;
        }

        // Decode raw F32 LE bytes → f32 samples
        let mut new_samples: Vec<f32> = Vec::with_capacity(temp_queue.len() / 4);
        while temp_queue.len() >= 4 {
            let bytes = [
                temp_queue.pop_front().unwrap(),
                temp_queue.pop_front().unwrap(),
                temp_queue.pop_front().unwrap(),
                temp_queue.pop_front().unwrap(),
            ];
            new_samples.push(f32::from_le_bytes(bytes));
        }

        if new_samples.is_empty() {
            continue;
        }

        // Push to shared buffer, capping at 30 seconds
        let mut buf = samples.lock().unwrap();
        buf.extend(new_samples.iter());

        let max = actual_rate as usize * 30;
        if buf.len() > max {
            let to_drop = buf.len() - max;
            buf.drain(0..to_drop);
        }
    }

    audio_client.stop_stream().ok();
    eprintln!("NotePilot loopback stopped.");
    Ok(())
}