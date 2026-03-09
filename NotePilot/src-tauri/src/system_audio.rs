// system_audio.rs — WASAPI loopback using wasapi 0.17 (exact API from compiler errors)

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use base64::{Engine as _, engine::general_purpose};
use wasapi::{
    get_default_device, initialize_mta,
    Direction, SampleType, StreamMode, WaveFormat,
};

pub struct SystemAudioCapture {
    is_running:  Arc<AtomicBool>,
    samples:     Arc<Mutex<Vec<i16>>>,
    sample_rate: Arc<Mutex<u32>>,
    channels:    Arc<Mutex<u16>>,
}

impl SystemAudioCapture {
    pub fn new() -> Self {
        Self {
            is_running:  Arc::new(AtomicBool::new(false)),
            samples:     Arc::new(Mutex::new(Vec::new())),
            sample_rate: Arc::new(Mutex::new(44100)),
            channels:    Arc::new(Mutex::new(2)),
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
        let ch_out   = Arc::clone(&self.channels);

        std::thread::spawn(move || {
            // initialize_mta() returns HRESULT, not Result — just call it
            initialize_mta().ok();

            let device = get_default_device(&Direction::Render)
                .expect("Failed to get render device");

            let mut audio_client = device
                .get_iaudioclient()
                .expect("Failed to get IAudioClient");

            // Correct method name from compiler: get_mixformat (not get_mixformat_and_periodicty)
            let mix_fmt = audio_client
                .get_mixformat()
                .expect("Failed to get mix format");

            let sr = mix_fmt.get_samplespersec();
            let ch = mix_fmt.get_nchannels() as u16;

            *sr_out.lock().unwrap() = sr;
            *ch_out.lock().unwrap() = ch;

            // Build F32 capture format
            let capture_fmt = WaveFormat::new(
                32, // storebits
                32, // validbits
                &SampleType::Float, // <-- Fix: Use SampleType::Float
                sr as usize,        // <-- Cast to usize
                ch as usize,        // <-- Cast to usize
                None,               // <-- Fix: 6th argument for channel_mask
            ).unwrap();             // <-- Fix: Unwrap the Result

            // initialize_client takes exactly 3 args: &format, &Direction, &StreamMode
            // Loopback = Capture direction on a Render device
            let mode = StreamMode::PollingShared {
                autoconvert: true,
                buffer_duration_hns: 200_000,
            };

            audio_client
                .initialize_client(&capture_fmt, &Direction::Capture, &mode)
                .expect("Failed to initialize loopback client");

            let capture_client = audio_client
                .get_audiocaptureclient()
                .expect("Failed to get capture client");

            audio_client.start_stream().expect("Failed to start stream");
            eprintln!("✅ Loopback started: {}hz {}ch", sr, ch);

            while running.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(20));

                loop {
                    // get_next_packet_size returns Result<Option<u32>>
                    let pkt = match capture_client.get_next_packet_size() {
                        Ok(Some(n)) if n > 0 => n,
                        _ => break,
                    };

                    // read_from_device(&mut [u8]) returns WasapiRes<(u32, BufferFlags)>
                    let frame_size = ch as usize * 4; // f32 = 4 bytes per sample
                    let mut raw = vec![0u8; pkt as usize * frame_size];

                    match capture_client.read_from_device(&mut raw) {
                        Ok(_) => {}
                        Err(_) => break,
                    }

                    // Convert raw F32 LE bytes → i16
                    let mut buf = samples.lock().unwrap();
                    for chunk in raw.chunks_exact(4) {
                        let f = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
                        buf.push((f.clamp(-1.0, 1.0) * i16::MAX as f32) as i16);
                    }

                    // Cap at 30 seconds
                    let max = sr as usize * ch as usize * 30;
                    if buf.len() > max {
                        let drain = buf.len() - max;
                        buf.drain(0..drain);
                    }
                }
            }

            audio_client.stop_stream().ok();
            eprintln!("Loopback stopped");
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn take_audio_base64(&self) -> Option<String> {
        let mut samples = self.samples.lock().unwrap();
        if samples.len() < 1000 { return None; }

        let data = samples.clone();
        samples.clear();

        let sr = *self.sample_rate.lock().unwrap();
        let ch = *self.channels.lock().unwrap();

        let mut wav: Vec<u8> = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut wav);
            let spec = hound::WavSpec {
                channels:        ch,
                sample_rate:     sr,
                bits_per_sample: 16,
                sample_format:   hound::SampleFormat::Int,
            };
            if let Ok(mut w) = hound::WavWriter::new(cursor, spec) {
                for &s in &data { let _ = w.write_sample(s); }
                let _ = w.finalize();
            }
        }

        if wav.is_empty() { return None; }
        Some(general_purpose::STANDARD.encode(&wav))
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}