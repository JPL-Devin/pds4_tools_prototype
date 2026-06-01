"""Tests for the file browsing API."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import (
    LocalFilesystemBackend,
    register_backend,
)


@pytest.fixture(autouse=True)
def setup_local_backend(tmp_path: Path) -> Path:
    """Create a temp directory with test files and register it as 'local' backend."""
    # Create directory structure
    data_dir = tmp_path / "test_data"
    data_dir.mkdir()
    (data_dir / "subdir").mkdir()
    (data_dir / "label.xml").write_text("<Product_Observational/>")
    (data_dir / "data.img").write_bytes(b"\x00" * 100)
    (data_dir / ".hidden").write_text("hidden file")

    register_backend("local", LocalFilesystemBackend(root_path=str(data_dir)))
    return data_dir


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestBrowseSources:
    def test_list_sources(self, client: TestClient) -> None:
        resp = client.get("/api/browse/sources")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        names = [s["name"] for s in data]
        assert "local" in names

    def test_each_source_has_root(self, client: TestClient) -> None:
        resp = client.get("/api/browse/sources")
        for source in resp.json():
            assert "root" in source
            assert "name" in source


class TestBrowseList:
    def test_list_root(self, client: TestClient, tmp_path: Path) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        assert resp.status_code == 200
        data = resp.json()
        names = [e["name"] for e in data["entries"]]
        assert "label.xml" in names
        assert "subdir" in names
        assert "data.img" in names

    def test_hidden_files_excluded(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        names = [e["name"] for e in resp.json()["entries"]]
        assert ".hidden" not in names

    def test_label_files_marked(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        entries = resp.json()["entries"]
        label_entry = next(e for e in entries if e["name"] == "label.xml")
        data_entry = next(e for e in entries if e["name"] == "data.img")
        assert label_entry["is_label"] is True
        assert data_entry["is_label"] is False

    def test_directories_marked(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        entries = resp.json()["entries"]
        subdir_entry = next(e for e in entries if e["name"] == "subdir")
        assert subdir_entry["is_dir"] is True

    def test_has_parent_path(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        data = resp.json()
        assert data["parent_path"] is not None

    def test_browse_subdirectory(self, client: TestClient, tmp_path: Path) -> None:
        subdir_path = str(tmp_path / "test_data" / "subdir")
        resp = client.get("/api/browse/list", params={"source": "local", "path": subdir_path})
        assert resp.status_code == 200
        assert resp.json()["entries"] == []

    def test_invalid_source(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "nonexistent"})
        assert resp.status_code == 404

    def test_invalid_path(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local", "path": "/nonexistent/path"})
        assert resp.status_code == 404

    def test_directories_sorted_first(self, client: TestClient) -> None:
        resp = client.get("/api/browse/list", params={"source": "local"})
        entries = resp.json()["entries"]
        # Directories should come before files
        dir_indices = [i for i, e in enumerate(entries) if e["is_dir"]]
        file_indices = [i for i, e in enumerate(entries) if not e["is_dir"]]
        if dir_indices and file_indices:
            assert max(dir_indices) < min(file_indices)


class TestBrowseOpen:
    def test_open_label(self, client: TestClient, tmp_path: Path) -> None:
        # Create a proper PDS4 label
        label_content = """<?xml version="1.0" encoding="UTF-8"?>
<Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1">
  <Identification_Area>
    <logical_identifier>urn:nasa:pds:test:data::1.0</logical_identifier>
    <version_id>1.0</version_id>
    <title>Test Product</title>
    <information_model_version>1.22.0.0</information_model_version>
    <product_class>Product_Observational</product_class>
  </Identification_Area>
  <Observation_Area>
    <Time_Coordinates><start_date_time>2024-01-01T00:00:00Z</start_date_time></Time_Coordinates>
    <Investigation_Area><name>Test</name><type>Mission</type></Investigation_Area>
    <Observing_System><Observing_System_Component><name>Test</name><type>Instrument</type></Observing_System_Component></Observing_System>
    <Target_Identification><name>Mars</name><type>Planet</type></Target_Identification>
  </Observation_Area>
</Product_Observational>"""
        data_dir = tmp_path / "test_data"
        (data_dir / "test_label.xml").write_text(label_content)

        label_path = str(data_dir / "test_label.xml")
        resp = client.post("/api/browse/open", params={"source": "local", "path": label_path})
        assert resp.status_code == 200
        data = resp.json()
        assert "label_id" in data
        assert data["filename"] == "test_label.xml"

    def test_open_nonexistent_label(self, client: TestClient) -> None:
        resp = client.post("/api/browse/open", params={"source": "local", "path": "/nonexistent/label.xml"})
        assert resp.status_code == 404

    def test_open_invalid_source(self, client: TestClient) -> None:
        resp = client.post("/api/browse/open", params={"source": "nonexistent", "path": "/some/path.xml"})
        assert resp.status_code == 404


class TestLocalFilesystemBackend:
    def test_root_property(self, tmp_path: Path) -> None:
        backend = LocalFilesystemBackend(root_path=str(tmp_path))
        assert backend.root == str(tmp_path)

    def test_file_exists(self, tmp_path: Path) -> None:
        (tmp_path / "exists.txt").write_text("hello")
        backend = LocalFilesystemBackend(root_path=str(tmp_path))
        assert backend.file_exists(str(tmp_path / "exists.txt")) is True
        assert backend.file_exists(str(tmp_path / "nope.txt")) is False

    def test_read_file(self, tmp_path: Path) -> None:
        (tmp_path / "data.bin").write_bytes(b"\x01\x02\x03")
        backend = LocalFilesystemBackend(root_path=str(tmp_path))
        assert backend.read_file(str(tmp_path / "data.bin")) == b"\x01\x02\x03"

    def test_get_parent(self) -> None:
        backend = LocalFilesystemBackend()
        assert backend.get_parent("/home/user/data") == "/home/user"
        assert backend.get_parent("/") is None
