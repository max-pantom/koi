use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, Wry,
};

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let about = AboutMetadata {
        name: Some("Koi".into()),
        version: Some("0.1.0".into()),
        copyright: Some("Copyright © 2026 Koi".into()),
        comments: Some("A tiny local moodboard for folders.".into()),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app,
        "Koi",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Koi"), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "preferences", "Settings...", true, Some("Cmd+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "add-folder", "Add Folder...", true, Some("Cmd+O"))?,
            &MenuItem::with_id(app, "rescan", "Rescan Folders", true, Some("Cmd+R"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "open-inbox", "Open Inbox", true, Some("Cmd+Shift+I"))?,
            &MenuItem::with_id(app, "reconnect-folder", "Locate Missing Folder...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "search", "Search", true, Some("Cmd+F"))?,
            &MenuItem::with_id(app, "command-menu", "Command Menu", true, Some("Cmd+K"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "grid-view", "Grid View", true, Some("Cmd+1"))?,
            &MenuItem::with_id(app, "focus-view", "Focus View", true, Some("Cmd+2"))?,
            &MenuItem::with_id(app, "toggle-dark", "Toggle Dark Mode", true, Some("M"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "bigger-thumbnails", "Bigger Thumbnails", true, Some("Cmd+="))?,
            &MenuItem::with_id(app, "smaller-thumbnails", "Smaller Thumbnails", true, Some("Cmd+-"))?,
            &MenuItem::with_id(app, "reset-thumbnails", "Reset Thumbnail Size", true, Some("Cmd+0"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let image_menu = Submenu::with_items(
        app,
        "Image",
        true,
        &[
            &MenuItem::with_id(app, "quick-look", "Quick Look", true, Some("Space"))?,
            &MenuItem::with_id(app, "show-palette", "Show Palette", true, Some("P"))?,
            &MenuItem::with_id(app, "edit-tags", "Edit Tags", true, Some("T"))?,
            &MenuItem::with_id(app, "similar", "Show Similar", true, Some("S"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "reveal", "Reveal in Finder", true, Some("Cmd+Shift+R"))?,
            &MenuItem::with_id(app, "copy-path", "Copy File Path", true, Some("Cmd+Shift+C"))?,
            &MenuItem::with_id(app, "copy-name", "Copy Image Name", true, Some("Cmd+Option+C"))?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::bring_all_to_front(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &image_menu, &window_menu],
    )
}

pub fn handle(app: &AppHandle, id: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("koi-menu", id);
    }
}
