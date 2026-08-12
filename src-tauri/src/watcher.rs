use crate::{db, scanner};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

static WATCHERS: OnceLock<Mutex<HashMap<PathBuf, RecommendedWatcher>>> = OnceLock::new();
static LAST_EVENTS: OnceLock<Mutex<HashMap<PathBuf, Instant>>> = OnceLock::new();

pub fn start_existing_watchers(app: AppHandle) {
    let Ok(library) = db::get_library(&app) else {
        return;
    };

    for folder in library.folders {
        watch_folder(app.clone(), folder.id, PathBuf::from(folder.path));
    }
}

pub fn watch_folder(app: AppHandle, folder_id: String, path: PathBuf) {
    if !path.is_dir() {
        return;
    }

    let watchers = WATCHERS.get_or_init(|| Mutex::new(HashMap::new()));
    if watchers
        .lock()
        .map(|current| current.contains_key(&path))
        .unwrap_or(true)
    {
        return;
    }

    let watch_path = path.clone();
    let watched_folder_id = folder_id.clone();
    let app_for_event = app.clone();
    let mut watcher = match RecommendedWatcher::new(
        move |result: notify::Result<Event>| {
            if result.is_ok() {
                handle_change(
                    app_for_event.clone(),
                    watched_folder_id.clone(),
                    watch_path.clone(),
                );
            }
        },
        Config::default(),
    ) {
        Ok(watcher) => watcher,
        Err(_) => return,
    };

    if watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .is_err()
    {
        return;
    }

    if let Ok(mut watchers) = watchers.lock() {
        watchers.insert(path, watcher);
    }
}

fn handle_change(app: AppHandle, folder_id: String, folder_path: PathBuf) {
    let event_at = Instant::now();
    if let Ok(mut events) = LAST_EVENTS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
    {
        events.insert(folder_path.clone(), event_at);
    }

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(650));
        let is_latest = LAST_EVENTS
            .get_or_init(|| Mutex::new(HashMap::new()))
            .lock()
            .map(|mut events| {
                let is_latest = events.get(&folder_path).copied() == Some(event_at);
                if is_latest {
                    events.remove(&folder_path);
                }
                is_latest
            })
            .unwrap_or(false);
        if !is_latest {
            return;
        }

        let folder_path_string = folder_path.to_string_lossy().to_string();
        if let Ok(items) = scanner::scan_folder_path(&folder_path_string, &folder_id) {
            let _ = db::sync_folder_media(&app, &folder_id, &items);
            let _ = app.emit("library-changed", ());
        }
    });
}
