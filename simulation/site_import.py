"""Parse customer files and assess model readiness. No synthetic inputs are substituted."""
import csv
import hashlib
import io
import json
import math
import re
from copy import deepcopy

ROLES = ('project', 'nodes', 'pipes', 'inlets', 'catchments', 'rainfall', 'terrain', 'roads', 'buildings')
FIELDS = {
    'nodes':['node_id','node_type','x','y','ground_elevation_m','invert_elevation_m','outfall_type','water_level_m'],
    'pipes':['conduit_id','from_node_id','to_node_id','diameter_m','length_m','manning_n','shape','inlet_offset_m','outlet_offset_m'],
    'inlets':['inlet_id','node_id','x','y','ground_elevation_m','grate_area_m2'],
    'catchments':['subcatchment_id','outlet_node_id','area_ha','impervious_percent','width_m','slope_percent'],
    'rainfall':['time_s','intensity_mmh'], 'terrain':['x','y','z'],
}
DEFAULTS = {
    'surface_parameters':{'n_impervious':.015,'n_pervious':.15,'storage_impervious_mm':1,'storage_pervious_mm':4,'zero_storage_impervious_percent':25},
    'horton_parameters':{'max_infiltration_mmh':75,'min_infiltration_mmh':5,'decay_per_hour':4,'drying_time_days':7,'max_infiltration_mm':0},
}
ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$')

def number(value):
    if value is None or isinstance(value,bool) or str(value).strip()=='': return None
    try:
        result=float(value)
        return result if math.isfinite(result) else None
    except (ValueError,TypeError): return None

def parse_upload(files, name='', mappings=None):
    if not files or len(files)>12: raise ValueError('Select between 1 and 12 files.')
    mappings=mappings or {}
    site={role:[] for role in ROLES if role!='project'}
    site['project']={}
    manifest=[]
    roles_seen=set()
    if len({f['name'] for f in files})!=len(files): raise ValueError('Source filenames must be unique.')
    for source in files:
        filename=source['name']
        text=source['text'].lstrip('\ufeff')
        if len(text.encode('utf-8'))>8*1024*1024: raise ValueError(f'{filename}: maximum file size is 8 MiB.')
        role=source.get('role') or 'bundle'
        headers=[]
        if filename.lower().endswith('.csv'):
            if role not in FIELDS: raise ValueError(f'{filename}: select its table type.')
            reader=csv.DictReader(io.StringIO(text))
            headers=reader.fieldnames or []
            if len(headers)!=len(set(headers)): raise ValueError(f'{filename}: duplicate CSV column names.')
            mapping=mappings.get(filename,{})
            rows=[]
            for row in reader:
                if len(rows)>50000: raise ValueError(f'{filename}: maximum 50,000 rows.')
                if None in row: raise ValueError(f'{filename}: malformed CSV row.')
                rows.append({field:row.get(mapping.get(field,field)) for field in FIELDS[role]})
            value=rows
        elif filename.lower().endswith(('.json','.geojson')):
            value=json.loads(text,parse_constant=lambda token: (_ for _ in ()).throw(ValueError(f'Invalid JSON number {token}')))
            if role=='bundle':
                if not isinstance(value,dict) or value.get('format')!='floodops-site-v1':
                    raise ValueError(f'{filename}: expected a floodops-site-v1 bundle. Assign another file role for a table or geometry file.')
                unknown=set(value)-set(ROLES)-{'format','hydrology'}
                if unknown: raise ValueError(f'{filename}: unknown bundle sections: {sorted(unknown)}')
                for key in ROLES:
                    if key in value:
                        if key in roles_seen: raise ValueError(f'More than one source supplies {key}. Choose one authoritative file.')
                        site[key]=value[key];roles_seen.add(key)
                if 'hydrology' in value: site['hydrology']=value['hydrology']
            elif role=='project':
                if not isinstance(value,dict): raise ValueError('Project metadata must be a JSON object.')
            elif role in ('roads','buildings'):
                if isinstance(value,dict) and value.get('type')=='FeatureCollection': value=value.get('features',[])
            elif not isinstance(value,list): raise ValueError(f'{filename}: table JSON must contain an array.')
        else:
            raise ValueError(f'{filename}: use CSV, JSON or a site-metre GeoJSON export. PDF/CAD/GeoTIFF parsing is not supported; export the documented tables first.')
        if role!='bundle':
            if role not in ROLES: raise ValueError(f'{filename}: unknown file role.')
            if role in roles_seen: raise ValueError(f'More than one source supplies {role}. Choose one authoritative file.')
            site[role]=value;roles_seen.add(role)
        manifest.append({'name':filename,'sha256':hashlib.sha256(source['text'].encode()).hexdigest(),'bytes':len(source['text'].encode()),'role':role,'headers':headers})
    if not isinstance(site['project'],dict): raise ValueError('Project metadata must be an object.')
    for field in ('name','coordinate_system','coordinate_units','vertical_datum','source_type','source_reference'):
        if site['project'].get(field) is not None and not isinstance(site['project'][field],str): raise ValueError(f'project.{field} must be text.')
    if name.strip(): site['project']['name']=name.strip()
    for role in ROLES[1:]:
        if not isinstance(site[role],list) or len(site[role])>50000: raise ValueError(f'{role}: expected an array of at most 50,000 records.')
        if any(not isinstance(x,dict) for x in site[role]): raise ValueError(f'{role}: every record must be an object.')
    return assess(site,manifest)

def assess(raw,manifest=None):
    site=deepcopy(raw)
    issues=[]
    def issue(level,where,message): issues.append({'level':level,'location':where,'message':message})
    project=site['project']
    for field in ('name','coordinate_system','coordinate_units','vertical_datum','source_type','source_reference'):
        if project.get(field) is not None and not isinstance(project[field],str): raise ValueError(f'project.{field} must be text.')
    if len(str(project.get('name','')))>160: issue('map','project.name','Use a project name up to 160 characters.')
    if not str(project.get('name','')).strip(): issue('map','project.name','Enter a project name.')
    if project.get('coordinate_units')!='m': issue('map','project.coordinate_units','Declare coordinate_units: m. Convert coordinates to one metric site reference before import.')
    if not project.get('coordinate_system') or '4326' in str(project.get('coordinate_system')): issue('map','project.coordinate_system','Declare a metric site coordinate system. Longitude/latitude are not interpreted as metres.')
    if not project.get('vertical_datum'): issue('simulation','project.vertical_datum','Identify the common elevation datum for ground, inverts and water levels.')
    if project.get('source_type') not in ('synthetic','observed','assumed','literature_derived'): issue('simulation','project.source_type','Declare the source type. An upload is not automatically an observation.')
    if not project.get('source_reference'): issue('simulation','project.source_reference','Supply a drawing, survey or example source reference.')
    identifiers=set()
    nodes={}
    if not site['nodes']: issue('map','nodes','Upload at least one node with x/y coordinates to build the map.')
    if len(site['nodes'])>500 or len(site['pipes'])>750: issue('map','network','This pilot supports at most 500 nodes and 750 circular pipes.')
    for row in site['nodes']:
        tag=str(row.get('node_id') or '')
        if not isinstance(row.get('node_id'),str) or not ID.fullmatch(tag) or tag in identifiers: issue('map',f'nodes.{tag}','Use a unique 1-64 character asset ID containing letters, digits, underscore, hyphen or dot.')
        identifiers.add(tag);nodes[tag]=row
        for field in ('x','y','ground_elevation_m','invert_elevation_m','water_level_m'): row[field]=number(row.get(field))
        if row['x'] is None or row['y'] is None: issue('map',f'nodes.{tag}','Missing or nonfinite x/y position.')
        if row.get('node_type') not in ('junction','outfall'): issue('simulation',f'nodes.{tag}','Choose node_type junction or outfall.')
        if row['ground_elevation_m'] is None or row['invert_elevation_m'] is None:
            issue('simulation',f'nodes.{tag}','Missing ground or pipe-bottom elevation. The location can be mapped, but hydraulics cannot run.')
        elif row['ground_elevation_m']<=row['invert_elevation_m']: issue('simulation',f'nodes.{tag}','Ground elevation must exceed the pipe-bottom elevation.')
        if row.get('node_type')=='outfall':
            if row.get('outfall_type') not in ('FREE','FIXED'): issue('simulation',f'nodes.{tag}','Declare outfall_type FREE or FIXED.')
            if row.get('outfall_type')=='FIXED' and (row['water_level_m'] is None or row['invert_elevation_m'] is not None and row['water_level_m']<row['invert_elevation_m']): issue('simulation',f'nodes.{tag}','FIXED outfalls require a water level at or above the outfall invert in the same datum.')
    outfalls={tag for tag,n in nodes.items() if n.get('node_type')=='outfall'}
    if not outfalls: issue('simulation','outfalls','Identify at least one outfall and its boundary condition.')
    outgoing={tag:[] for tag in nodes}
    for pipe in site['pipes']:
        tag=str(pipe.get('conduit_id') or '')
        if not isinstance(pipe.get('conduit_id'),str) or not ID.fullmatch(tag) or tag in identifiers: issue('map',f'pipes.{tag}','Pipe ID must be valid and globally unique.')
        identifiers.add(tag)
        ends=[str(pipe.get(field) or '') for field in ('from_node_id','to_node_id')]
        if any(not isinstance(pipe.get(field),str) for field in ('from_node_id','to_node_id')) or any(end not in nodes for end in ends) or ends[0]==ends[1]: issue('map',f'pipes.{tag}','Pipe must link two different uploaded nodes using their text IDs. Correct its from/to references.')
        else: outgoing[ends[0]].append(ends[1])
        if (pipe.get('shape') or 'circular')!='circular': issue('simulation',f'pipes.{tag}','This importer supports circular pipes only. Do not substitute a diameter for another cross-section.')
        for field in ('diameter_m','length_m','manning_n'):
            pipe[field]=number(pipe.get(field))
            if pipe[field] is None or pipe[field]<=0: issue('simulation',f'pipes.{tag}.{field}',f'Supply a positive {field}; the software will not invent it.')
        if pipe['manning_n'] is not None and not .005<=pipe['manning_n']<=.5: issue('simulation',f'pipes.{tag}.manning_n','Roughness is outside the supported .005..0.5 range; review the units/value.')
        if any(number(pipe.get(field) if pipe.get(field) not in (None,'') else 0)!=0 for field in ('inlet_offset_m','outlet_offset_m')): issue('simulation',f'pipes.{tag}','Non-zero conduit offsets require an extended importer. This version supports connections at node inverts only.')
    if not site['pipes']: issue('simulation','pipes','Upload the connecting pipe table.')
    for tag in nodes:
        visited=set();queue=[tag]
        while queue:
            item=queue.pop()
            if item in visited: continue
            visited.add(item);queue.extend(outgoing.get(item,[]))
        if not visited & outfalls: issue('simulation',f'nodes.{tag}','No directed path to an outfall. Verify network connectivity and pipe direction.')
    for inlet in site['inlets']:
        tag=str(inlet.get('inlet_id') or '')
        if not isinstance(inlet.get('inlet_id'),str) or not ID.fullmatch(tag) or tag in identifiers: issue('map',f'inlets.{tag}','Inlet ID must be text, valid and globally unique.')
        identifiers.add(tag)
        if inlet.get('node_id') not in nodes: issue('map',f'inlets.{tag}','Inlet must reference an uploaded node.')
        for field in ('x','y','ground_elevation_m','grate_area_m2'): inlet[field]=number(inlet.get(field))
        if inlet['x'] is None or inlet['y'] is None: issue('map',f'inlets.{tag}','Inlet needs x/y coordinates.')
    catchment_ids=set()
    for row in site['catchments']:
        tag=str(row.get('subcatchment_id') or '')
        if not isinstance(row.get('subcatchment_id'),str) or not ID.fullmatch(tag) or tag in catchment_ids: issue('simulation',f'catchments.{tag}','Catchment ID must be text, valid and unique.')
        catchment_ids.add(tag)
        if row.get('outlet_node_id') not in nodes or row.get('outlet_node_id') in outfalls: issue('simulation',f'catchments.{tag}','Catchment outlet must be an uploaded junction.')
        for field in ('area_ha','impervious_percent','width_m','slope_percent'): row[field]=number(row.get(field))
        for field in ('area_ha','width_m','slope_percent'):
            if row[field] is None or row[field]<=0: issue('simulation',f'catchments.{tag}.{field}',f'Supply positive {field}.')
        if row['impervious_percent'] is None or not 0<=row['impervious_percent']<=100: issue('simulation',f'catchments.{tag}','Impervious cover must be between 0 and 100 percent.')
    if not site['catchments']: issue('simulation','catchments','Upload contributing areas and their junction outlets.')
    for index,row in enumerate(site['rainfall']):
        row['time_s']=number(row.get('time_s'));row['intensity_mmh']=number(row.get('intensity_mmh'))
        if row['time_s']!=index*300 or row['intensity_mmh'] is None or not 0<=row['intensity_mmh']<=300: issue('simulation',f'rainfall.{index+1}','Use consecutive 5-minute interval starts (0,300,600...) and intensities from 0 to 300 mm/h.')
    if not site['rainfall'] or len(site['rainfall'])>72: issue('simulation','rainfall','Provide 1..72 five-minute rainfall intervals (up to 6 hours). Each value applies to the following interval.')
    for index,row in enumerate(site['terrain']):
        for field in ('x','y','z'): row[field]=number(row.get(field))
        if any(row[f] is None for f in ('x','y','z')): issue('map',f'terrain.{index+1}','Terrain points require finite x/y/z values.')
    if site['terrain'] and all(all(row[f] is not None for f in ('x','y','z')) for row in site['terrain']):
        xs=sorted({p['x'] for p in site['terrain']});ys=sorted({p['y'] for p in site['terrain']})
        if len(xs)<2 or len(ys)<2 or len(site['terrain'])!=len(xs)*len(ys) or len({(p['x'],p['y']) for p in site['terrain']})!=len(site['terrain']): issue('map','terrain','Terrain must be a complete rectangular x/y grid with no duplicate or missing grid points.')
        elif len(xs)*len(ys)>40000: issue('map','terrain','Use at most 40,000 terrain grid points in this pilot.')
        elif any(n['x'] is not None and n['y'] is not None and not(xs[0]<=n['x']<=xs[-1] and ys[0]<=n['y']<=ys[-1]) for n in nodes.values()): issue('map','terrain','The terrain grid must cover all uploaded nodes.')
    if not site['terrain']: issue('warning','terrain','No terrain uploaded. The map shows an explicitly labelled reference plane, not measured ground.')
    for role,kind in (('roads','LineString'),('buildings','Polygon')):
        if len(site[role])>1000: issue('map',role,'This pilot supports at most 1,000 features per geometry layer.')
        for i,feature in enumerate(site[role]):
            geometry=feature.get('geometry',{})
            if not isinstance(geometry,dict) or not isinstance(feature.get('properties',{}),dict): raise ValueError(f'{role}.{i+1}: geometry and properties must be objects.')
            coords=geometry.get('coordinates',[])
            flat=coords[0] if kind=='Polygon' and coords else coords
            if isinstance(flat,list) and len(flat)>5000: issue('map',f'{role}.{i+1}','Simplify this feature to at most 5,000 vertices.')
            if geometry.get('type')!=kind or not isinstance(flat,list) or len(flat)<(4 if kind=='Polygon' else 2) or any(not isinstance(p,list) or len(p)<2 or number(p[0]) is None or number(p[1]) is None for p in flat): issue('map',f'{role}.{i+1}',f'Use {kind} features in the same site-metre coordinate reference.')
            elif kind=='Polygon' and (flat[0][:2]!=flat[-1][:2] or len(coords)!=1): issue('map',f'{role}.{i+1}','Building rings must be closed; holes are not supported in this importer.')
            else:
                normalized=[[number(p[0]),number(p[1])] for p in flat]
                geometry['coordinates']=[normalized] if kind=='Polygon' else normalized
            if role=='roads' and (number(feature.get('properties',{}).get('width_m')) or 0)<=0: issue('map',f'roads.{i+1}','Roads require a positive width_m property.')
            if role=='buildings' and (number(feature.get('properties',{}).get('height_m')) or 0)<=0: issue('map',f'buildings.{i+1}','Buildings require a positive height_m property; heights are not inferred.')
            prop='width_m' if role=='roads' else 'height_m'
            feature.setdefault('properties',{})[prop]=number(feature.get('properties',{}).get(prop))
    hydrology=site.get('hydrology') or {}
    if not isinstance(hydrology,dict): raise ValueError('Hydrology must be an object.')
    site['hydrology']={}
    assumptions=[]
    for group,defaults in DEFAULTS.items():
        supplied=hydrology.get(group,{})
        if not isinstance(supplied,dict): raise ValueError(f'{group} must be an object.')
        site['hydrology'][group]={}
        for field,value in defaults.items():
            chosen=number(supplied.get(field,value));site['hydrology'][group][field]=chosen
            if field not in supplied: assumptions.append(f'{group}.{field} = {value} (software assumption; not measured)')
            if chosen is None or chosen<0: issue('simulation',f'{group}.{field}','Hydrology parameters must be finite and non-negative.')
            if chosen is not None and ((field.startswith('n_') and not .005<=chosen<=.5) or (field=='zero_storage_impervious_percent' and chosen>100) or (field in ('decay_per_hour','drying_time_days') and chosen<=0)): issue('simulation',f'{group}.{field}','Parameter is outside the supported physical range.')
    soil=site['hydrology']['horton_parameters']
    if soil['max_infiltration_mmh'] is not None and soil['min_infiltration_mmh'] is not None and soil['max_infiltration_mmh']<soil['min_infiltration_mmh']: issue('simulation','hydrology','Maximum infiltration must be at least minimum infiltration.')
    assumptions += ['Catchment runoff enters the named junction directly. Inlet markers are geometry/evidence only; no measured inlet-capture relation is supplied.', 'Pipes are circular and connect at node inverts with zero offsets.', 'A 60-minute dry drainage period follows the uploaded rainfall.', 'Native SWMM is a 1D drainage-network calculation. Node depth is measured from the pipe invert; no street depth or flood extent is inferred.', 'Uploaded provenance is retained; file completeness is not field calibration or engineering approval.']
    if not site['roads']: issue('warning','roads','No road geometry uploaded. Roads will not be invented.')
    if not site['buildings']: issue('warning','buildings','No building footprints uploaded. Houses will not be invented.')
    return {'site':site,'manifest':manifest or [],'issues':issues,'assumptions':assumptions,'map_ready':not any(i['level']=='map' for i in issues),'simulation_ready':not any(i['level'] in ('map','simulation') for i in issues),'fields':FIELDS,'counts':{role:len(site[role]) for role in ROLES[1:]}}

def compile_site(project, pipe_id=None, diameter_m=None):
    """Compile reviewed imported data into the existing native SWMM execution contract."""
    preview=assess(project['site'])
    if not preview['simulation_ready']: raise ValueError('Resolve simulation-readiness issues before running.')
    site=preview['site'];metadata=site['project'];source=metadata['source_type']
    assumptions=project.get('assumptions',preview['assumptions'])
    assets={'township_id':project['project_id'],'model_version_id':project['model_version_id'],'source_type':source,'is_verified_site_model':False,'coordinate_system':metadata['coordinate_system'],'nodes':[],'inlets':[],'conduits':deepcopy(site['pipes']),'assumptions':assumptions+['Source reference: '+metadata['source_reference']]}
    for n in site['nodes']:
        assets['nodes'].append({**n,'position_m':{'x':n['x'],'y':n['y'],'z':n['invert_elevation_m']},'max_depth_m':n['ground_elevation_m']-n['invert_elevation_m'],'source_type':source})
    for n in site['inlets']:
        if n['ground_elevation_m'] is not None:
            assets['inlets'].append({**n,'position_m':{'x':n['x'],'y':n['y'],'z':n['ground_elevation_m']},'source_type':source})
    changes=[]
    if pipe_id is not None:
        pipe=next((p for p in assets['conduits'] if p['conduit_id']==pipe_id),None)
        if pipe is None or diameter_m is None or not math.isfinite(diameter_m) or not pipe['diameter_m']<diameter_m<=5: raise ValueError('Choose an uploaded pipe and a larger diameter up to 5 m.')
        changes=[{'asset_id':pipe_id,'field':'diameter_m','before':pipe['diameter_m'],'after':diameter_m}];pipe['diameter_m']=diameter_m
    duration=len(site['rainfall'])*300
    hydrology={**site['hydrology'],'subcatchments':site['catchments'],'assumptions':assumptions,'simulation_parameters':{'start_date':'01/01/2026','report_step_s':60,'wet_step_s':10,'routing_step_s':1,'variable_step_factor':.75,'minimum_step_s':.1,'max_trials':40,'head_tolerance_m':.0005,'drain_down_s':3600}}
    return {'uploaded_site':True,'project_id':project['project_id'],'source_manifest':project['manifest'],'assets':assets,'hydrology':hydrology,'storm':{'storm_id':'uploaded_rainfall','source_type':source,'parameters':{'pattern':'time_series','duration_s':duration,'intensity_mmh':sum(r['intensity_mmh'] for r in site['rainfall'])/len(site['rainfall']),'interval_s':300,'series':site['rainfall']}},'tailwater':{'parameters':{'depth_above_outfall_invert_m':0}},'debris_scenario':{'hydraulic_inlet_clogging_fraction':0},'intervention':{'changes':changes} if changes else None}
