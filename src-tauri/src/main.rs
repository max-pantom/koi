mod capture_bridge;
mod commands;
mod db;
mod mcp;
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
            commands::reset_color_index,
            commands::reconnect_folder,
            commands::get_library,
            commands::ensure_capture_folder,
            commands::delete_media,
            commands::copy_media_image,
            commands::import_clipboard,
            commands::refresh_link_preview,
            commands::mcp_get_status,
            commands::mcp_set_enabled,
            commands::mcp_regenerate_token
        ])
        .setup(|app| {
            // The extension can still explain that Downloads access is needed
            // while macOS is presenting the first-run folder permission sheet.
            capture_bridge::start(app.handle().clone());
            // The MCP listener gates every request on its persisted enable
            // flag, so binding early keeps toggling instant.
            mcp::start(app.handle().clone());
            if let Err(error) = commands::ensure_capture_folder(app.handle().clone()) {
                eprintln!("Koi Capture folder unavailable: {error}");
            }
            watcher::start_existing_watchers(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Koi");
}
