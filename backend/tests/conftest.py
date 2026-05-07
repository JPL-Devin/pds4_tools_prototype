"""Shared test fixtures for backend tests."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import clear_labels
from app.main import app

TEST_DATA_DIR = Path(__file__).parent.parent.parent / "test_data"
TABLE_CHARACTER_XML = TEST_DATA_DIR / "table_character" / "Table_Character_Example.xml"
TABLE_CHARACTER_TAB = TEST_DATA_DIR / "table_character" / "Table_Character_Example.tab"


@pytest.fixture
def client():
    clear_labels()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def table_character_xml() -> Path:
    return TABLE_CHARACTER_XML


@pytest.fixture
def table_character_tab() -> Path:
    return TABLE_CHARACTER_TAB
