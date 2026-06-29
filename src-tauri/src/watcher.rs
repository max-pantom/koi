use crate::{db, scanner};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

static WATCHERS: OnceLock<Mutex<Vec<RecommendedWatcher>>> = OnceLock::new();
static LAST_EVENT: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

pub fn start_existing_watchers(app: AppHandle) {
    let Ok(library) = db::get_library(&app) else {
        return;
    };

    for folder in library.folders {
        watch_folder(app.clone(), PathBuf::from(folder.path));
    }
}

pub fn watch_folder(app: AppHandle, path: PathBuf) {
    if !path.is_dir() {
        return;
    }

    let watch_path = path.clone();
    let app_for_event = app.clone();
    let mut watcher = match RecommendedWatcher::new(
        move |result: notify::Result<Event>| {
            if result.is_ok() {
                handle_change(app_for_event.clone(), watch_path.clone());
            }
        },
        Config::default(),
    ) {
        Ok(watcher) => watcher,
        Err(_) => return,
    };

    if watcher.watch(Path::new(&path), RecursiveMode::Recursive).is_err() {
        return;
    }

    WATCHERS
        .get_or_init(|| Mutex::new(Vec::new()))
        .lock()
        .map(|mut watchers| watchers.push(watcher))
        .ok();
}

fn handle_change(app: AppHandle, folder_path: PathBuf) {
    let should_skip = LAST_EVENT
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map(|mut last| {
            let now = Instant::now();
            let skip = last
                .map(|previous| now.duration_since(previous) < Duration::from_millis(850))
                .unwrap_or(false);
            *last = Some(now);
            skip
        })
        .unwrap_or(false);

    if should_skip {
        return;
    }

    std::thread::spawn(move || {
        let folder = scanner::folder_from_path(&folder_path);
        if let Ok(items) = scanner::scan_folder_path(&folder.path, &folder.id) {
            let _ = db::save_folder(&app, &folder);
            let _ = db::save_media(&app, &items);
            let _ = app.emit("library-changed", ());
        }
    });
}
