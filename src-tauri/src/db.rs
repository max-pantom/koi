use crate::scanner::{Folder, LibraryState, MediaItem};
use rusqlite::{params, Connection};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};
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
        "insert into folders (id, name, path, added_at) values (?1, ?2, ?3, ?4)
         on conflict(id) do update set name = excluded.name, path = excluded.path",
        params![folder.id, folder.name, folder.path, folder.added_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

/// Replace one folder's index after a complete, successful scan.
///
/// The scanner returns an error when any directory cannot be read, so pruning
/// here never turns a disconnected or temporarily unavailable folder into a
/// mass deletion. When a file moved within the folder, its tags and generated
/// colour index follow it when the filename still identifies it uniquely.
pub fn sync_folder_media(
    app: &AppHandle,
    folder_id: &str,
    items: &[MediaItem],
) -> Result<(), String> {
    let mut conn = connect(app)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let existing = {
        let mut stmt = tx
            .prepare(
                "select id, path, name, tags, dominant_colors, color_names
                 from media where folder_id = ?1",
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map(params![folder_id], |row| {
                Ok(ExistingMedia {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    tags: row.get(3)?,
                    dominant_colors: row.get(4)?,
                    color_names: row.get(5)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        rows
    };
    let scanned_paths = items
        .iter()
        .map(|item| item.path.as_str())
        .collect::<HashSet<_>>();

    for item in items {
        let existing_index = existing
            .iter()
            .find(|candidate| candidate.id == item.id || candidate.path == item.path)
            .or_else(|| {
                let mut matches = existing.iter().filter(|candidate| {
                    candidate.name == item.name
                        && !Path::new(&candidate.path).is_file()
                        && !scanned_paths.contains(candidate.path.as_str())
                });
                let first = matches.next()?;
                matches.next().is_none().then_some(first)
            });
        let (tags, dominant_colors, color_names) = existing_index
            .map(|candidate| {
                (
                    candidate.tags.clone(),
                    candidate.dominant_colors.clone(),
                    candidate.color_names.clone(),
                )
            })
            .unwrap_or_else(|| {
                (
                    serialize_tags(&item.tags),
                    serialize_tags(&item.dominant_colors),
                    serialize_tags(&item.color_names),
                )
            });

        upsert_media(&tx, item, tags, dominant_colors, color_names)?;
    }

    for candidate in existing {
        if !scanned_paths.contains(candidate.path.as_str()) {
            tx.execute("delete from media where id = ?1", params![candidate.id])
                .map_err(|error| error.to_string())?;
        }
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
        params![
            serialize_tags(dominant_colors),
            serialize_tags(color_names),
            media_id
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn reconnect_folder(
    app: &AppHandle,
    folder_id: &str,
    new_folder_path: &Path,
) -> Result<(), String> {
    if !new_folder_path.is_dir() {
        return Err("Choose the moved folder.".into());
    }

    let mut conn = connect(app)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let old_path: String = tx
        .query_row(
            "select path from folders where id = ?1",
            params![folder_id],
            |row| row.get(0),
        )
        .map_err(|_| "That folder is not in Koi anymore.".to_string())?;
    let new_path = new_folder_path.to_string_lossy().to_string();
    let new_name = new_folder_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    tx.execute(
        "update folders set name = ?1, path = ?2 where id = ?3",
        params![new_name, new_path, folder_id],
    )
    .map_err(|error| error.to_string())?;

    let mut stmt = tx
        .prepare("select id, path from media where folder_id = ?1")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![folder_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(stmt);

    for (media_id, media_path) in rows {
        let relative = Path::new(&media_path)
            .strip_prefix(Path::new(&old_path))
            .ok();
        if let Some(relative) = relative {
            let repaired = new_folder_path.join(relative).to_string_lossy().to_string();
            tx.execute(
                "update media set path = ?1 where id = ?2",
                params![repaired, media_id],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn folder_by_id(app: &AppHandle, folder_id: &str) -> Result<Option<Folder>, String> {
    let conn = connect(app)?;
    conn.query_row(
        "select id, name, path, added_at from folders where id = ?1",
        params![folder_id],
        |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                added_at: row.get(3)?,
            })
        },
    )
    .map(Some)
    .or_else(|error| {
        if matches!(error, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(error.to_string())
        }
    })
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
    add_column(
        conn,
        "media",
        "dominant_colors",
        "text not null default '[]'",
    )?;
    add_column(conn, "media", "color_names", "text not null default '[]'")?;
    add_column(conn, "media", "capture_type", "text")?;
    add_column(conn, "media", "source_url", "text")?;
    add_column(conn, "media", "source_page_url", "text")?;
    add_column(conn, "media", "source_title", "text")?;
    add_column(conn, "media", "source_site_name", "text")?;
    add_column(conn, "media", "captured_at", "text")?;
    Ok(())
}

fn add_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
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

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_items(conn: &Connection) -> Result<Vec<MediaItem>, String> {
    let mut stmt = conn
        .prepare(
            "select id, folder_id, path, name, extension, kind, width, height, created_at, modified_at, tags, dominant_colors, color_names,
             capture_type, source_url, source_page_url, source_title, source_site_name, captured_at
            from media
            order by coalesce(modified_at, created_at, 0) desc, name asc",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let tags: String = row.get(10)?;
            let dominant_colors: String = row.get(11)?;
            let color_names: String = row.get(12)?;
            let path: String = row.get(2)?;
            Ok(MediaItem {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                path: path.clone(),
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
                missing: !Path::new(&path).is_file(),
                capture_type: row.get(13)?,
                source_url: row.get(14)?,
                source_page_url: row.get(15)?,
                source_title: row.get(16)?,
                source_site_name: row.get(17)?,
                captured_at: row.get(18)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

struct ExistingMedia {
    id: String,
    path: String,
    name: String,
    tags: String,
    dominant_colors: String,
    color_names: String,
}

fn upsert_media(
    tx: &rusqlite::Transaction<'_>,
    item: &MediaItem,
    tags: String,
    dominant_colors: String,
    color_names: String,
) -> Result<(), String> {
    tx.execute(
        "insert into media
        (id, folder_id, path, name, extension, kind, width, height, created_at, modified_at, tags, dominant_colors, color_names,
         capture_type, source_url, source_page_url, source_title, source_site_name, captured_at)
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
        on conflict do update set
          id = excluded.id,
          folder_id = excluded.folder_id,
          path = excluded.path,
          name = excluded.name,
          extension = excluded.extension,
          kind = excluded.kind,
          width = excluded.width,
          height = excluded.height,
          created_at = excluded.created_at,
          modified_at = excluded.modified_at,
          capture_type = excluded.capture_type,
          source_url = excluded.source_url,
          source_page_url = excluded.source_page_url,
          source_title = excluded.source_title,
          source_site_name = excluded.source_site_name,
          captured_at = excluded.captured_at",
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
            color_names,
            item.capture_type,
            item.source_url,
            item.source_page_url,
            item.source_title,
            item.source_site_name,
            item.captured_at
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn serialize_tags(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn deserialize_tags(tags: &str) -> Vec<String> {
    serde_json::from_str(tags).unwrap_or_default()
}
