import json
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from tools.pixel_array_to_jpg import pixel_array_to_jpg
from tools.pixel_array_to_raster import pixel_array_to_raster
from tools.pixel_array_to_svg import pixel_array_to_svg

from logging_system import log_info

app = FastAPI()
SHARED_PROJECTS_DB = Path(__file__).resolve().parent / "db" / "shared-projects.sqlite3"


class CanvasSize(BaseModel):
    width: int = Field(ge=1, le=4096)
    height: int = Field(ge=1, le=4096)


class SharedLayer(BaseModel):
    id: str
    name: str
    visible: bool
    pixels: list[list[str | None]]


class ShareProjectRequest(BaseModel):
    file_name: str = Field(alias="fileName", min_length=1, max_length=255)
    canvas_size: CanvasSize = Field(alias="canvasSize")
    display_profile: Literal["custom", "ssd1306", "ssd1327"] = Field(alias="displayProfile")
    project_type: Literal["pixelArt", "icons", "devices"] = Field(
        default="pixelArt", alias="projectType"
    )
    author_name: str = Field(alias="authorName", min_length=1, max_length=120)
    layers: list[SharedLayer] = Field(min_length=1)

    @field_validator("file_name", "author_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class SetProjectStarRequest(BaseModel):
    voter_id: str = Field(alias="voterId", min_length=1, max_length=64)
    starred: bool


class ExportRequest(BaseModel):
    format: Literal["SVG", "PNG", "BMP", "JPG"]
    pixels: list[list[str | None]]


def create_project_preview(
    canvas_size: CanvasSize,
    layers: list[SharedLayer],
    max_dimension: int = 512,
) -> bytes:
    width = canvas_size.width
    height = canvas_size.height
    scale = max(
        1,
        (width + max_dimension - 1) // max_dimension,
        (height + max_dimension - 1) // max_dimension,
    )
    preview_width = max(1, (width + scale - 1) // scale)
    preview_height = max(1, (height + scale - 1) // scale)
    preview_pixels: list[list[str | None]] = [
        [None] * preview_width for _ in range(preview_height)
    ]
    source_x = [min(width - 1, x * width // preview_width) for x in range(preview_width)]
    source_y = [min(height - 1, y * height // preview_height) for y in range(preview_height)]

    for layer in layers:
        if not layer.visible:
            continue
        if len(layer.pixels) != height or any(len(row) != width for row in layer.pixels):
            raise ValueError("Layer pixels must match the canvas dimensions.")
        for preview_row, y in enumerate(source_y):
            pixels = layer.pixels[y]
            for preview_column, x in enumerate(source_x):
                color = pixels[x]
                if color is not None:
                    preview_pixels[preview_row][preview_column] = color

    return pixel_array_to_raster(preview_pixels, "PNG")


def ensure_shared_project_search_index(connection: sqlite3.Connection) -> None:
    has_projects = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
    ).fetchone()
    if not has_projects:
        return

    has_index = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects_fts'"
    ).fetchone()
    if has_index:
        return

    connection.execute("BEGIN IMMEDIATE")
    try:
        has_index = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects_fts'"
        ).fetchone()
        if not has_index:
            connection.execute(
                """
                CREATE VIRTUAL TABLE shared_projects_fts USING fts5(
                    project_id UNINDEXED,
                    file_name,
                    author_name,
                    tokenize = 'trigram'
                )
                """
            )
            for project_id, project_json in connection.execute(
                "SELECT project_id, project_json FROM shared_projects"
            ).fetchall():
                project = json.loads(project_json)
                if not isinstance(project, dict):
                    raise ValueError("Shared project data must be a JSON object.")
                connection.execute(
                    """
                    INSERT INTO shared_projects_fts (project_id, file_name, author_name)
                    VALUES (?, ?, ?)
                    """,
                    (
                        project_id,
                        str(project.get("fileName", "")),
                        str(project.get("authorName", "")),
                    ),
                )
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def ensure_shared_project_star_fields(connection: sqlite3.Connection) -> None:
    project_table_exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
    ).fetchone()
    if not project_table_exists:
        return

    connection.execute("BEGIN IMMEDIATE")
    try:
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(shared_projects)")
        }
        if "star_voters_json" not in columns:
            connection.execute(
                "ALTER TABLE shared_projects ADD COLUMN star_voters_json TEXT NOT NULL DEFAULT '[]'"
            )
        if "star_count" not in columns:
            connection.execute(
                "ALTER TABLE shared_projects ADD COLUMN star_count INTEGER NOT NULL DEFAULT 0"
            )

        legacy_table_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_project_stars'"
        ).fetchone()
        if legacy_table_exists:
            legacy_stars: dict[str, list[str]] = {}
            for project_id, voter_id in connection.execute(
                "SELECT project_id, voter_id FROM shared_project_stars ORDER BY rowid"
            ):
                legacy_stars.setdefault(project_id, []).append(voter_id)

            for project_id, legacy_voters in legacy_stars.items():
                row = connection.execute(
                    "SELECT star_voters_json FROM shared_projects WHERE project_id = ?",
                    (project_id,),
                ).fetchone()
                if not row:
                    continue
                current_voters = json.loads(row[0])
                if not isinstance(current_voters, list) or not all(
                    isinstance(voter_id, str) for voter_id in current_voters
                ):
                    raise ValueError("Stored project star voters must be a JSON string list.")
                voters = list(dict.fromkeys([*current_voters, *legacy_voters]))
                connection.execute(
                    """
                    UPDATE shared_projects
                    SET star_voters_json = ?, star_count = ?
                    WHERE project_id = ?
                    """,
                    (json.dumps(voters), len(voters), project_id),
                )

            connection.execute("DROP TABLE shared_project_stars")

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_shared_projects_star_count
            ON shared_projects (star_count DESC, created_at DESC, project_id DESC)
            """
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def ensure_shared_project_type_fields(connection: sqlite3.Connection) -> None:
    project_table_exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
    ).fetchone()
    if not project_table_exists:
        return

    connection.execute("BEGIN IMMEDIATE")
    try:
        if connection.execute("PRAGMA user_version").fetchone()[0] < 1:
            connection.execute(
                """
                UPDATE shared_projects
                SET project_json = json_set(project_json, '$.projectType', 'pixelArt')
                WHERE json_type(project_json, '$.projectType') IS NULL
                   OR COALESCE(json_extract(project_json, '$.projectType'), '')
                      NOT IN ('pixelArt', 'icons', 'devices')
                """
            )
            connection.execute("PRAGMA user_version = 1")
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def ensure_shared_project_preview_column(connection: sqlite3.Connection) -> None:
    project_table_exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
    ).fetchone()
    if not project_table_exists:
        return

    columns = {
        row[1] for row in connection.execute("PRAGMA table_info(shared_projects)")
    }
    if "preview_png" in columns:
        return

    connection.execute("BEGIN IMMEDIATE")
    try:
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(shared_projects)")
        }
        if "preview_png" not in columns:
            connection.execute("ALTER TABLE shared_projects ADD COLUMN preview_png BLOB")
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def create_preview_from_project_data(project_json: str) -> bytes:
    project = json.loads(project_json)
    if not isinstance(project, dict):
        raise ValueError("Shared project data must be a JSON object.")
    canvas_size = CanvasSize.model_validate(project["canvasSize"])
    layers = [
        SharedLayer.model_validate(layer)
        for layer in project.get("layers", [])
    ]
    return create_project_preview(canvas_size, layers)


def escape_like_query(query: str) -> str:
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def fts_phrase(query: str) -> str:
    return '"' + query.replace('"', '""') + '"'


@app.get("/")
def home():
    return {"message": "There is nothing here"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}

@app.get("/admin")
def admin():
    pass


@app.post("/api/projects/share")
@log_info('user sharing project')
def share_project(request: ShareProjectRequest, http_request: Request):
    project_id = str(uuid4())
    project_data = {
        "fileName": request.file_name,
        "canvasSize": request.canvas_size.model_dump(),
        "displayProfile": request.display_profile,
        "projectType": request.project_type,
        "authorName": request.author_name,
        "layers": [layer.model_dump() for layer in request.layers],
        "projectId": project_id,
    }
    project_json = json.dumps(project_data, ensure_ascii=False)
    try:
        preview_png = create_project_preview(request.canvas_size, request.layers)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        SHARED_PROJECTS_DB.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(SHARED_PROJECTS_DB)
        try:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS shared_projects (
                        project_id TEXT PRIMARY KEY,
                        project_json TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        star_voters_json TEXT NOT NULL DEFAULT '[]',
                        star_count INTEGER NOT NULL DEFAULT 0,
                        preview_png BLOB
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_shared_projects_created_at
                    ON shared_projects (created_at DESC, project_id DESC)
                    """
                )
                ensure_shared_project_search_index(connection)
                ensure_shared_project_star_fields(connection)
                ensure_shared_project_type_fields(connection)
                ensure_shared_project_preview_column(connection)
                connection.execute(
                    """
                    INSERT INTO shared_projects (project_id, project_json, preview_png)
                    VALUES (?, ?, ?)
                    """,
                    (project_id, project_json, preview_png),
                )
                connection.execute(
                    """
                    INSERT INTO shared_projects_fts (project_id, file_name, author_name)
                    VALUES (?, ?, ?)
                    """,
                    (project_id, request.file_name, request.author_name),
                )
        finally:
            connection.close()
    except (OSError, sqlite3.Error, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to save the shared project.") from error

    return {"projectId": project_id}


@app.get("/api/projects/shared")
@log_info("get shared data")
def get_shared_projects(
    http_request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=100),
    sort: Literal["newest", "stars"] = Query(default="newest"),
    project_type: list[Literal["pixelArt", "icons", "devices"]] | None = Query(
        default=None, alias="projectType"
    ),
    display_profile: Literal["custom", "ssd1306", "ssd1327"] | None = Query(
        default=None, alias="displayProfile"
    ),
    voter_id: str | None = Query(default=None, alias="voterId", min_length=1, max_length=64),
):
    if not SHARED_PROJECTS_DB.is_file():
        return {"projects": [], "hasMore": False}

    try:
        query = (q or "").strip()
        with closing(sqlite3.connect(SHARED_PROJECTS_DB)) as index_connection:
            ensure_shared_project_search_index(index_connection)
            ensure_shared_project_star_fields(index_connection)
            ensure_shared_project_type_fields(index_connection)
            ensure_shared_project_preview_column(index_connection)
        connection = sqlite3.connect(f"{SHARED_PROJECTS_DB.as_uri()}?mode=ro", uri=True)
        try:
            table_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
            ).fetchone()
            where_conditions: list[str] = []
            query_parameters: list[str] = []
            from_clause = "FROM shared_projects"
            if query:
                from_clause += "\nJOIN shared_projects_fts USING (project_id)"
                if len(query) >= 3:
                    where_conditions.append("shared_projects_fts MATCH ?")
                    query_parameters.append(fts_phrase(query))
                else:
                    pattern = f"%{escape_like_query(query)}%"
                    where_conditions.append(
                        "(file_name LIKE ? ESCAPE '\\' OR author_name LIKE ? ESCAPE '\\')"
                    )
                    query_parameters.extend((pattern, pattern))
            if project_type:
                placeholders = ", ".join("?" for _ in project_type)
                where_conditions.append(
                    "COALESCE(json_extract(shared_projects.project_json, '$.projectType'), 'pixelArt') "
                    f"IN ({placeholders})"
                )
                query_parameters.extend(project_type)
            if display_profile:
                where_conditions.append(
                    "json_extract(shared_projects.project_json, '$.displayProfile') = ?"
                )
                query_parameters.append(display_profile)
            where_clause = f"WHERE {' AND '.join(where_conditions)}" if where_conditions else ""
            order_clause = (
                "star_count DESC, shared_projects.created_at DESC, shared_projects.project_id DESC"
                if sort == "stars"
                else "shared_projects.created_at DESC, shared_projects.project_id DESC"
            )
            if not table_exists:
                rows = []
            else:
                rows = connection.execute(
                    f"""
                    SELECT
                        shared_projects.project_json,
                        shared_projects.project_id,
                        shared_projects.created_at,
                        shared_projects.star_count,
                        shared_projects.star_voters_json
                    {from_clause}
                    {where_clause}
                    ORDER BY {order_clause}
                    LIMIT ? OFFSET ?
                    """,
                    (*query_parameters, limit + 1, offset),
                ).fetchall()
        finally:
            connection.close()

        has_more = len(rows) > limit
        rows = rows[:limit]
        projects = []
        for project_json, project_id, created_at, star_count, star_voters_json in rows:
            project = json.loads(project_json)
            if not isinstance(project, dict):
                raise ValueError("Shared project data must be a JSON object.")
            star_voters = json.loads(star_voters_json)
            if not isinstance(star_voters, list) or not all(
                isinstance(star_voter_id, str) for star_voter_id in star_voters
            ):
                raise ValueError("Stored project star voters must be a JSON string list.")
            if project.get("projectType") not in ("pixelArt", "icons", "devices"):
                project["projectType"] = "pixelArt"
            project.pop("layers", None)
            project["previewUrl"] = f"/api/projects/shared/{project_id}/preview"
            project["projectId"] = project_id
            projects.append({
                **project,
                "createdAt": created_at,
                "starCount": star_count,
                "starredByViewer": voter_id in star_voters if voter_id else False,
            })
    except (OSError, sqlite3.Error, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to load shared projects.") from error

    return {"projects": projects, "hasMore": has_more}


@app.get("/api/projects/shared/{project_id}/preview")
def get_shared_project_preview(project_id: str):
    if not SHARED_PROJECTS_DB.is_file():
        raise HTTPException(status_code=404, detail="Shared project not found.")

    try:
        with closing(sqlite3.connect(SHARED_PROJECTS_DB)) as connection:
            table_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
            ).fetchone()
            if not table_exists:
                raise HTTPException(status_code=404, detail="Shared project not found.")
            ensure_shared_project_preview_column(connection)
            row = connection.execute(
                "SELECT project_json, preview_png FROM shared_projects WHERE project_id = ?",
                (project_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Shared project not found.")

            project_json, preview_png = row
            if preview_png is None:
                preview_png = create_preview_from_project_data(project_json)
                with connection:
                    connection.execute(
                        "UPDATE shared_projects SET preview_png = ? WHERE project_id = ?",
                        (preview_png, project_id),
                    )
    except (OSError, sqlite3.Error, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to load project preview.") from error

    return Response(
        content=preview_png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.put("/api/projects/shared/{project_id}/star")
def set_shared_project_star(project_id: str, request: SetProjectStarRequest):
    if not SHARED_PROJECTS_DB.is_file():
        raise HTTPException(status_code=404, detail="Shared project not found.")

    try:
        with sqlite3.connect(SHARED_PROJECTS_DB) as connection:
            project_table_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
            ).fetchone()
            if not project_table_exists:
                raise HTTPException(status_code=404, detail="Shared project not found.")
            ensure_shared_project_star_fields(connection)
            connection.execute("BEGIN IMMEDIATE")
            project = connection.execute(
                "SELECT star_voters_json FROM shared_projects WHERE project_id = ?",
                (project_id,),
            ).fetchone()
            if not project:
                raise HTTPException(status_code=404, detail="Shared project not found.")
            voters = json.loads(project[0])
            if not isinstance(voters, list) or not all(isinstance(voter_id, str) for voter_id in voters):
                raise ValueError("Stored project star voters must be a JSON string list.")
            if request.starred:
                if request.voter_id not in voters:
                    voters.append(request.voter_id)
            else:
                voters = [voter_id for voter_id in voters if voter_id != request.voter_id]
            star_count = len(voters)
            starred_by_viewer = request.voter_id in voters
            connection.execute(
                """
                UPDATE shared_projects
                SET star_voters_json = ?, star_count = ?
                WHERE project_id = ?
                """,
                (json.dumps(voters), star_count, project_id),
            )
    except (sqlite3.Error, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to update project star.") from error

    return {"starCount": star_count, "starredByViewer": starred_by_viewer}


@app.get("/api/projects/shared/suggestions")
@log_info("search shared project suggestions")
def get_shared_project_suggestions(
    http_request: Request,
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=8, ge=1, le=10),
):
    query = q.strip()
    if not query or not SHARED_PROJECTS_DB.is_file():
        return {"suggestions": []}

    try:
        with sqlite3.connect(SHARED_PROJECTS_DB) as index_connection:
            ensure_shared_project_search_index(index_connection)
        connection = sqlite3.connect(f"{SHARED_PROJECTS_DB.as_uri()}?mode=ro", uri=True)
        try:
            if len(query) >= 3:
                match_query = fts_phrase(query)
                rows = connection.execute(
                    """
                    SELECT file_name, author_name
                    FROM shared_projects_fts
                    WHERE shared_projects_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (match_query, limit * 2),
                ).fetchall()
            else:
                pattern = f"%{escape_like_query(query)}%"
                rows = connection.execute(
                    """
                    SELECT file_name, author_name
                    FROM shared_projects_fts
                    WHERE file_name LIKE ? ESCAPE '\\'
                       OR author_name LIKE ? ESCAPE '\\'
                    LIMIT ?
                    """,
                    (pattern, pattern, limit * 2),
                ).fetchall()
        finally:
            connection.close()

        suggestions: list[str] = []
        seen: set[str] = set()
        for file_name, author_name in rows:
            for value in (file_name, author_name):
                if query.casefold() in value.casefold() and value not in seen:
                    suggestions.append(value)
                    seen.add(value)
                    if len(suggestions) == limit:
                        break
            if len(suggestions) == limit:
                break
    except (OSError, sqlite3.Error, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to load project suggestions.") from error

    return {"suggestions": suggestions}


@app.post("/api/export")
@log_info("export canvas")
def export_canvas(request: ExportRequest, http_request: Request):
    try:
        if request.format == "SVG":
            content = pixel_array_to_svg(request.pixels)
            media_type = "image/svg+xml"
        elif request.format == "JPG":
            content = pixel_array_to_jpg(request.pixels)
            media_type = "image/jpeg"
        else:
            content = pixel_array_to_raster(request.pixels, request.format)
            media_type = f"image/{request.format.lower()}"
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="pixel-art.{request.format.lower()}"'},
    )
