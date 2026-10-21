"""Deterministic SWMM input generation from the published asset registry."""

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "models" / "illustrative_taman_kyra"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_hash(value: dict) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def resolve_inputs(storm_id: str, tailwater_case: str = "normal") -> dict:
    catalog = read_json(ROOT / "data/synthetic/bootstrap.json")
    storm = next((x for x in catalog["storms"] if x["storm_id"] == storm_id), None)
    boundary = next((x for x in catalog["tailwater_cases"] if x["tailwater_case"] == tailwater_case), None)
    if storm is None or boundary is None:
        raise ValueError("Unknown storm or tailwater preset")
    return copy.deepcopy({
        "assets": read_json(ROOT / "data/synthetic/taman_kyra_assets.json"),
        "hydrology": read_json(MODEL_DIR / "hydrology.json"),
        "storm": storm,
        "tailwater": boundary,
        "debris_scenario": {"debris_scenario_id": "demo_inlet_clean", "source_type": "assumed", "hydraulic_inlet_clogging_fraction": 0, "capture_model": "unlimited_direct_node_inflow_T1"},
        "intervention": None,
    })


def clock(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def build_inp(inputs: dict) -> str:
    assets, hydrology = inputs["assets"], inputs["hydrology"]
    storm = inputs["storm"]["parameters"]
    options = hydrology["simulation_parameters"]
    duration = storm["duration_s"]
    if duration <= 0 or duration % 300 or duration + options["drain_down_s"] >= 86400:
        raise ValueError("T1 constant storm must use positive 5-minute duration increments within one day")
    inlet_model = inputs.get("inlet_model")
    if inputs["intervention"] is not None and not inputs["intervention"].get("changes"):
        raise ValueError("Interventions must be explicitly resolved before rendering")
    if inputs["debris_scenario"]["hydraulic_inlet_clogging_fraction"] != 0 and not inlet_model:
        raise ValueError("Restriction requires an explicit native inlet model")
    site_series = bool(inputs.get('uploaded_site')) and storm['pattern'] == 'time_series'
    if (storm["pattern"] != "constant" and not site_series) or storm["intensity_mmh"] < 0:
        raise ValueError("Only non-negative constant storms are supported")
    lines = ["[TITLE]", "; FloodOps synthetic 1D network; not a verified Taman Kyra model.", "", "[OPTIONS]"]
    fixed_options = {
        "FLOW_UNITS": "CMS", "INFILTRATION": "HORTON", "FLOW_ROUTING": "DYNWAVE",
        "START_DATE": options["start_date"], "START_TIME": "00:00:00",
        "REPORT_START_DATE": options["start_date"], "REPORT_START_TIME": "00:00:00",
        "END_DATE": options["start_date"], "END_TIME": clock(duration + options["drain_down_s"]),
        "SWEEP_START": "01/01", "SWEEP_END": "12/31", "DRY_DAYS": 0,
        "REPORT_STEP": clock(options["report_step_s"]), "WET_STEP": clock(options["wet_step_s"]),
        "DRY_STEP": "00:01:00", "ROUTING_STEP": options["routing_step_s"],
        "ALLOW_PONDING": "NO", "VARIABLE_STEP": options["variable_step_factor"],
        "MINIMUM_STEP": options["minimum_step_s"], "LENGTHENING_STEP": 0,
        "SURCHARGE_METHOD": "EXTRAN", "NORMAL_FLOW_LIMITED": "BOTH", "THREADS": 1,
        "MAX_TRIALS": options["max_trials"], "HEAD_TOLERANCE": options["head_tolerance_m"],
    }
    lines.extend(f"{key} {value}" for key, value in fixed_options.items())

    def section(name, rows):
        lines.extend(["", f"[{name}]"])
        lines.extend(" ".join(map(str, row)) for row in rows)

    section("EVAPORATION", [["CONSTANT", 0]])
    section("RAINGAGES", [["RAIN-G01", "INTENSITY", "0:05", 1, "TIMESERIES", "RAIN-TS"]])
    outlets = {catchment:e["upstream_node_id"] for e in (inlet_model or {}).get("elements",[]) for catchment in e["catchment_ids"]}
    section("SUBCATCHMENTS", [[s["subcatchment_id"], "RAIN-G01", outlets.get(s["subcatchment_id"],s["outlet_node_id"]), s["area_ha"], s["impervious_percent"], s["width_m"], s["slope_percent"], 0] for s in hydrology["subcatchments"]])
    surface = hydrology["surface_parameters"]
    section("SUBAREAS", [[s["subcatchment_id"], surface["n_impervious"], surface["n_pervious"], surface["storage_impervious_mm"], surface["storage_pervious_mm"], surface["zero_storage_impervious_percent"], "OUTLET", 100] for s in hydrology["subcatchments"]])
    soil = hydrology["horton_parameters"]
    section("INFILTRATION", [[s["subcatchment_id"], soil["max_infiltration_mmh"], soil["min_infiltration_mmh"], soil["decay_per_hour"], soil["drying_time_days"], soil["max_infiltration_mm"]] for s in hydrology["subcatchments"]])
    section("JUNCTIONS", [[n["node_id"], n["invert_elevation_m"], n["max_depth_m"], 0, 0, 0] for n in assets["nodes"] if n["node_type"] == "junction"])
    storage_nodes=[n for n in assets['nodes'] if n['node_type']=='storage']
    if storage_nodes:
        section('STORAGE',[[n['node_id'],n['invert_elevation_m'],n['max_depth_m'],n.get('initial_depth_m',0),'FUNCTIONAL',0,1,n['storage_area_m2'],0,0] for n in storage_nodes])
    depth = inputs["tailwater"]["parameters"]["depth_above_outfall_invert_m"]
    if inputs.get('uploaded_site'):
        section('OUTFALLS',[[n['node_id'],n['invert_elevation_m'],*(['FREE','NO'] if n['outfall_type']=='FREE' else ['FIXED',n['water_level_m'],'NO'])] for n in assets['nodes'] if n['node_type']=='outfall'])
    else:
        section("OUTFALLS", [[n["node_id"], n["invert_elevation_m"], "FIXED", n["invert_elevation_m"] + depth, "NO"] for n in assets["nodes"] if n["node_type"] == "outfall"])
    section("CONDUITS", [[p["conduit_id"], p["from_node_id"], p["to_node_id"], p["length_m"], p["manning_n"], 0, 0, 0, 0] for p in assets["conduits"]])
    section("XSECTIONS", [[p["conduit_id"], "CIRCULAR", p["diameter_m"], 0, 0, 0, 1] for p in assets["conduits"]])
    if site_series:
        series={int(row['time_s']):row['intensity_mmh'] for row in storm['series']}
        section('TIMESERIES', [['RAIN-TS',options['start_date'],clock(t),series.get(t,0)] for t in range(0,duration+options['drain_down_s']+1,300)])
    else:
        section("TIMESERIES", [["RAIN-TS", options["start_date"], clock(t), storm["intensity_mmh"] if t < duration else 0] for t in range(0, duration + options["drain_down_s"] + 1, 300)])
    section("REPORT", [["INPUT", "NO"], ["CONTINUITY", "YES"], ["FLOWSTATS", "YES"], ["SUBCATCHMENTS", "ALL"], ["NODES", "ALL"], ["LINKS", "ALL"]])
    section("COORDINATES", [[n["node_id"], n["position_m"]["x"], n["position_m"]["y"]] for n in assets["nodes"]])
    if inlet_model:
        junctions, outfalls, conduits, sections, usages = [], [], [], [], []
        for e in inlet_model["elements"]:
            z = e["surface_elevation_m"]
            junctions += [[e["upstream_node_id"],z+inlet_model["upstream_offset_m"],inlet_model["channel_max_depth_m"],0,0,0],
                          [e["bypass_node_id"],z+inlet_model["bypass_offset_m"],inlet_model["channel_max_depth_m"],0,0,0]]
            outfalls.append([e["outfall_node_id"],z+inlet_model["outfall_offset_m"],"FREE","NO"])
            for key, start, end in (("approach_link_id","upstream_node_id","bypass_node_id"),("exit_link_id","bypass_node_id","outfall_node_id")):
                conduits.append([e[key],e[start],e[end],inlet_model["channel_length_m"],inlet_model["channel_manning_n"],0,0,0,0])
                sections.append([e[key],"RECT_OPEN",inlet_model["channel_max_depth_m"],inlet_model["channel_width_m"],0,0,1])
            usages.append([e["approach_link_id"],"ASSUMED-CAP",e["sewer_node_id"],1,e["hydraulic_inlet_clogging_fraction"]*100,0,0,0,"ON_GRADE"])
        section("JUNCTIONS",junctions)
        section("OUTFALLS",outfalls)
        section("CONDUITS",conduits)
        section("XSECTIONS",sections)
        section("INLETS",[["ASSUMED-CAP","CUSTOM","ASSUMED-CURVE"]])
        section("CURVES",[["ASSUMED-CURVE",*( ["DIVERSION"] if index==0 else []),*point] for index,point in enumerate(inlet_model["capture_curve_m3s"])])
        section("INLET_USAGE",usages)
    return "\n".join(lines) + "\n"
