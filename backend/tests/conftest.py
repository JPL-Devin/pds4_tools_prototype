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
ARRAY_2D_IMAGE_XML = TEST_DATA_DIR / "array_2d_image" / "thermal_neutron_map.xml"
ARRAY_2D_IMAGE_DATA = TEST_DATA_DIR / "array_2d_image" / "thermal_neutron_map.img"
TABLE_DUP_COLS_XML = TEST_DATA_DIR / "table_character_dup_cols" / "ch3_cht_raw_20230824T12_625085705_v1.xml"
TABLE_DUP_COLS_CSV = TEST_DATA_DIR / "table_character_dup_cols" / "ch3_cht_raw_20230824T12_625085705_v1.csv"


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


@pytest.fixture
def array_2d_image_xml() -> Path:
    return ARRAY_2D_IMAGE_XML


@pytest.fixture
def array_2d_image_data() -> Path:
    return ARRAY_2D_IMAGE_DATA


@pytest.fixture
def table_dup_cols_xml() -> Path:
    return TABLE_DUP_COLS_XML


@pytest.fixture
def table_dup_cols_csv() -> Path:
    return TABLE_DUP_COLS_CSV
