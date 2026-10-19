"""Assumed 60-second stock/flow accounting in kg; no photo-to-loss calibration."""

import math


def simulate_mass(parameters: dict, storm: dict) -> dict:
    rain = storm["parameters"]
    duration = rain["duration_s"] + 3600
    events = {event["timestamp_s"]:event for event in parameters["cleaning_events"]}
    if len(events) != len(parameters["cleaning_events"]) or any(t > duration for t in events):
        raise ValueError("Cleaning event times must be unique 60-second boundaries inside the storm plus 3600s drainage window")
    surface = parameters["initial_surface_kg"]
    retained = parameters["initial_retained_kg"]
    initial = surface + retained
    added = washed = exported = removed = 0.0
    frames = []

    def frame(t):
        error = initial + added - surface - retained - exported - removed
        if abs(error) > 1e-9 * max(1,initial+added):
            raise ValueError("Debris mass balance exceeded numerical tolerance")
        return {"timestamp_s":t,"surface_mass_kg":surface,"retained_mass_kg":retained,
                "cumulative_added_kg":added,"cumulative_washed_kg":washed,
                "cumulative_exported_kg":exported,"cumulative_removed_kg":removed,
                "balance_error_kg":error}

    frames.append(frame(0))
    for t in range(60,duration+1,60):
        increment = parameters["loading_kg_per_day"] * 60 / 86400
        surface += increment
        added += increment
        rain_mm = rain["intensity_mmh"] / 60 if t <= rain["duration_s"] else 0
        transport = surface * -math.expm1(-parameters["wash_off_per_mm"] * rain_mm)
        surface -= transport
        washed += transport
        retained += transport * parameters["capture_fraction"]
        exported += transport * (1-parameters["capture_fraction"])
        if t in events:
            event = events[t]
            from_surface = surface * event["surface_removal_fraction"]
            from_inlet = retained * event["inlet_removal_fraction"]
            surface -= from_surface
            retained -= from_inlet
            removed += from_surface + from_inlet
        frames.append(frame(t))
    return {
        "model_assumptions_version":"debris-mass-v1",
        "hydraulic_parameter_mode":"independent_constant_hypothesis",
        "parameters":parameters,"max_abs_balance_error_kg":max(abs(f["balance_error_kg"]) for f in frames),
        "time_series":frames,
        "assumptions":[
            "Synthetic lumped debris stocks in kg, sampled at 60s. Constant assumed deposition continues through rain and drainage.",
            "Rainfall-driven wash-off uses available stock * (1-exp(-wash_off_per_mm * interval_rain_mm)); capture_fraction splits transported mass into retained and exported mass.",
            "Cleaning removes stated fractions at the end of the named interval. Removed and exported stocks remain in cumulative mass accounting.",
            "Mass and inspection visible coverage do not determine hydraulic loss. The separately selected hydraulic_inlet_clogging_fraction is a constant, uncalibrated sensitivity hypothesis, including after a debris cleaning event.",
            "This model does not resolve individual leaves, sediment transport, or calibrated grate hydraulics.",
        ],
    }
