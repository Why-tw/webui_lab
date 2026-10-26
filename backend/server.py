from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator

app = FastAPI()


@app.get("/")
def home():
    return {"message": "There is nothing here"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


@app.post("/api/export")
def export_canvas(pixels: list[list[str | None]]):
    return {
        "received": True,
        "width": len(pixels[0]) if pixels else 0,
        "height": len(pixels),
    }
