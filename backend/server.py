from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from typing import Literal

from tools.pixel_array_to_raster import pixel_array_to_raster
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
    try:
        if request.format == "SVG":
            content = pixel_array_to_svg(request.pixels)
            media_type = "image/svg+xml"
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
