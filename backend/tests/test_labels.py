"""Tests for label upload and metadata endpoints."""
from __future__ import annotations


def test_health_check(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_label_success(client, table_character_xml, table_character_tab):
    with open(table_character_xml, "rb") as lf, open(table_character_tab, "rb") as df:
        resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (table_character_xml.name, lf, "application/xml"),
                "data_files": (table_character_tab.name, df, "application/octet-stream"),
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "label_id" in body
    assert body["filename"] == "Table_Character_Example.xml"
    assert len(body["structures"]) >= 1
    assert body["structures"][0]["structure_type"] == "Table_Character"


def test_upload_label_invalid_extension(client):
    resp = client.post(
        "/api/labels/upload",
        files={"label_file": ("data.csv", b"not xml", "text/csv")},
    )
    assert resp.status_code == 400


def test_list_labels(client, table_character_xml, table_character_tab):
    with open(table_character_xml, "rb") as lf, open(table_character_tab, "rb") as df:
        client.post(
            "/api/labels/upload",
            files={
                "label_file": (table_character_xml.name, lf, "application/xml"),
                "data_files": (table_character_tab.name, df, "application/octet-stream"),
            },
        )
    resp = client.get("/api/labels")
    assert resp.status_code == 200
    labels = resp.json()
    assert len(labels) >= 1


def test_get_label_detail(client, table_character_xml, table_character_tab):
    with open(table_character_xml, "rb") as lf, open(table_character_tab, "rb") as df:
        upload_resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (table_character_xml.name, lf, "application/xml"),
                "data_files": (table_character_tab.name, df, "application/octet-stream"),
            },
        )
    label_id = upload_resp.json()["label_id"]

    resp = client.get(f"/api/labels/{label_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["label_id"] == label_id
    assert "xml_tree" in body


def test_get_structures(client, table_character_xml, table_character_tab):
    with open(table_character_xml, "rb") as lf, open(table_character_tab, "rb") as df:
        upload_resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (table_character_xml.name, lf, "application/xml"),
                "data_files": (table_character_tab.name, df, "application/octet-stream"),
            },
        )
    label_id = upload_resp.json()["label_id"]

    resp = client.get(f"/api/labels/{label_id}/structures")
    assert resp.status_code == 200
    structures = resp.json()
    assert len(structures) >= 1
    assert structures[0]["structure_type"] == "Table_Character"
    assert structures[0]["record_count"] is not None


def test_label_not_found(client):
    resp = client.get("/api/labels/nonexistent")
    assert resp.status_code == 404
