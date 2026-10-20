"""Parse actual .out data and native routing statistics; fail closed on QA errors."""

import math
import re
from pathlib import Path

from .model import read_json
from .status import FLOOD_RATE_TOLERANCE_M3S, STATUS_DEFINITIONS, crown_depths, is_surcharged, pipe_status


class NumericalQAError(ValueError):
    pass


def nonnegative(value: float) -> float:
    if not math.isfinite(value) or value < -1e-7:
        raise NumericalQAError(f"Invalid negative/nonfinite physical result: {value}")
    return max(0.0, value)


def check_qa(native: dict, report: str, inputs: dict) -> dict:
    if re.search(r"\bERROR\s+\d+", report):
        raise NumericalQAError("SWMM report contains an engine error")
    errors = native["continuity_error_percent"]
    warnings = []
    for process, percent in errors.items():
        if not math.isfinite(percent) or abs(percent) > 5:
            raise NumericalQAError(f"{process} continuity error exceeds project 5% rejection threshold: {percent}")
        if abs(percent) > 1:
            warnings.append(f"{process} continuity error exceeds project 1% warning threshold: {percent:.6f}%")
    nonconvergence = re.search(r"% of Steps Not Converging\s*:\s*([\d.]+)", report)
    if nonconvergence is None:
        raise NumericalQAError("Missing routing convergence statistics")
    percent = float(nonconvergence[1])
    if percent > 5:
        raise NumericalQAError(f"Nonconverging routing steps exceed project 5% rejection threshold: {percent}%")
    if percent > 1:
        warnings.append(f"Nonconverging routing steps exceed project 1% warning threshold: {percent}%")
    warnings.extend(line.strip() for line in report.splitlines() if re.search(r"\bWARNING\s+\d+", line))
    expected_rain_mm = inputs["storm"]["parameters"]["intensity_mmh"] * inputs["storm"]["parameters"]["duration_s"] / 3600
    if not math.isclose(native["water_balance"]["rainfall_mm"], expected_rain_mm, abs_tol=1e-6):
        raise NumericalQAError("Actual SWMM rainfall depth differs from the requested storm")
    flooding = sum(nonnegative(stats["flooding_volume_m3"]) for stats in native["node_statistics"].values())
    trace_nodes = [node_id for node_id, stats in native["node_statistics"].items() if 1e-6 < stats["flooding_volume_m3"] < 0.1]
    if trace_nodes:
        warnings.append("Trace native flooding <0.1 m3 at " + ", ".join(trace_nodes) + "; tiny transient events and flooded-node counts can be sensitive to routing settings. Volumes/counts are retained without filtering.")
    reported_flood = re.search(r"Flooding Loss\s*\.+\s+([\d.Ee+-]+)\s+([\d.Ee+-]+)", report)
    if reported_flood is None or abs(float(reported_flood[2]) * 1000 - flooding) > 0.501:
        raise NumericalQAError("Native node flood volume disagrees with report total (rounded 10^6 litre units)")
    for key in ("surcharge_duration_s", "simulation_duration_s"):
        nonnegative(native[key])
    if native["surcharge_duration_s"] > native["simulation_duration_s"] + 1e-6:
        raise NumericalQAError("Surcharge time union exceeds simulation duration")
    return {
        "status": "passed",
        "continuity_error_percent": errors,
        "nonconverging_steps_percent": percent,
        "thresholds": {"continuity_warning_percent":1,"continuity_rejection_percent":5,"nonconvergence_warning_percent":1,"nonconvergence_rejection_percent":5},
        "water_balance": native["water_balance"],
        "flood_volume_report_difference_m3": abs(float(reported_flood[2]) * 1000 - flooding),
        "warnings": warnings,
    }


def parse_results(directory: Path, inputs: dict, run_id: str) -> tuple[dict, dict, dict]:
    from swmm.toolkit import output, shared_enum as enums
    from .inlets import expected_ids

    native = read_json(directory / "native.json")
    report = (directory / "model.rpt").read_text(encoding="utf-8")
    qa = check_qa(native, report, inputs)
    assets = inputs["assets"]
    nodes = {n["node_id"]: n for n in assets["nodes"]}
    pipes = {p["conduit_id"]: p for p in assets["conduits"]}
    crowns = crown_depths(assets)
    handle = output.init()
    try:
        output.open(handle, str(directory / "model.out"))
        units = output.get_units(handle)
        if units[:2] != [1, 3]:  # SI / CMS; depth is metres and flow is m3/s.
            raise NumericalQAError(f"Unexpected SWMM output units: {units}")
        version = output.get_version(handle)
        version_string = f"{version // 10000}.{version // 1000 % 10}.{version % 1000}"
        if version_string != native["engine_version"]:
            raise NumericalQAError("Binary output engine version disagrees with the native run")
        sizes = output.get_proj_size(handle)
        node_indices = {output.get_elem_name(handle, enums.ElementType.NODE, i): i for i in range(sizes[1])}
        pipe_indices = {output.get_elem_name(handle, enums.ElementType.LINK, i): i for i in range(sizes[2])}
        expected_nodes, expected_links = expected_ids(inputs)
        if expected_nodes != set(node_indices) or expected_links != set(pipe_indices):
            raise NumericalQAError("Output entity IDs differ from the asset registry")
        periods = output.get_times(handle, enums.Time.NUM_PERIODS)
        report_step = output.get_times(handle, enums.Time.REPORT_STEP)
        if periods < 1 or periods * report_step != native["simulation_duration_s"]:
            raise NumericalQAError("Incomplete SWMM report time coverage")

        def node_series(node_id, attr):
            return output.get_node_series(handle, node_indices[node_id], attr, 0, periods - 1)

        depths = {n: node_series(n, enums.NodeAttribute.INVERT_DEPTH) for n in nodes}
        heads = {n: node_series(n, enums.NodeAttribute.HYDRAULIC_HEAD) for n in nodes}
        floods = {n: node_series(n, enums.NodeAttribute.FLOODING_LOSSES) for n in nodes}
        flows = {p: output.get_link_series(handle, pipe_indices[p], enums.LinkAttribute.FLOW_RATE, 0, periods - 1) for p in pipes}
        pipe_depths = {p: output.get_link_series(handle, pipe_indices[p], enums.LinkAttribute.FLOW_DEPTH, 0, periods - 1) for p in pipes}
        inlet_elements = {e["inlet_id"]:e for e in inputs.get("inlet_model",{}).get("elements",[])}
        capture = {tag:node_series(e["sewer_node_id"],enums.NodeAttribute.LATERAL_INFLOW) for tag,e in inlet_elements.items()}
        bypass = {tag:node_series(e["outfall_node_id"],enums.NodeAttribute.TOTAL_INFLOW) for tag,e in inlet_elements.items()}
        frames = []
        for index in range(periods):
            node_states = []
            current_heads = {n: heads[n][index] for n in nodes}
            if not all(math.isfinite(value) for value in current_heads.values()):
                raise NumericalQAError("Nonfinite node head in binary output")
            for node_id, node in nodes.items():
                depth = nonnegative(depths[node_id][index])
                flooding = nonnegative(floods[node_id][index])
                surcharge = is_surcharged(node, depth, crowns)
                status = "flooding" if flooding > FLOOD_RATE_TOLERANCE_M3S else "surcharged" if surcharge else "normal"
                node_states.append({"node_id":node_id,"depth_m":depth,"flooding_rate_m3s":flooding,"surcharge_flag":surcharge,"status":status})
            pipe_states = []
            for pipe_id, pipe in pipes.items():
                flow, depth = flows[pipe_id][index], nonnegative(pipe_depths[pipe_id][index])
                if not math.isfinite(flow):
                    raise NumericalQAError("Nonfinite conduit flow in binary output")
                pipe_states.append({"conduit_id":pipe_id,"flow_m3s":flow,"depth_m":depth,"status":pipe_status(pipe,depth,current_heads,nodes)})
            inlet_states = []
            for inlet in assets["inlets"]:
                tag = inlet["inlet_id"]
                state = {"inlet_id":tag,"hydraulic_inlet_clogging_fraction":inlet_elements.get(tag,{}).get("hydraulic_inlet_clogging_fraction",0),"parameter_status":"assumed_not_calibrated","capture_flow_m3s":None,"bypass_flow_m3s":None}
                if tag in inlet_elements:
                    state.update(capture_flow_m3s=nonnegative(capture[tag][index]),bypass_flow_m3s=nonnegative(bypass[tag][index]))
                inlet_states.append(state)
            frames.append({
                "timestamp_s": (index + 1) * report_step,
                "pipe_states": pipe_states, "node_states": node_states,
                "inlet_states": inlet_states,
            })
    finally:
        output.close(handle)
    provenance = {
        "run_id":run_id,"model_version_id":assets["model_version_id"],"result_type":"simulated",
        "engine":"EPA SWMM","engine_version":native["engine_version"],"is_verified_site_model":False,
        "assumptions":assets["assumptions"] + inputs["hydrology"]["assumptions"],
        "warnings":qa["warnings"], "status_definitions":STATUS_DEFINITIONS,
    }
    metrics = {
        **provenance,
        "inlet_volumes":None,
        "total_flooding_volume_m3":sum(stats["flooding_volume_m3"] for stats in native["node_statistics"].values()),
        "flooded_node_count":sum(stats["flooding_volume_m3"] > 1e-6 for stats in native["node_statistics"].values()),
        "surcharge_duration_s":native["surcharge_duration_s"],
        "metric_definitions": {
            "total_flooding_volume_m3":"Sum of SWMM native node volFlooded statistics, converted by the toolkit to m3 for this CMS model; includes all routing steps, not just displayed report samples.",
            "flooded_node_count":"Number of nodes with native accumulated flooding volume > 1e-6 m3 over the full simulation; brief events between report frames are included.",
            "surcharge_duration_s":"Time union over junction crown-exceedance flags sampled at each native routing-step endpoint, weighted by that step duration; overlaps count once, outfall excluded. At most 1 s routing step in the standard model.",
            "frames":"Actual binary output samples at 60,120,...,7200 s. No fabricated t=0 frame or visual interpolation. A 60 s report sample can miss a routing-step peak.",
        },
    }
    if inlet_elements:
        statistics = native.get("inlet_statistics",[])
        if {x["inlet_id"] for x in statistics} != set(inlet_elements):
            raise NumericalQAError("Missing native inlet statistics")
        for item in statistics:
            for key in ("captured_volume_m3","backflow_volume_m3","bypass_volume_m3"):
                nonnegative(item[key])
        metrics["inlet_volumes"] = statistics
        metrics["metric_definitions"]["inlet_volumes"] = "Integral of native toolkit CMS inlet capture/backflow and each separate surface outfall inflow at routing-step endpoints, using actual step seconds. Bypass includes sewer backflow returned to the surface. It is not a calibrated street-flood volume or depth."
        metrics["metric_definitions"]["flooded_node_count"] += " Native runs with inlet capture also include explicitly mapped auxiliary surface nodes; these are not extra surveyed assets."
        warning = "Finite uncalibrated inlet capture: compare with finite 0% using identical storm/boundary. Reduced sewer flooding can accompany increased surface bypass; display inlet_volumes separately."
        provenance["warnings"].append(warning)
    return {**provenance,"frames":frames}, metrics, qa
