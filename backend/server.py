import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from tools.pixel_array_to_jpg import pixel_array_to_jpg
from tools.pixel_array_to_raster import pixel_array_to_raster
from tools.pixel_array_to_svg import pixel_array_to_svg

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


@app.get("/")
def home():
    return {"message": "There is nothing here"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


@app.post("/api/projects/share")
def share_project(request: ShareProjectRequest):
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
                connection.execute(
                    "INSERT INTO shared_projects (project_id, project_json) VALUES (?, ?)",
                    (project_id, project_json),
                )
        finally:
            connection.close()
    except (OSError, sqlite3.Error) as error:
        raise HTTPException(status_code=500, detail="Unable to save the shared project.") from error

    return {"projectId": project_id}


@app.get("/api/projects/shared")
def get_shared_projects(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    if not SHARED_PROJECTS_DB.is_file():
        return {"projects": [], "hasMore": False}

    try:
        connection = sqlite3.connect(f"{SHARED_PROJECTS_DB.as_uri()}?mode=ro", uri=True)
        try:
            table_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_projects'"
            ).fetchone()
            rows = (
                connection.execute(
                    """
                    SELECT project_json, created_at
                    FROM shared_projects
                    ORDER BY created_at DESC, project_id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (limit + 1, offset),
                ).fetchall()
                if table_exists
                else []
            )
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


@app.post("/api/export")
def export_canvas(request: ExportRequest):
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
