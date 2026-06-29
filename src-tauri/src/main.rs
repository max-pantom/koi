mod commands;
mod db;
mod scanner;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::add_folder,
            commands::scan_folder,
            commands::get_media_file,
            commands::save_tags,
            commands::get_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running Koi");
}
