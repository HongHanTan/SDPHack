"""Controlled auxiliary mapping for native SWMM 5.2 inlet sensitivity runs."""

from .model import MODEL_DIR, read_json

CAPTURE_MODEL = "swmm_native_custom_diversion_v1"


def configure_inlets(inputs: dict, inlet_id: str, loss_fraction: float) -> dict:
    inlets = inputs["assets"]["inlets"]
    if inlet_id not in {x["inlet_id"] for x in inlets} or not 0 <= loss_fraction <= 0.6:
        raise ValueError("Native inlet scenario requires a known inlet and a 0..0.6 loss fraction")
    config = read_json(MODEL_DIR / "inlet_capture.json")
    elements = []
    for inlet in inlets:
        tag = inlet["inlet_id"]
        catchments = [x["subcatchment_id"] for x in inputs["hydrology"]["subcatchments"] if x["outlet_node_id"] == inlet["node_id"]]
        if not catchments:
            raise ValueError("Every native inlet must have a mapped subcatchment")
        elements.append({
            "inlet_id":tag,"sewer_node_id":inlet["node_id"],"catchment_ids":catchments,
            "upstream_node_id":f"AUX-UP-{tag}","bypass_node_id":f"AUX-BYPASS-{tag}",
            "outfall_node_id":f"AUX-OUT-{tag}","approach_link_id":f"AUX-STREET-{tag}",
            "exit_link_id":f"AUX-EXIT-{tag}","surface_elevation_m":inlet["position_m"]["z"],
            "hydraulic_inlet_clogging_fraction":loss_fraction if tag == inlet_id else 0,
        })
    inputs["inlet_model"] = {**config,"elements":elements}
    # These replace assumptions that apply only to the retained direct-node model.
    inputs["hydrology"]["assumptions"] = [
        x for x in inputs["hydrology"]["assumptions"]
        if "T1 clean scenario" not in x and "Flooding is lost" not in x
    ] + config["assumptions"]
    return inputs


def expected_ids(inputs: dict):
    node_ids = {n["node_id"] for n in inputs["assets"]["nodes"]}
    link_ids = {p["conduit_id"] for p in inputs["assets"]["conduits"]}
    for element in inputs.get("inlet_model",{}).get("elements",[]):
        node_ids.update(element[key] for key in ("upstream_node_id","bypass_node_id","outfall_node_id"))
        link_ids.update(element[key] for key in ("approach_link_id","exit_link_id"))
    return node_ids, link_ids
