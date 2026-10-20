from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator

app = FastAPI()


@app.get("/")
def home():
    return {"message": "There is nothing here"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}
