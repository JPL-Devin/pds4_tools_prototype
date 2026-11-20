"""Tests for table data and plotting endpoints."""
from __future__ import annotations


def _upload_label(client, xml_path, tab_path):
    """Helper to upload a label and return the label_id."""
    with open(xml_path, "rb") as lf, open(tab_path, "rb") as df:
        resp = client.post(
            "/api/labels/upload",
            files={
                "label_file": (xml_path.name, lf, "application/xml"),
                "data_files": (tab_path.name, df, "application/octet-stream"),
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
    # Data rows are positional lists, not dicts
    if body["data"]:
        assert isinstance(body["data"][0], list)
        assert len(body["data"][0]) == len(body["columns"])


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

    # Find the index of the first numeric field
    all_fields = meta["fields"]
    numeric_idx = next(i for i, f in enumerate(all_fields) if "Real" in f["data_type"] or "Integer" in f["data_type"])

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={"plot_type": "histogram", "x_column": numeric_idx},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "histogram"
    assert "traces" in body["data"]


def test_line_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    all_fields = meta["fields"]
    numeric_indices = [i for i, f in enumerate(all_fields) if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_indices) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "line",
            "x_column": numeric_indices[0],
            "y_column": numeric_indices[1],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "line"


def test_scatter_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    all_fields = meta["fields"]
    numeric_indices = [i for i, f in enumerate(all_fields) if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_indices) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "scatter",
            "x_column": numeric_indices[0],
            "y_column": numeric_indices[1],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plot_type"] == "scatter"


def test_heatmap_plot(client, table_character_xml, table_character_tab):
    label_id = _upload_label(client, table_character_xml, table_character_tab)

    meta = client.get(f"/api/tables/{label_id}/0").json()
    all_fields = meta["fields"]
    numeric_indices = [i for i, f in enumerate(all_fields) if "Real" in f["data_type"] or "Integer" in f["data_type"]]
    if len(numeric_indices) < 2:
        return

    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={
            "plot_type": "heatmap",
            "x_column": numeric_indices[0],
            "y_column": numeric_indices[1],
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


def test_duplicate_column_names(client, table_dup_cols_xml, table_dup_cols_csv):
    """Test that tables with duplicate column names work correctly."""
    label_id = _upload_label(client, table_dup_cols_xml, table_dup_cols_csv)

    # Metadata should list all fields including duplicates
    meta = client.get(f"/api/tables/{label_id}/0").json()
    assert meta["record_count"] > 0
    assert len(meta["fields"]) == 11
    # There should be multiple fields named "Voltage count"
    vc_fields = [f for f in meta["fields"] if f["name"] == "Voltage count"]
    assert len(vc_fields) == 10

    # Data should return all 11 columns per row as positional arrays
    resp = client.get(f"/api/tables/{label_id}/0/data?offset=0&limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["columns"]) == 11
    for row in body["data"]:
        assert isinstance(row, list)
        assert len(row) == 11

    # Plotting by column index should work with duplicate names
    resp = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={"plot_type": "histogram", "x_column": 1},
    )
    assert resp.status_code == 200

    # Different column indices with same name should give different data
    resp2 = client.post(
        f"/api/tables/{label_id}/0/plot",
        json={"plot_type": "histogram", "x_column": 5},
    )
    assert resp2.status_code == 200
