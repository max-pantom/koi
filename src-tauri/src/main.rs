mod capture_bridge;
mod commands;
mod db;
mod menu;
mod scanner;
mod watcher;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .menu(menu::build)
        .on_menu_event(|app, event| {
            menu::handle(app, event.id().as_ref());
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::add_folder,
            commands::add_folder_path,
            commands::scan_folder,
            commands::get_media_file,
            commands::save_tags,
            commands::save_media_index,
            commands::extract_media_colors,
            commands::reconnect_folder,
            commands::get_library,
            commands::ensure_capture_folder,
            commands::delete_media,
            commands::copy_media_image,
            commands::import_clipboard
        ])
        .setup(|app| {
            // The extension can still explain that Downloads access is needed
            // while macOS is presenting the first-run folder permission sheet.
            capture_bridge::start(app.handle().clone());
            if let Err(error) = commands::ensure_capture_folder(app.handle().clone()) {
                eprintln!("Koi Capture folder unavailable: {error}");
            }
            watcher::start_existing_watchers(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Koi");
}
