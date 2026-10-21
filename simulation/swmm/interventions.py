"""Explicit synthetic intervention presets; baseline input objects are never mutated."""
import copy
import math

ACTIONS = ('desilt-d07', 'upsize-p07', 'storage-tank', 'lake-overflow')
TARGETS = {'desilt-d07':['INLET-D07'], 'upsize-p07':['PIPE-P07'], 'storage-tank':['NODE-J05'], 'lake-overflow':['NODE-J04']}


def apply_interventions(original: dict, actions: list[str]) -> dict:
    if not actions or len(set(actions)) != len(actions) or any(action not in ACTIONS for action in actions):
        raise ValueError('Select unique supported intervention actions.')
    inputs=copy.deepcopy(original)
    assets=inputs['assets'];changes=[]
    if 'desilt-d07' in actions:
        elements=inputs.get('inlet_model',{}).get('elements',[])
        element=next((e for e in elements if e['inlet_id']=='INLET-D07'),None)
        if element is None:raise ValueError('Cleaning requires the native finite inlet model.')
        changes.append({'path':'inlet_model.INLET-D07.loss_fraction','before':element['hydraulic_inlet_clogging_fraction'],'after':0.0})
        element['hydraulic_inlet_clogging_fraction']=0.0
    if 'upsize-p07' in actions:
        pipe=next(p for p in assets['conduits'] if p['conduit_id']=='PIPE-P07')
        changes.append({'path':'assets.PIPE-P07.diameter_m','before':pipe['diameter_m'],'after':0.75})
        pipe['diameter_m']=0.75
    nodes={n['node_id']:n for n in assets['nodes']}

    def storage(node_id,x,y,invert,area,depth):
        if node_id in nodes:raise ValueError('Interventions must be applied to a baseline input, not an already changed network.')
        node={'node_id':node_id,'node_type':'storage','position_m':{'x':x,'y':y,'z':invert},'invert_elevation_m':invert,'ground_elevation_m':invert+depth,'max_depth_m':depth,'source_type':'synthetic','storage_area_m2':area,'initial_depth_m':0.0}
        assets['nodes'].append(node);nodes[node_id]=node
        changes.append({'path':f'assets.{node_id}','before':None,'after':copy.deepcopy(node)})

    def pipe(pipe_id,start,end,diameter):
        a,b=nodes[start],nodes[end]
        length=math.hypot(a['position_m']['x']-b['position_m']['x'],a['position_m']['y']-b['position_m']['y'])
        link={'conduit_id':pipe_id,'from_node_id':start,'to_node_id':end,'diameter_m':diameter,'length_m':length,'manning_n':0.013,'source_type':'synthetic'}
        assets['conduits'].append(link);changes.append({'path':f'assets.{pipe_id}','before':None,'after':copy.deepcopy(link)})

    if 'storage-tank' in actions:
        storage('NODE-TK',60,20,8.9,2000.0,2.0)
        pipe('PIPE-TK-IN','NODE-J05','NODE-TK',0.9);pipe('PIPE-TK-OUT','NODE-TK','NODE-J08',0.15)
    if 'lake-overflow' in actions:
        # A documented conceptual pond cell, not a surveyed receiving pond or a 2D flood map.
        storage('NODE-LK',70,-85,9.8,2000.0,1.0)
        pipe('PIPE-LK','NODE-J04','NODE-LK',0.6)
    inputs['intervention']={'actions':sorted(actions),'changes':changes,'source_type':'synthetic','notes':'Conceptual dimensions and connectivity only; no construction feasibility or site validation is established.'}
    return inputs


def effective_d07_loss(inputs:dict):
    return next((e['hydraulic_inlet_clogging_fraction'] for e in inputs.get('inlet_model',{}).get('elements',[]) if e['inlet_id']=='INLET-D07'),None)
