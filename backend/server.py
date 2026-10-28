from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from typing import Literal

from tools.pixel_array_to_svg import pixel_array_to_svg

app = FastAPI()


class ExportRequest(BaseModel):
    format: Literal["SVG", "PNG", "BMP"]
    pixels: list[list[str | None]]


@app.get("/")
def home():
    return {"message": "There is nothing here"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


@app.post("/api/export")
def export_canvas(request: ExportRequest):
    if request.format != "SVG":
        raise HTTPException(status_code=501, detail="Only SVG export is supported")

    try:
        svg = pixel_array_to_svg(request.pixels)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Content-Disposition": 'attachment; filename="pixel-art.svg"'},
    )
