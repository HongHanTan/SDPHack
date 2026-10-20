"""Physical display rules for the synthetic circular-conduit model."""

# SWMM stats.c uses FUDGE=0.0001 ft at a node crown.
CROWN_TOLERANCE_M = 0.00003048
FLOOD_RATE_TOLERANCE_M3S = 1e-9

STATUS_DEFINITIONS = {
    "node_surcharged": "Junction depth + 0.00003048 m >= highest connected conduit crown above its invert; outfall excluded. Matches SWMM crown criterion for this zero-offset, circular-conduit model.",
    "node_flooding": "Reported node flooding loss rate > 1e-9 m3/s; takes display precedence over surcharge. Not a surface flood depth.",
    "node_normal": "Neither flooding nor crown exceedance at this report instant; outfall is not classified as surcharged.",
    "pipe_surcharged": "Hydraulic heads at both endpoints exceed their respective conduit crown elevations by > 0.00003048 m; indicates pressurized closed conduit at both ends.",
    "pipe_near_capacity": "Not surcharged by the endpoint-head rule and reported conduit depth/diameter >= 0.8; a geometric fullness display threshold, not a discharge-capacity or failure estimate.",
    "pipe_normal": "Neither endpoint-head surcharge nor depth/diameter >= 0.8 at this report instant.",
    "unknown": "Missing or unsupported hydraulic information; never inferred from inlet restriction.",
    "inlet": "Independent assumed hydraulic_inlet_clogging_fraction=0; T1 uses unlimited direct-node runoff entry, not a finite-capacity inlet or calibrated capture model.",
}


def crown_depths(assets: dict) -> dict[str, float]:
    crowns = {node["node_id"]: 0.0 for node in assets["nodes"]}
    for pipe in assets["conduits"]:
        for node_id in (pipe["from_node_id"], pipe["to_node_id"]):
            crowns[node_id] = max(crowns[node_id], pipe["diameter_m"])
    return crowns


def is_surcharged(node: dict, depth_m: float, crowns: dict) -> bool:
    return node["node_type"] == "junction" and depth_m + CROWN_TOLERANCE_M >= crowns[node["node_id"]]


def pipe_status(pipe: dict, depth_m: float, heads: dict, nodes: dict) -> str:
    ends = (pipe["from_node_id"], pipe["to_node_id"])
    if all(heads[n] > nodes[n]["invert_elevation_m"] + pipe["diameter_m"] + CROWN_TOLERANCE_M for n in ends):
        return "surcharged"
    return "near_capacity" if depth_m / pipe["diameter_m"] >= 0.8 else "normal"
