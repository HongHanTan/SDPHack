"""Small native checks against analytic references. Not township/2D field validation."""
import math
from pathlib import Path
from .model import resolve_inputs, read_json, canonical_hash
from .runner import run_model, write_json


def check_inputs(kind:str):
    inputs=resolve_inputs('synthetic_80mmh_60min')
    inputs['storm']['parameters'].update(intensity_mmh=0,duration_s=300)
    # A positive dry catchment keeps SWMM rainfall-depth statistics defined (zero total area would yield NaN).
    inputs['hydrology']['subcatchments']=[{**inputs['hydrology']['subcatchments'][0],'outlet_node_id':'REF-UP','area_ha':0.0001}]
    inputs['hydrology']['simulation_parameters']['drain_down_s']=300
    inputs['assets']['inlets']=[]
    inputs['assets']['nodes']=[
        {'node_id':'REF-UP','node_type':'storage','position_m':{'x':0,'y':0,'z':10},'invert_elevation_m':10,'ground_elevation_m':14,'max_depth_m':4,'storage_area_m2':1e8,'initial_depth_m':2,'source_type':'synthetic'},
        {'node_id':'REF-OUT','node_type':'outfall','position_m':{'x':100,'y':0,'z':9},'invert_elevation_m':9,'ground_elevation_m':13,'max_depth_m':4,'source_type':'synthetic'},
    ]
    inputs['assets']['conduits']=[{'conduit_id':'REF-PIPE','from_node_id':'REF-UP','to_node_id':'REF-OUT','diameter_m':0.6,'length_m':100,'manning_n':0.013,'source_type':'synthetic'}]
    inputs['tailwater']['parameters']['depth_above_outfall_invert_m']=2
    if kind=='storage':
        inputs['assets']['nodes'].append({'node_id':'REF-TANK','node_type':'storage','position_m':{'x':0,'y':20,'z':10},'invert_elevation_m':10,'ground_elevation_m':12,'max_depth_m':2,'storage_area_m2':1000,'initial_depth_m':1,'source_type':'synthetic'})
    return inputs


def run_reference_checks(directory:Path):
    directory.mkdir(parents=True,exist_ok=False)
    checks=[]
    for kind in ('pipe','storage'):
        folder=directory/kind;inputs=check_inputs(kind)
        run=run_model(inputs,folder)
        frames=read_json(folder/'frames.json')['frames']
        if kind=='pipe':
            expected=(1/0.013)*(math.pi*0.6**2/4)*(0.6/4)**(2/3)*math.sqrt(0.01)
            observed=sum(next(p['flow_m3s'] for p in frame['pipe_states'] if p['conduit_id']=='REF-PIPE') for frame in frames[-3:])/3
            tolerance=expected*0.02
            title='Full-pipe flow under approximately constant head';unit='m3/s'
            reference='Independent SI Manning full-bore equation, D=0.6 m, n=0.013, head gradient=0.01. Upstream area 1e8 m2 approximates constant head. Last three report samples averaged.'
        else:
            expected=1.0;observed=max(abs(next(n['depth_m'] for n in frame['node_states'] if n['node_id']=='REF-TANK')-expected) for frame in frames)
            # Report the maximum native departure from the analytically constant 1 m depth.
            expected=0.0;tolerance=1e-6;title='Closed storage: maximum depth change from 1 m';unit='m'
            reference='Isolated vertical-sided tank, initial depth 1 m, area 1000 m2, no rain/inflow/outflow/evaporation. Reference maximum depth departure is zero.'
        error=abs(observed-expected)
        checks.append({'id':kind,'title':title,'expected':expected,'calculated':observed,'absolute_error':error,'tolerance':tolerance,'unit':unit,'passed':error<=tolerance,'reference':reference,'input_hash':run['input_hash'],'run_id':run['run_id'],'qa':read_json(folder/'qa.json')})
    report={'version':'native-analytic-checks-v1','engine':'EPA SWMM','checks':checks,'all_passed':all(c['passed'] for c in checks),
        'field_validation':'not established','surface_validation':'not established',
        'limitations':['These idealised reference cases test selected native calculations only.','They do not validate township terrain, runoff parameters, road depths or a proposed intervention.','Tolerances are project diagnostic criteria, not engineering acceptance standards.']}
    report['report_hash']=canonical_hash(report);write_json(directory/'report.json',report)
    return report
