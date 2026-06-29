mod commands;
mod db;
mod menu;
mod scanner;
mod watcher;

fn main() {
    tauri::Builder::default()
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
            commands::reconnect_folder,
            commands::get_library
        ])
        .setup(|app| {
            watcher::start_existing_watchers(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Koi");
}
