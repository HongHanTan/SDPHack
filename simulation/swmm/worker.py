"""Private native-engine worker. One process per run avoids SWMM global-state races."""

import json
import math
import sys
import traceback
from pathlib import Path

from .status import crown_depths, is_surcharged
from .inlets import expected_ids


def execute(directory: Path):
    from swmm.toolkit import solver, shared_enum as enums

    inputs = json.loads((directory / "inputs.json").read_text(encoding="utf-8"))
    assets = inputs["assets"]
    crowns = crown_depths(assets)
    total_s = inputs["storm"]["parameters"]["duration_s"] + inputs["hydrology"]["simulation_parameters"]["drain_down_s"]
    previous_s = 0.0
    surcharge_duration_s = 0.0
    steps = 0
    try:
        solver.swmm_open(str(directory / "model.inp"), str(directory / "model.rpt"), str(directory / "model.out"))
        node_indices = {solver.project_get_id(enums.ObjectType.NODE, i): i for i in range(solver.project_get_count(enums.ObjectType.NODE))}
        link_indices = {solver.project_get_id(enums.ObjectType.LINK, i): i for i in range(solver.project_get_count(enums.ObjectType.LINK))}
        expected_nodes, expected_links = expected_ids(inputs)
        if set(node_indices) != expected_nodes or set(link_indices) != expected_links:
            raise ValueError("SWMM entity IDs differ from the asset registry")
        solver.swmm_start(True)
        inlet_stats = {e["inlet_id"]:{"inlet_id":e["inlet_id"],"captured_volume_m3":0.0,"backflow_volume_m3":0.0,"bypass_volume_m3":0.0} for e in inputs.get("inlet_model",{}).get("elements",[])}
        while True:
            elapsed_days = solver.swmm_step()
            # The actual SWMM API returns elapsed DAYS (verified against the 2h model),
            # despite this toolkit version's generated docstring saying milliseconds.
            current_s = min(total_s, elapsed_days * 86400.0) if elapsed_days > 0 else float(total_s)
            if not math.isfinite(current_s) or current_s < previous_s or current_s > total_s:
                raise ValueError("Invalid native routing clock")
            surcharge = any(is_surcharged(node, solver.node_get_result(node_indices[node["node_id"]], enums.NodeResult.DEPTH), crowns) for node in assets["nodes"])
            if surcharge:
                surcharge_duration_s += current_s - previous_s
            for element in inputs.get("inlet_model",{}).get("elements",[]):
                stats = inlet_stats[element["inlet_id"]]
                for key, result_type in (("captured_volume_m3",enums.InletResult.FLOW_CAPTURE),("backflow_volume_m3",enums.InletResult.BACK_FLOW)):
                    flow = solver.inlet_get_result(link_indices[element["approach_link_id"]],result_type)
                    if not math.isfinite(flow) or flow < -1e-9:
                        raise ValueError("Invalid native inlet flow")
                    stats[key] += max(0,flow) * (current_s - previous_s)
                bypass = solver.node_get_result(node_indices[element["outfall_node_id"]],enums.NodeResult.TOTAL_INFLOW)
                if not math.isfinite(bypass) or bypass < -1e-9:
                    raise ValueError("Invalid native surface outfall flow")
                stats["bypass_volume_m3"] += max(0,bypass) * (current_s - previous_s)
            previous_s = current_s
            steps += 1
            if elapsed_days <= 0:
                break
            if steps > total_s / inputs["hydrology"]["simulation_parameters"]["minimum_step_s"] + 100:
                raise RuntimeError("Native simulation exceeded expected routing-step bound")
        node_stats = {}
        for node_id in sorted(node_indices):
            stats = solver.node_get_stats(node_indices[node_id])
            node_stats[node_id] = {
                "flooding_volume_m3": stats.volFlooded,
                "flooding_duration_s": stats.timeFlooded * 3600,
                "surcharge_duration_s": stats.timeSurcharged * 3600,
                "peak_depth_m": stats.maxDepth,
            }
        runoff = solver.system_get_runoff_totals()
        # Selected fields are verified against report units. Some other toolkit
        # fields have different internal units; do not export the struct blindly.
        water = {"rainfall_mm": runoff.rainfall, "runoff_mm": runoff.runoff}
        solver.swmm_end()
        balance = solver.swmm_get_mass_balance()
        solver.swmm_report()
        data = {
            "engine_version": solver.swmm_version_info(),
            "continuity_error_percent": {"runoff": balance[0], "routing": balance[1]},
            "quality_routing": "not_modelled",
            "node_statistics": node_stats,
            "surcharge_duration_s": surcharge_duration_s,
            "routing_step_count": steps,
            "simulation_duration_s": total_s,
            "water_balance": water,
        }
        if inlet_stats:
            data["inlet_statistics"] = list(inlet_stats.values())
        (directory / "native.json").write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(json.dumps({"status": "succeeded", "engine_version": data["engine_version"], "routing_steps": steps}))
    finally:
        solver.swmm_close()


if __name__ == "__main__":
    directory = Path(sys.argv[1]).resolve()
    try:
        execute(directory)
    except Exception as exc:
        (directory / "worker-error.json").write_text(json.dumps({"error": {"code": "SWMM_EXECUTION_FAILED", "message": str(exc), "type": type(exc).__name__}}, indent=2) + "\n", encoding="utf-8")
        traceback.print_exc()
        raise SystemExit(1)
