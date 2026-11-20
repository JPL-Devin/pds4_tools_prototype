"""Shared dependencies for API routes."""
from __future__ import annotations

import uuid
from typing import Any

_label_store: dict[str, dict[str, Any]] = {}


def store_label(parsed_label: dict[str, Any]) -> str:
    """Store a parsed label and return its ID."""
    label_id = str(uuid.uuid4())[:8]
    _label_store[label_id] = parsed_label
    return label_id


def get_label(label_id: str) -> dict[str, Any] | None:
    """Retrieve a stored label by ID."""
    return _label_store.get(label_id)


def list_labels() -> list[dict[str, str]]:
    """List all stored labels."""
    return [
        {"label_id": lid, "filename": data["filename"]}
        for lid, data in _label_store.items()
    ]


def clear_labels() -> None:
    """Clear all stored labels."""
    _label_store.clear()
