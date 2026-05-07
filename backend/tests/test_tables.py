"""Tests for table data and plotting endpoints."""
from __future__ import annotations


def _upload_label(client, xml_path, tab_path):
    """Helper to upload a label and return the label_id."""
    with open(xml_path, "rb") as lf, open(tab_path, "rb") as df:
        resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (xml_path.name, lf, "application/xml"),
                "data_file": (tab_path.name, df, "application/octet-stream"),
            },
        )
    assert resp.status_code == 200
    return resp.json()["label_id"]


def test_get_table_metadata(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp = client.get(f"/api/tables/{label_id}/0")
    assert resp.status_code == 200
    body = resp.json()
    assert body["structure_type"] == "Table_Character"
    assert body["record_count"] > 0
    assert len(body["fields"]) > 0


def test_get_table_data(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp = client.get(f"/api/tables/{label_id}/0/data?offset=0&limit=10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_records"] > 0
    assert len(body["data"]) <= 10
    assert len(body["columns"]) > 0


def test_get_table_data_pagination(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp1 = client.get(f"/api/tables/{label_id}/0/data?offset=0&limit=5")
    resp2 = client.get(f"/api/tables/{label_id}/0/data?offset=5&limit=5")
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    data1 = resp1.json()["data"]
    data2 = resp2.json()["data"]
    if data1 and data2:
        assert data1[0] != data2[0]


def test_get_table_csv(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp = client.get(f"/api/tables/{label_id}/0/data?format=csv&limit=5")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")


def test_table_structure_not_found(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp = client.get(f"/api/tables/{label_id}/99")
    assert resp.status_code == 404


def test_histogram_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    numeric_fields = [f for f in meta["fields"] if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if not numeric_fields:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={"plot_type": "histogram", "x_column": numeric_fields[0]["name"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "histogram"
    assert "traces" in body["data"]


def test_line_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    numeric_fields = [f for f in meta["fields"] if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_fields) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "line",
            "x_column": numeric_fields[0]["name"],
            "y_column": numeric_fields[1]["name"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "line"


def test_scatter_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    numeric_fields = [f for f in meta["fields"] if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_fields) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "scatter",
            "x_column": numeric_fields[0]["name"],
            "y_column": numeric_fields[1]["name"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "scatter"


def test_heatmap_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    numeric_fields = [f for f in meta["fields"] if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_fields) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "heatmap",
            "x_column": numeric_fields[0]["name"],
            "y_column": numeric_fields[1]["name"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "heatmap"


def test_plot_missing_columns(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)
    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={"plot_type": "histogram"},
    )
    assert resp.status_code == 400
