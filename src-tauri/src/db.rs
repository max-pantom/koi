use crate::scanner::{Folder, LibraryState, MediaItem};
use rusqlite::{params, Connection};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

pub fn get_library(app: &AppHandle) -> Result<LibraryState, String> {
    let conn = connect(app)?;
    let folders = read_folders(&conn)?;
    let items = read_items(&conn)?;
    Ok(LibraryState { folders, items })
}

pub fn save_folder(app: &AppHandle, folder: &Folder) -> Result<(), String> {
    let conn = connect(app)?;
    conn.execute(
        "insert or replace into folders (id, name, path, added_at) values (?1, ?2, ?3, ?4)",
        params![folder.id, folder.name, folder.path, folder.added_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn save_media(app: &AppHandle, items: &[MediaItem]) -> Result<(), String> {
    let mut conn = connect(app)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;

    for item in items {
        let existing_tags: Option<String> = tx
            .query_row("select tags from media where id = ?1", params![item.id], |row| row.get(0))
            .ok();
        let tags = existing_tags.unwrap_or_else(|| serialize_tags(&item.tags));
        let existing_colors: Option<(String, String)> = tx
            .query_row(
                "select dominant_colors, color_names from media where id = ?1",
                params![item.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        let (dominant_colors, color_names) = existing_colors
            .unwrap_or_else(|| (serialize_tags(&item.dominant_colors), serialize_tags(&item.color_names)));

        tx.execute(
            "insert or replace into media
            (id, folder_id, path, name, extension, kind, width, height, created_at, modified_at, tags, dominant_colors, color_names)
            values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                item.id,
                item.folder_id,
                item.path,
                item.name,
                item.extension,
                item.kind,
                item.width,
                item.height,
                item.created_at,
                item.modified_at,
                tags,
                dominant_colors,
                color_names
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn save_tags(app: &AppHandle, media_id: &str, tags: &[String]) -> Result<(), String> {
    let conn = connect(app)?;
    conn.execute(
        "update media set tags = ?1 where id = ?2",
        params![serialize_tags(tags), media_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn save_media_index(
    app: &AppHandle,
    media_id: &str,
    dominant_colors: &[String],
    color_names: &[String],
) -> Result<(), String> {
    let conn = connect(app)?;
    conn.execute(
        "update media set dominant_colors = ?1, color_names = ?2 where id = ?3",
        params![serialize_tags(dominant_colors), serialize_tags(color_names), media_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn connect(app: &AppHandle) -> Result<Connection, String> {
    let db_path = db_path(app)?;
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find app data folder: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("koi.sqlite"))
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        create table if not exists folders (
            id text primary key,
            name text not null,
            path text not null unique,
            added_at integer not null
        );

        create table if not exists media (
            id text primary key,
            folder_id text not null,
            path text not null unique,
            name text not null,
            extension text not null,
            kind text not null,
            width integer,
            height integer,
            created_at integer,
            modified_at integer,
            tags text not null default '[]'
        );
        ",
    )
    .map_err(|error| error.to_string())?;
    add_column(conn, "media", "dominant_colors", "text not null default '[]'")?;
    add_column(conn, "media", "color_names", "text not null default '[]'")?;
    Ok(())
}

fn add_column(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<(), String> {
    let sql = format!("alter table {table} add column {column} {definition}");
    match conn.execute(&sql, []) {
        Ok(_) => Ok(()),
        Err(error) if error.to_string().contains("duplicate column") => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn read_folders(conn: &Connection) -> Result<Vec<Folder>, String> {
    let mut stmt = conn
        .prepare("select id, name, path, added_at from folders order by added_at asc")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                added_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn read_items(conn: &Connection) -> Result<Vec<MediaItem>, String> {
    let mut stmt = conn
        .prepare(
            "select id, folder_id, path, name, extension, kind, width, height, created_at, modified_at, tags, dominant_colors, color_names
            from media
            order by coalesce(modified_at, created_at, 0) desc, name asc",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let tags: String = row.get(10)?;
            let dominant_colors: String = row.get(11)?;
            let color_names: String = row.get(12)?;
            Ok(MediaItem {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                path: row.get(2)?,
                name: row.get(3)?,
                extension: row.get(4)?,
                kind: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                created_at: row.get(8)?,
                modified_at: row.get(9)?,
                tags: deserialize_tags(&tags),
                dominant_colors: deserialize_tags(&dominant_colors),
                color_names: deserialize_tags(&color_names),
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn serialize_tags(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn deserialize_tags(tags: &str) -> Vec<String> {
    serde_json::from_str(tags).unwrap_or_default()
}
