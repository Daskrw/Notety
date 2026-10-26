use tauri::{Manager, WebviewBuilder, WebviewUrl, LogicalPosition, LogicalSize, Url};

#[cfg(windows)]
mod audio_monitor {
  use std::collections::{HashMap, HashSet};
  use std::sync::atomic::{AtomicBool, Ordering};
  use std::sync::Arc;
  use std::thread;
  use std::time::{Duration, Instant};
  use tauri::{AppHandle, Emitter};
  use windows::core::Interface;
  use windows::Win32::Foundation::CloseHandle;
  use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
  use windows::Win32::Media::Audio::{
    eConsole, eMultimedia, eRender, AudioSessionState, AudioSessionStateActive,
    IAudioSessionControl2, IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator,
  };
  use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
  };
  use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
  };

  #[derive(Default, Debug, Clone)]
  pub(crate) struct ProcessTreeInfo {
    pub(crate) internal_pids: HashSet<u32>,
    pub(crate) pid_to_name: HashMap<u32, String>,
  }

  pub(crate) fn query_process_tree() -> ProcessTreeInfo {
    let my_pid = std::process::id();
    let mut internal_pids = HashSet::new();
    internal_pids.insert(my_pid);
    let mut pid_to_name = HashMap::new();

    unsafe {
      if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
        let mut entry = PROCESSENTRY32W::default();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut procs = Vec::new();
        if Process32FirstW(snapshot, &mut entry).is_ok() {
          loop {
            let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
            let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
            pid_to_name.insert(entry.th32ProcessID, name.clone());
            procs.push((entry.th32ProcessID, entry.th32ParentProcessID, name));

            if Process32NextW(snapshot, &mut entry).is_err() {
              break;
            }
          }
        }
        let _ = CloseHandle(snapshot);

        // Transitive closure: find all descendants of my_pid regardless of enumeration order
        let mut added = true;
        while added {
          added = false;
          for (pid, parent_pid, _) in &procs {
            if internal_pids.contains(parent_pid) && !internal_pids.contains(pid) {
              internal_pids.insert(*pid);
              added = true;
            }
          }
        }
      }
    }

    ProcessTreeInfo {
      internal_pids,
      pid_to_name,
    }
  }

  pub(crate) struct ProcessClassifier {
    pub(crate) my_pid: u32,
    pub(crate) internal_pids: HashSet<u32>,
    pub(crate) known_external_pids: HashSet<u32>,
    pub(crate) pid_to_name: HashMap<u32, String>,
    pub(crate) last_full_scan: Instant,
  }

  impl ProcessClassifier {
    pub(crate) fn new() -> Self {
      let mut classifier = Self {
        my_pid: std::process::id(),
        internal_pids: HashSet::new(),
        known_external_pids: HashSet::new(),
        pid_to_name: HashMap::new(),
        last_full_scan: Instant::now() - Duration::from_secs(60),
      };
      classifier.refresh_full();
      classifier
    }

    pub(crate) fn refresh_full(&mut self) {
      let tree = query_process_tree();
      self.internal_pids = tree.internal_pids;
      self.pid_to_name = tree.pid_to_name;
      self.known_external_pids.clear();
      self.last_full_scan = Instant::now();
    }

    pub(crate) fn is_internal(&mut self, pid: u32) -> bool {
      if pid == 0 {
        return false;
      }
      if pid == self.my_pid || self.internal_pids.contains(&pid) {
        return true;
      }
      if self.known_external_pids.contains(&pid) {
        return false;
      }

      // If full scan is older than 5 seconds, refresh fully
      if self.last_full_scan.elapsed() >= Duration::from_secs(5) {
        self.refresh_full();
        if self.internal_pids.contains(&pid) {
          return true;
        } else {
          self.known_external_pids.insert(pid);
          return false;
        }
      }

      // Check if newly spawned process is a child WebView2 of our app
      let tree = query_process_tree();
      self.internal_pids = tree.internal_pids;
      self.pid_to_name = tree.pid_to_name;
      if self.internal_pids.contains(&pid) {
        true
      } else {
        self.known_external_pids.insert(pid);
        false
      }
    }

    pub(crate) fn get_name(&self, pid: u32) -> String {
      if pid == 0 {
        "[System Process]".to_string()
      } else {
        self.pid_to_name.get(&pid).cloned().unwrap_or_else(|| "Unknown".to_string())
      }
    }
  }

  #[derive(Debug, Clone)]
  #[allow(dead_code)]
  struct TrackedSession {
    pid: u32,
    process_name: String,
    is_internal: bool,
    is_system_sound: bool,
    last_state: AudioSessionState,
    last_peak: f32,
    silent_ticks: u32,
    last_seen: Instant,
  }

  pub fn start_audio_monitor(app_handle: AppHandle) -> Arc<AtomicBool> {
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    thread::spawn(move || {
      log::info!("[AudioMonitor] Starting Windows Core Audio monitor (multimedia + console endpoint tracking)");
      unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
      }

      let mut classifier = ProcessClassifier::new();
      let mut tracked_sessions: HashMap<String, TrackedSession> = HashMap::new();
      let mut last_trigger = Instant::now() - Duration::from_secs(10);
      let debounce = Duration::from_millis(500);
      let mut last_cleanup = Instant::now();
      let mut last_diag_log = Instant::now();

      while running_clone.load(Ordering::Relaxed) {
        let cycle_now = Instant::now();

        // 1. Enumerate default audio endpoints for both eMultimedia and eConsole
        let enumerator: IMMDeviceEnumerator = match unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) } {
          Ok(e) => e,
          Err(err) => {
            log::warn!("[AudioMonitor] Failed to create MMDeviceEnumerator: {:?}", err);
            thread::sleep(Duration::from_millis(100));
            continue;
          }
        };

        let mut devices: Vec<IMMDevice> = Vec::new();
        let mut seen_ids: HashSet<String> = HashSet::new();

        for role in [eMultimedia, eConsole] {
          unsafe {
            if let Ok(dev) = enumerator.GetDefaultAudioEndpoint(eRender, role) {
              let id = if let Ok(pwstr) = dev.GetId() {
                pwstr.to_string().unwrap_or_default()
              } else {
                String::new()
              };
              if id.is_empty() || seen_ids.insert(id) {
                devices.push(dev);
              }
            }
          }
        }

        if devices.is_empty() {
          // Device unplugged or transitioning
          thread::sleep(Duration::from_millis(100));
          continue;
        }

        let mut current_cycle_external_playback: Option<(u32, String, f32, &'static str)> = None;
        let mut total_internal_peak: f32 = 0.0;
        let mut total_internal_active: usize = 0;
        let mut total_master_peak: f32 = 0.0;
        let mut total_sessions_found: usize = 0;

        // 2. Scan sessions on each active endpoint
        for device in &devices {
          unsafe {
            let master_peak = if let Ok(meter) = device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) {
              meter.GetPeakValue().unwrap_or(0.0)
            } else {
              0.0
            };
            total_master_peak = total_master_peak.max(master_peak);

            if let Ok(session_mgr) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
              if let Ok(session_enum) = session_mgr.GetSessionEnumerator() {
                let count = session_enum.GetCount().unwrap_or(0);
                total_sessions_found += count as usize;

                for i in 0..count {
                  if let Ok(control) = session_enum.GetSession(i) {
                    let state = match control.GetState() {
                      Ok(s) => s,
                      Err(_) => continue,
                    };

                    let (is_system_sound, pid, instance_id) = if let Ok(c2) = control.cast::<IAudioSessionControl2>() {
                      let hr = (c2.vtable().IsSystemSoundsSession)(Interface::as_raw(&c2));
                      let is_sys = hr == windows::core::HRESULT(0);
                      let p = c2.GetProcessId().unwrap_or(0);
                      let inst_id = if let Ok(pwstr) = c2.GetSessionInstanceIdentifier() {
                        pwstr.to_string().unwrap_or_else(|_| format!("{}_{}", p, i))
                      } else {
                        format!("{}_{}", p, i)
                      };
                      (is_sys, p, inst_id)
                    } else {
                      (false, 0, format!("sess_{}", i))
                    };

                    let peak = if let Ok(sm) = control.cast::<IAudioMeterInformation>() {
                      sm.GetPeakValue().unwrap_or(0.0)
                    } else {
                      0.0
                    };

                    let is_internal = !is_system_sound && classifier.is_internal(pid);
                    let proc_name = if is_system_sound {
                      "SystemSounds".to_string()
                    } else {
                      classifier.get_name(pid)
                    };

                    if is_internal {
                      if state == AudioSessionStateActive {
                        total_internal_active += 1;
                        total_internal_peak = total_internal_peak.max(peak);
                      }
                    } else {
                      let prev = tracked_sessions.get(&instance_id).cloned();
                      let mut should_trigger: Option<&'static str> = None;

                      if is_system_sound {
                        // System notification sound / alert
                        if peak >= 0.002 {
                          should_trigger = Some("System Notification Sound");
                        }
                      } else {
                        // External application (e.g. Microsoft Edge, Chrome, Spotify, etc.)
                        if state == AudioSessionStateActive {
                          if let Some(ref prev_state) = prev {
                            // Case A: Existing session transitioned from Inactive to Active with audio stream
                            if prev_state.last_state != AudioSessionStateActive && peak >= 0.001 {
                              should_trigger = Some("External Session Transitioned Inactive -> Active");
                            }
                            // Case B: Session was Active, but silent, now producing audible audio
                            else if prev_state.silent_ticks >= 2 && peak >= 0.003 {
                              should_trigger = Some("External Playback Resumed from Silence");
                            }
                            // Case C: Continuous active playback onset
                            else if peak >= 0.005 && prev_state.last_peak < 0.002 {
                              should_trigger = Some("External Audio Onset");
                            }
                          } else {
                            // Case D: Newly enumerated session already active with sound
                            if peak >= 0.002 {
                              should_trigger = Some("New Active External Session Detected");
                            }
                          }
                        }
                      }

                      if let Some(reason) = should_trigger {
                        if current_cycle_external_playback.is_none() {
                          current_cycle_external_playback = Some((pid, proc_name.clone(), peak, reason));
                        }
                      }

                      let silent_ticks = if peak < 0.001 {
                        prev.map(|p| p.silent_ticks.saturating_add(1)).unwrap_or(1)
                      } else {
                        0
                      };

                      tracked_sessions.insert(
                        instance_id,
                        TrackedSession {
                          pid,
                          process_name: proc_name,
                          is_internal,
                          is_system_sound,
                          last_state: state,
                          last_peak: peak,
                          silent_ticks,
                          last_seen: cycle_now,
                        },
                      );
                    }
                  }
                }
              }
            }
          }
        }

        // 3. Master endpoint fallback: audible audio present while NO internal session has audio
        if current_cycle_external_playback.is_none()
          && total_internal_active == 0
          && total_internal_peak < 0.001
          && total_master_peak >= 0.015
        {
          current_cycle_external_playback = Some((0, "MasterEndpointAudio".to_string(), total_master_peak, "Master Endpoint Fallback"));
        }

        // 4. Accept interruption if eligible
        if let Some((pid, proc_name, peak, reason)) = current_cycle_external_playback {
          let now = Instant::now();
          if now.duration_since(last_trigger) >= debounce {
            last_trigger = now;
            log::info!(
              "[AudioMonitor] Legitimate external audio interruption ACCEPTED: {} from pid={} ({}), peak={:.4}. Switching to Notes and pausing Devtool media",
              reason, pid, proc_name, peak
            );

            // 1. Pause Devtool media across child WebViews immediately
            super::pause_all_child_webviews(&app_handle);

            // 2. Emit event to frontend to switch to Notes mode
            let _ = app_handle.emit("quietnotes://audio-detected", ());
          }
        }

        // 5. Periodic cleanup of stale sessions every 10 seconds
        if cycle_now.duration_since(last_cleanup) >= Duration::from_secs(10) {
          tracked_sessions.retain(|_, s| cycle_now.duration_since(s.last_seen) < Duration::from_secs(15));
          last_cleanup = cycle_now;
        }

        // 6. Periodic diagnostic log every 5 seconds (throttled)
        if cycle_now.duration_since(last_diag_log) >= Duration::from_secs(5) {
          log::debug!(
            "[AudioMonitor] Diagnostic snapshot: devices={}, sessions={}, int_active={}, int_peak={:.4}, master_peak={:.4}",
            devices.len(), total_sessions_found, total_internal_active, total_internal_peak, total_master_peak
          );
          last_diag_log = cycle_now;
        }

        thread::sleep(Duration::from_millis(30));
      }

      unsafe {
        CoUninitialize();
      }
      log::info!("[AudioMonitor] Windows audio activity monitor stopped cleanly");
    });

    running
  }
}


#[cfg(not(windows))]
mod audio_monitor {
  use std::sync::atomic::AtomicBool;
  use std::sync::Arc;
  use tauri::AppHandle;

  pub fn start_audio_monitor(_app_handle: AppHandle) -> Arc<AtomicBool> {
    log::info!("[AudioMonitor] Audio monitoring is only supported on Windows");
    Arc::new(AtomicBool::new(false))
  }
}

pub fn pause_all_child_webviews(app: &tauri::AppHandle) {
  let pause_js = r#"
    try {
      document.querySelectorAll('video, audio').forEach(function(el) {
        if (!el.paused) {
          el.pause();
        }
      });
      if (window.player && typeof window.player.pauseVideo === 'function') {
        window.player.pauseVideo();
      }
    } catch(e) {}
  "#;
  for (label, wv) in app.webviews() {
    if label != "main" {
      let _ = wv.eval(pause_js);
    }
  }
}

#[tauri::command]
async fn browser_pause_media(app: tauri::AppHandle) -> Result<(), String> {
  pause_all_child_webviews(&app);
  Ok(())
}

fn sanitize_label(tab_id: &str) -> String {
  format!("tab_{}", tab_id.replace('-', "_"))
}

fn validate_url(raw: &str) -> Result<Url, String> {
  let trimmed = raw.trim();
  let lower = trimmed.to_lowercase();
  if lower.starts_with("javascript:") || lower.starts_with("data:") || lower.starts_with("file:") {
    return Err("Dangerous schemes (javascript, data, file) are strictly blocked".to_string());
  }

  let url = if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
    // If user enters google.com or a search term
    if trimmed.contains('.') && !trimmed.contains(' ') {
      format!("https://{}", trimmed)
    } else {
      format!("https://www.google.com/search?q={}", urlencoding::encode(trimmed))
    }
  } else {
    trimmed.to_string()
  };

  let parsed = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
  if parsed.scheme() != "http" && parsed.scheme() != "https" {
    return Err("Only http and https protocols are supported".to_string());
  }
  Ok(parsed)
}

#[tauri::command]
async fn browser_create_tab(
  app: tauri::AppHandle,
  window: tauri::Window,
  tab_id: String,
  url: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  let pos = LogicalPosition::new(x, y);
  let size = LogicalSize::new(width.max(100.0), height.max(100.0));

  if let Some(existing) = app.get_webview(&label) {
    let _ = existing.set_position(pos);
    let _ = existing.set_size(size);
    let _ = existing.show();
    let _ = existing.set_focus();
    // Do NOT navigate existing webview!
    // The webview already exists and holds active page state, media playback, and in-memory application state.
    return Ok(());
  }

  let parsed_url = validate_url(&url)?;

  // Do NOT use .auto_resize() because it overrides manual bounds on Windows WM_SIZE
  let builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed_url));

  let child = window.add_child(builder, pos, size).map_err(|e| e.to_string())?;
  let _ = child.set_position(pos);
  let _ = child.set_size(size);
  let _ = child.show();
  let _ = child.set_focus();
  Ok(())
}

#[tauri::command]
async fn browser_switch_tab(
  app: tauri::AppHandle,
  active_tab_id: String,
  all_tab_ids: Vec<String>,
) -> Result<(), String> {
  let active_label = sanitize_label(&active_tab_id);
  for id in all_tab_ids {
    let label = sanitize_label(&id);
    if let Some(wv) = app.get_webview(&label) {
      if label == active_label {
        let _ = wv.show();
        let _ = wv.set_focus();
      } else {
        let _ = wv.hide();
      }
    }
  }
  Ok(())
}

#[tauri::command]
async fn browser_navigate(app: tauri::AppHandle, tab_id: String, url: String) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  let parsed_url = validate_url(&url)?;
  if let Some(wv) = app.get_webview(&label) {
    wv.navigate(parsed_url).map_err(|e| e.to_string())?;
    let _ = wv.set_focus();
  }
  Ok(())
}

#[tauri::command]
async fn browser_reload(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  if let Some(wv) = app.get_webview(&label) {
    wv.reload().map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
async fn browser_back(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  if let Some(wv) = app.get_webview(&label) {
    let _ = wv.eval("window.history.back()");
  }
  Ok(())
}

#[tauri::command]
async fn browser_forward(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  if let Some(wv) = app.get_webview(&label) {
    let _ = wv.eval("window.history.forward()");
  }
  Ok(())
}

#[tauri::command]
async fn browser_close_tab(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
  let label = sanitize_label(&tab_id);
  if let Some(wv) = app.get_webview(&label) {
    wv.close().map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
async fn browser_update_bounds(
  app: tauri::AppHandle,
  active_tab_id: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  let label = sanitize_label(&active_tab_id);
  if let Some(wv) = app.get_webview(&label) {
    let _ = wv.set_position(LogicalPosition::new(x, y));
    let _ = wv.set_size(LogicalSize::new(width.max(100.0), height.max(100.0)));
  }
  Ok(())
}

#[tauri::command]
async fn browser_hide_all(app: tauri::AppHandle, all_tab_ids: Vec<String>) -> Result<(), String> {
  for id in all_tab_ids {
    let label = sanitize_label(&id);
    if let Some(wv) = app.get_webview(&label) {
      let _ = wv.hide();
    }
  }
  Ok(())
}

#[tauri::command]
async fn browser_cleanup_all(app: tauri::AppHandle) -> Result<(), String> {
  for (label, wv) in app.webviews() {
    if label != "main" {
      let _ = wv.close();
    }
  }
  Ok(())
}

#[tauri::command]
async fn browser_get_url(app: tauri::AppHandle, tab_id: String) -> Result<String, String> {
  let label = sanitize_label(&tab_id);
  if let Some(wv) = app.get_webview(&label) {
    let url = wv.url().map_err(|e| e.to_string())?;
    return Ok(url.to_string());
  }
  Err("Tab not found".to_string())
}

struct AudioMonitorFlag(std::sync::Arc<std::sync::atomic::AtomicBool>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .on_window_event(|window, event| {
      // Deterministic shutdown: When main window receives CloseRequested (via X or Alt+F4),
      // cleanly stop the audio monitor thread and close all child WebView2 instances.
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        if window.label() == "main" {
          if let Some(flag) = window.try_state::<AudioMonitorFlag>() {
            flag.0.store(false, std::sync::atomic::Ordering::Relaxed);
          }
          let app = window.app_handle();
          for (label, wv) in app.webviews() {
            if label != "main" {
              let _ = wv.close();
            }
          }
        }
      }
    })
    .invoke_handler(tauri::generate_handler![
      browser_create_tab,
      browser_switch_tab,
      browser_navigate,
      browser_reload,
      browser_back,
      browser_forward,
      browser_close_tab,
      browser_update_bounds,
      browser_hide_all,
      browser_cleanup_all,
      browser_get_url,
      browser_pause_media
    ])
    .setup(|app| {
      let handle = app.handle().clone();
      let monitor_flag = audio_monitor::start_audio_monitor(handle);
      app.manage(AudioMonitorFlag(monitor_flag));

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  #[cfg(windows)]
  fn test_is_system_sounds_session_type() {
    let _ = |c2: &windows::Win32::Media::Audio::IAudioSessionControl2| {
      use windows::core::Interface;
      let hr = unsafe { (c2.vtable().IsSystemSoundsSession)(Interface::as_raw(c2)) };
      let _is_system: bool = hr == windows::core::HRESULT(0); // S_OK is 0
    };
  }

  #[test]
  #[cfg(windows)]
  fn test_inspect_real_sessions() {
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, CoCreateInstance, CLSCTX_ALL, COINIT_MULTITHREADED};
    use windows::Win32::Media::Audio::{eRender, eConsole, eMultimedia, IMMDeviceEnumerator, MMDeviceEnumerator, IAudioSessionManager2, IAudioSessionControl2};
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::core::Interface;

    unsafe {
      let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
      if let Ok(enumerator) = CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) {
        for (role_name, role) in [("eConsole", eConsole), ("eMultimedia", eMultimedia)] {
          if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, role) {
            let id = if let Ok(pwstr) = device.GetId() {
              pwstr.to_string().unwrap_or_default()
            } else {
              String::new()
            };
            println!("Endpoint for {}: ok, id={}", role_name, id);

            if let Ok(mgr) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
              if let Ok(session_enum) = mgr.GetSessionEnumerator() {
                let count = session_enum.GetCount().unwrap_or(0);
                println!("Session count for {}: {}", role_name, count);
                for i in 0..count {
                  if let Ok(control) = session_enum.GetSession(i) {
                    let state = control.GetState().map(|s| s.0).unwrap_or(-1);
                    let (is_sys, pid) = if let Ok(c2) = control.cast::<IAudioSessionControl2>() {
                      let hr = (c2.vtable().IsSystemSoundsSession)(Interface::as_raw(&c2));
                      (hr == windows::core::HRESULT(0), c2.GetProcessId().unwrap_or(0))
                    } else {
                      (false, 0)
                    };
                    let peak = if let Ok(m) = control.cast::<IAudioMeterInformation>() {
                      m.GetPeakValue().unwrap_or(-1.0)
                    } else {
                      -1.0
                    };
                    let mut name = "Unknown".to_string();
                    let proc_info = audio_monitor::query_process_tree();
                    if let Some(n) = proc_info.pid_to_name.get(&pid) {
                      name = n.clone();
                    }
                    let instance_id = if let Ok(c2) = control.cast::<IAudioSessionControl2>() {
                      if let Ok(pwstr) = c2.GetSessionInstanceIdentifier() {
                        pwstr.to_string().unwrap_or_default()
                      } else {
                        String::new()
                      }
                    } else {
                      String::new()
                    };
                    let is_internal = proc_info.internal_pids.contains(&pid);
                    println!("  Session {}: state={}, is_sys={}, pid={} ({}), is_internal={}, peak={}, inst_id_len={}", i, state, is_sys, pid, name, is_internal, peak, instance_id.len());
                  }
                }
              }
            }

          } else {
            println!("Endpoint for {}: None", role_name);
          }
        }
      }
      CoUninitialize();
    }
  }

  #[test]
  fn test_url_validation() {
    let u1 = validate_url("https://google.com").unwrap();
    assert_eq!(u1.as_str(), "https://google.com/");

    let u2 = validate_url("github.com").unwrap();
    assert_eq!(u2.as_str(), "https://github.com/");

    let u3 = validate_url("search term with space").unwrap();
    assert!(u3.as_str().starts_with("https://www.google.com/search?q="));

    let err1 = validate_url("javascript:alert(1)");
    assert!(err1.is_err());

    let err2 = validate_url("data:text/html,<h1>evil</h1>");
    assert!(err2.is_err());

    let err3 = validate_url("file:///C:/Windows/System32/cmd.exe");
    assert!(err3.is_err());
  }

  #[test]
  fn test_sanitize_label() {
    let label = sanitize_label("abc-123-def");
    assert_eq!(label, "tab_abc_123_def");
  }
}
