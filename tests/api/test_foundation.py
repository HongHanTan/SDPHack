import json
import math

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from services.api.app.catalog import REPO_ROOT, load_assets, load_bootstrap
from services.api.app.main import app
from services.api.export_contracts import artifacts


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def test_health_separates_library_from_execution(client, monkeypatch):
    import services.api.app.main as main

    monkeypatch.setattr(main, "probe_engine", lambda: {
        "available": False, "engine": "EPA SWMM", "engine_version": None,
        "execution_verified": False, "message": "Native package missing",
    })
    response = client.get("/api/health")
    assert response.status_code == 200
    health = response.json()
    assert health["status"] == "ok"
    assert health["swmm"]["available"] is False
    assert health["swmm"]["execution_verified"] is False
    assert health["capabilities"]["simulations"] is False


def test_catalog_identity_geometry_and_outfall_connectivity(client):
    bootstrap = client.get("/api/bootstrap").json()
    response = client.get(f"/api/townships/{bootstrap['township_id']}/assets")
    assert response.status_code == 200
    assets = response.json()
    assert assets["model_version_id"] == bootstrap["model_versions"][0]["model_version_id"]
    assert assets["is_verified_site_model"] is False
    nodes = {node["node_id"]: node for node in assets["nodes"]}
    inlets = {inlet["inlet_id"]: inlet for inlet in assets["inlets"]}
    conduits = {pipe["conduit_id"]: pipe for pipe in assets["conduits"]}
    assert len(nodes) == len(assets["nodes"]) == 9
    assert len(inlets) == len(assets["inlets"]) == 4
    assert len(conduits) == len(assets["conduits"]) == 8
    assert inlets["INLET-D07"]["node_id"] == "NODE-J07"
    ids = list(nodes) + list(inlets) + list(conduits)
    assert len(ids) == len(set(ids))
    for node in nodes.values():
        assert node["position_m"]["z"] == node["invert_elevation_m"]
        assert node["ground_elevation_m"] - node["invert_elevation_m"] == pytest.approx(node["max_depth_m"])
    for inlet in inlets.values():
        assert inlet["position_m"]["z"] == nodes[inlet["node_id"]]["ground_elevation_m"]
    downstream = {}
    for conduit in conduits.values():
        start, end = nodes[conduit["from_node_id"]], nodes[conduit["to_node_id"]]
        assert start["invert_elevation_m"] > end["invert_elevation_m"]
        a, b = start["position_m"], end["position_m"]
        assert conduit["length_m"] == pytest.approx(math.hypot(a["x"] - b["x"], a["y"] - b["y"]), abs=1e-6)
        downstream[start["node_id"]] = end["node_id"]
    for node_id in nodes:
        visited = set()
        while nodes[node_id]["node_type"] != "outfall":
            assert node_id not in visited, "Cycle in synthetic drainage fixture"
            visited.add(node_id)
            node_id = downstream[node_id]
        assert node_id == "NODE-OUT01"
    for preset in bootstrap["debris_scenarios"]:
        assert preset["parameters"]["inlet_id"] in inlets
        assert preset["swmm_supported"] is False
    assert load_assets().township_id == load_bootstrap().township_id


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_frontend_cors(client, origin):
    response = client.options("/api/simulations", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "access-control-allow-origin" in client.get("/api/bootstrap", headers={"Origin": origin}).headers


def test_unconfigured_origin_is_not_allowed(client):
    response = client.get("/api/bootstrap", headers={"Origin": "https://unconfigured.example"})
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("path", ["/api/townships/missing/assets", "/api/missing"])
def test_unknown_resources_have_uniform_error(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert "detail" not in response.json()


def test_planned_routes_never_return_fake_runs_or_results(client):
    request = json.loads((REPO_ROOT / "contracts/examples/simulation-request.json").read_text(encoding="utf-8"))
    responses = [client.post("/api/simulations", json=request)]
    responses += [client.get(f"/api/simulations/example{suffix}") for suffix in ("", "/frames", "/metrics")]
    for response in responses:
        assert response.status_code == 501
        assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"
        assert not any(key in response.json() for key in ("run_id", "frames", "total_flooding_volume_m3"))
    schema = app.openapi()
    for path, methods in schema["paths"].items():
        if path.startswith("/api/simulations"):
            for method in methods.values():
                assert method["x-implementation-status"] == "planned"
                assert "501" in method["responses"]


def test_input_validation_error_shape(client):
    for payload in ({}, {"model_version_id": "", "pipe_id": "legacy-field"}):
        response = client.post("/api/simulations", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert response.json()["error"]["details"]["issues"]
    response = client.post("/api/simulations", content="{bad", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_exported_contracts_match_app_and_validate_examples(client):
    for path, content in artifacts().items():
        assert path.read_text(encoding="utf-8") == content, f"Re-export stale artifact: {path}"
    schema = app.openapi()
    examples = REPO_ROOT / "contracts/examples"
    for name, model_name in (
        ("bootstrap", "BootstrapResponse"), ("assets", "AssetsResponse"),
        ("simulation-request", "SimulationRequest"), ("simulation-not-implemented", "ErrorResponse"),
        ("validation-error", "ErrorResponse"),
        ("run-baseline", "RunResponse"), ("frames-baseline", "FramesResponse"), ("metrics-baseline", "MetricsResponse"),
        ("run-stronger", "RunResponse"), ("frames-stronger", "FramesResponse"), ("metrics-stronger", "MetricsResponse"),
    ):
        validator_schema = {"$ref": f"#/components/schemas/{model_name}", "components": schema["components"]}
        value = json.loads((examples / f"{name}.json").read_text(encoding="utf-8"))
        Draft202012Validator(validator_schema).validate(value)
    health_schema = {"$ref": "#/components/schemas/HealthResponse", "components": schema["components"]}
    Draft202012Validator(health_schema).validate(client.get("/api/health").json())
