import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from tools.pixel_array_to_jpg import pixel_array_to_jpg
from tools.pixel_array_to_raster import pixel_array_to_raster
from tools.pixel_array_to_svg import pixel_array_to_svg

from logging_system import log_err, log_warn, log_info, log_debug

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
    author_name: str = Field(alias="authorName", min_length=1, max_length=120)
    layers: list[SharedLayer] = Field(min_length=1)

    @field_validator("file_name", "author_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class ExportRequest(BaseModel):
    format: Literal["SVG", "PNG", "BMP", "JPG"]
    pixels: list[list[str | None]]


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
            ):
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


@app.post("/api/projects/share")
@log_info('user sharing project')
def share_project(request: ShareProjectRequest, http_request: Request):
    project_id = str(uuid4())
    project_data = {
        "fileName": request.file_name,
        "canvasSize": request.canvas_size.model_dump(),
        "displayProfile": request.display_profile,
        "authorName": request.author_name,
        "layers": [layer.model_dump() for layer in request.layers],
        "projectId": project_id,
    }
    project_json = json.dumps(project_data, ensure_ascii=False)

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
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
                connection.execute(
                    "INSERT INTO shared_projects (project_id, project_json) VALUES (?, ?)",
                    (project_id, project_json),
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
):
    if not SHARED_PROJECTS_DB.is_file():
        return {"projects": [], "hasMore": False}

    try:
        query = (q or "").strip()
        with sqlite3.connect(SHARED_PROJECTS_DB) as index_connection:
            ensure_shared_project_search_index(index_connection)
        connection = sqlite3.connect(f"{SHARED_PROJECTS_DB.as_uri()}?mode=ro", uri=True)
        try:
            table_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
            ).fetchone()
            if not table_exists:
                rows = []
            elif query and len(query) >= 3:
                match_query = fts_phrase(query)
                rows = connection.execute(
                    """
                    SELECT project_json, created_at
                    FROM shared_projects
                    JOIN shared_projects_fts USING (project_id)
                    WHERE shared_projects_fts MATCH ?
                    ORDER BY created_at DESC, shared_projects.project_id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (match_query, limit + 1, offset),
                ).fetchall()
            elif query:
                pattern = f"%{escape_like_query(query)}%"
                rows = connection.execute(
                    """
                    SELECT project_json, created_at
                    FROM shared_projects
                    JOIN shared_projects_fts USING (project_id)
                    WHERE file_name LIKE ? ESCAPE '\\'
                       OR author_name LIKE ? ESCAPE '\\'
                    ORDER BY created_at DESC, shared_projects.project_id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (pattern, pattern, limit + 1, offset),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT project_json, created_at
                    FROM shared_projects
                    ORDER BY created_at DESC, project_id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (limit + 1, offset),
                ).fetchall()
        finally:
            connection.close()

        has_more = len(rows) > limit
        rows = rows[:limit]
        projects = []
        for project_json, created_at in rows:
            project = json.loads(project_json)
            if not isinstance(project, dict):
                raise ValueError("Shared project data must be a JSON object.")
            project.setdefault("layers", [])
            projects.append({**project, "createdAt": created_at})
    except (OSError, sqlite3.Error, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Unable to load shared projects.") from error

    return {"projects": projects, "hasMore": has_more}


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
