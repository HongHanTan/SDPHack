import base64
import hashlib
import sqlite3

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app

INSPECTION = {
    "asset_id":"INLET-D07","timestamp":"2026-10-19T09:00:00+08:00",
    "inspector":"Synthetic test inspector","method":"visual","source_type":"synthetic",
    "visible_grate_coverage_fraction":0.65,"debris_category":"leaf_litter",
    "notes":"Synthetic test record, not a site observation.","source_reference":"local synthetic test",
}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lRkAAAAASUVORK5CYII=")


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "runtime")) as client:
        yield client


def test_inspection_media_restart_and_append_only_history(tmp_path):
    directory = tmp_path / "runtime"
    with TestClient(create_app(directory)) as client:
        first = client.post("/api/inspections",json=INSPECTION)
        assert first.status_code == 201
        record = first.json()
        assert record["timestamp"].startswith("2026-10-19T01:00:00")
        second = client.post("/api/inspections",json={**INSPECTION,"timestamp":"2026-10-19T01:01:00Z","visible_grate_coverage_fraction":0.1}).json()
        inspection_id = record["inspection_id"]
        endpoint = f"/api/inspections/{inspection_id}"
        media = client.post(endpoint+"/media",files={"file":("../../evidence.png",PNG,"image/png")})
        assert media.status_code == 201
        media = media.json()
        assert media["sha256"] == hashlib.sha256(PNG).hexdigest()
        assert media["filename"] == "evidence.png" and media["source_type"] == "synthetic"
        again = client.post(endpoint+"/media",files={"file":("evidence.png",PNG,"image/png")}).json()
        assert again["media_id"] != media["media_id"]
        assert client.get(media["url"]).content == PNG
        with_media = client.get(endpoint).json()
        assert with_media["visible_grate_coverage_fraction"] == 0.65
        assert len(with_media["media"]) == len(with_media["media_urls"]) == 2
        assert [i["inspection_id"] for i in client.get("/api/inspections?asset_id=INLET-D07").json()["items"]] == [second["inspection_id"],inspection_id]
        for table in ("inspections","media"):
            with sqlite3.connect(directory / "floodops.sqlite3") as db:
                with pytest.raises(sqlite3.IntegrityError,match="append-only"):
                    db.execute(f"UPDATE {table} SET payload='{{}}'")
                with pytest.raises(sqlite3.IntegrityError,match="append-only"):
                    db.execute(f"DELETE FROM {table}")
    with TestClient(create_app(directory)) as client:
        assert client.get(endpoint).json() == with_media
        assert client.get(media["url"]).content == PNG
        assert len(client.get("/api/inspections").json()["items"]) == 2


@pytest.mark.parametrize("patch,status", [
    ({"asset_id":"unknown"},404), ({"timestamp":"2026-10-19T01:00:00"},422),
    ({"visible_grate_coverage_fraction":1.01},422), ({"visible_grate_coverage_fraction":-0.1},422),
    ({"asset_id":"PIPE-P07"},422), ({"hydraulic_inlet_clogging_fraction":0.4},422),
    ({"source_type":"simulated"},422), ({"inspector":" "},422),
])
def test_invalid_inspections_are_not_saved(client,patch,status):
    assert client.post("/api/inspections",json={**INSPECTION,**patch}).status_code == status
    assert client.get("/api/inspections").json() == {"items":[]}


def test_asset_history_missing_media_and_corrupt_file_fail_visibly(client,tmp_path):
    assert client.get("/api/inspections?asset_id=unknown").status_code == 404
    assert client.get("/api/inspections?limit=0").status_code == 422
    assert client.get("/api/inspections/missing").status_code == 404
    assert client.post("/api/inspections/missing/media",files={"file":("test.png",PNG,"image/png")}).status_code == 404
    record = client.post("/api/inspections",json=INSPECTION).json()
    media_endpoint = f"/api/inspections/{record['inspection_id']}/media"
    assert client.get(media_endpoint+"/missing").status_code == 404
    media = client.post(media_endpoint,files={"file":("test.png",PNG,"image/png")}).json()
    path = tmp_path / "runtime/media" / f"{media['media_id']}.blob"
    path.write_bytes(b"corrupt")
    error = client.get(media["url"])
    assert error.status_code == 500 and error.json()["error"]["code"] == "MEDIA_ARTIFACT_INVALID"
    path.unlink()
    assert client.get(media["url"]).status_code == 500
    assert client.get(f"/api/inspections/{record['inspection_id']}").json()["media"][0]["sha256"] == media["sha256"]


@pytest.mark.parametrize("content,mime,status", [
    (b"","image/png",415),(b"<script>fake</script>","image/png",415),
    (PNG,"text/html",415),(b"x"*(10*1024*1024+1),"image/png",413),
],ids=["empty","wrong-signature","wrong-content-type","over-size-limit"])
def test_rejected_uploads_do_not_leave_files_or_metadata(client,tmp_path,content,mime,status):
    record = client.post("/api/inspections",json=INSPECTION).json()
    endpoint = f"/api/inspections/{record['inspection_id']}"
    assert client.post(endpoint+"/media",files={"file":("evidence.png",content,mime)}).status_code == status
    assert client.get(endpoint).json()["media"] == []
    assert list((tmp_path / "runtime/media").iterdir()) == []
