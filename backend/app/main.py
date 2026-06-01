from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import browse, images, labels, tables
from app.services.storage import init_default_backends

app = FastAPI(
    title="PDS4 Viewer API",
    description="API for viewing and exploring NASA PDS4 data products",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(labels.router, prefix="/api/labels", tags=["labels"])
app.include_router(tables.router, prefix="/api/tables", tags=["tables"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(browse.router, prefix="/api/browse", tags=["browse"])

init_default_backends()


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
