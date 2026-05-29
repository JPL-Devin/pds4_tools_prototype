"""Tests for image/array data endpoints."""
from __future__ import annotations


def _upload_label(client, xml_path, data_path):
    """Helper to upload a label and return the label_id."""
    with open(xml_path, "rb") as lf, open(data_path, "rb") as df:
        resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (xml_path.name, lf, "application/xml"),
                "data_file": (data_path.name, df, "application/octet-stream"),
            },
        )
    assert resp.status_code == 200
    return resp.json()["label_id"]


def test_get_image_metadata(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = None
    for s in structures:
        if "Array" in s["structure_type"]:
            image_idx = s["index"]
            break

    assert image_idx is not None, "No array structure found"

    resp = client.get(f"/api/images/{label_id}/{image_idx}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["structure_type"] == "Array_2D_Image"
    assert body["width"] == 720
    assert body["height"] == 360


def test_get_image_statistics(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = next(s["index"] for s in structures if "Array" in s["structure_type"])

    resp = client.get(f"/api/images/{label_id}/{image_idx}/statistics")
    assert resp.status_code == 200
    body = resp.json()
    assert "min" in body
    assert "max" in body
    assert "mean" in body
    assert "percentiles" in body
    assert body["min"] >= 0
    assert body["max"] <= 255


def test_render_image_default(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = next(s["index"] for s in structures if "Array" in s["structure_type"])

    resp = client.post(
        f"/api/images/{label_id}/{image_idx}/render",
        json={"colormap": "grayscale", "stretch": "linear"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:4] == b"\x89PNG"


def test_render_image_viridis(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = next(s["index"] for s in structures if "Array" in s["structure_type"])

    resp = client.post(
        f"/api/images/{label_id}/{image_idx}/render",
        json={"colormap": "viridis", "stretch": "sqrt"},
    )
    assert resp.status_code == 200
    assert resp.content[:4] == b"\x89PNG"


def test_render_image_histeq(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = next(s["index"] for s in structures if "Array" in s["structure_type"])

    resp = client.post(
        f"/api/images/{label_id}/{image_idx}/render",
        json={"colormap": "plasma", "stretch": "histeq", "percentile_low": 2, "percentile_high": 98},
    )
    assert resp.status_code == 200
    assert resp.content[:4] == b"\x89PNG"


def test_pixel_value(client, array_2d_image_xml, array_2d_image_data):
    label_id = _upload_label(client, array_2d_image_xml, array_2d_image_data)

    structures = client.get(f"/api/labels/{label_id}/structures").json()
    image_idx = next(s["index"] for s in structures if "Array" in s["structure_type"])

    resp = client.get(f"/api/images/{label_id}/{image_idx}/pixel?x=0&y=0")
    assert resp.status_code == 200
    body = resp.json()
    assert "value" in body
    assert body["x"] == 0
    assert body["y"] == 0


def test_image_not_a_table(client, table_character_xml, table_character_tab):
    """Requesting image metadata for a table structure should fail."""
    with open(table_character_xml, "rb") as lf, open(table_character_tab, "rb") as df:
        upload_resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (table_character_xml.name, lf, "application/xml"),
                "data_file": (table_character_tab.name, df, "application/octet-stream"),
            },
        )
    label_id = upload_resp.json()["label_id"]
    resp = client.get(f"/api/images/{label_id}/0")
    assert resp.status_code == 400
