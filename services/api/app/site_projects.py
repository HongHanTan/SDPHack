"""Project imports and scoped native runs, preserving original files and immutable models."""
import hashlib
import json
import threading
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from simulation.site_import import parse_upload, compile_site
from simulation.swmm.model import canonical_hash
from simulation.swmm.runner import snapshot_inputs
from .errors import ApiProblem
from .schemas import InspectionCreate

router=APIRouter(prefix='/api/site-projects',tags=['uploaded-sites'])
lock=threading.RLock()
def now(): return datetime.now(timezone.utc).isoformat()

class SourceFile(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(min_length=1,max_length=180)
    text:str=Field(max_length=8*1024*1024)
    role:str='bundle'

class ImportRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(default='',max_length=160)
    files:list[SourceFile]=Field(min_length=1,max_length=12)
    mappings:dict[str,dict[str,str]]=Field(default_factory=dict)

class RunRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    acknowledge_assumptions:bool=False
    pipe_id:str|None=None
    diameter_m:float|None=Field(default=None,gt=0,le=5)

class ProposalRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    asset_id:str
    scope:str=Field(min_length=1,max_length=4000)
    owner:str=Field(min_length=1,max_length=200)
    justification:str=Field(min_length=1,max_length=10000)
    baseline_run_id:str|None=None
    candidate_run_id:str|None=None
    estimate_myr:float|None=Field(default=None,ge=0)
    estimate_source:str=Field(default='',max_length=1000)

def root(request):
    directory=request.app.state.scenarios.directory/'site-projects'
    directory.mkdir(exist_ok=True)
    return directory

def path_for(request,project_id):
    if not project_id.startswith('site_') or len(project_id)!=37 or any(c not in '0123456789abcdef' for c in project_id[5:]): raise ApiProblem(404,'NOT_FOUND','Unknown site project.')
    return root(request)/project_id

def read_project(request,project_id):
    path=path_for(request,project_id)/'project.json'
    if not path.exists(): raise ApiProblem(404,'NOT_FOUND','Unknown site project.')
    project=json.loads(path.read_text(encoding='utf-8'))
    if canonical_hash(project['site'])!=project['model_hash']: raise ApiProblem(500,'PROJECT_INTEGRITY_ERROR','Saved model failed its integrity check.')
    return project

def save_json(path,value):
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    temp.replace(path)

def inspect(payload):
    if sum(len(f.text.encode()) for f in payload.files)>24*1024*1024: raise ApiProblem(413,'UPLOAD_TOO_LARGE','Combined source files are limited to 24 MiB.')
    try: return parse_upload([f.model_dump() for f in payload.files],payload.name,payload.mappings)
    except (ValueError,TypeError,KeyError,IndexError) as exc: raise ApiProblem(422,'IMPORT_INVALID',str(exc)) from exc

@router.post('/inspect')
def inspect_files(payload:ImportRequest): return inspect(payload)

@router.get('')
def list_projects(request:Request):
    items=[]
    for file in root(request).glob('site_*/project.json'):
        project=read_project(request,file.parent.name)
        items.append({k:project[k] for k in ('project_id','name','created_at','model_version_id','model_hash','counts','simulation_ready')})
    return {'items':sorted(items,key=lambda p:p['created_at'],reverse=True)}

@router.post('',status_code=201)
def build_project(payload:ImportRequest,request:Request):
    preview=inspect(payload)
    if not preview['map_ready']: raise ApiProblem(422,'MAP_NOT_READY','Resolve map-blocking input issues before building.',{'issues':preview['issues']})
    project_id='site_'+uuid4().hex
    version='uploaded_'+uuid4().hex
    project={**preview,'project_id':project_id,'name':preview['site']['project']['name'],'model_version_id':version,'model_hash':canonical_hash(preview['site']),'created_at':now(),'is_verified_site_model':False}
    path=path_for(request,project_id);path.mkdir()
    save_json(path/'sources.json',payload.model_dump())
    save_json(path/'project.json',project)
    return project

@router.get('/{project_id}')
def get_project(project_id:str,request:Request): return read_project(request,project_id)

@router.get('/{project_id}/sources')
def sources(project_id:str,request:Request):
    project=read_project(request,project_id)
    payload=json.loads((path_for(request,project_id)/'sources.json').read_text(encoding='utf-8'))
    for file,item in zip(payload['files'],project['manifest']):
        if hashlib.sha256(file['text'].encode()).hexdigest()!=item['sha256']: raise ApiProblem(500,'SOURCE_INTEGRITY_ERROR','Original source failed its hash check.')
    return payload

@router.post('/{project_id}/simulations',status_code=202)
def simulate(project_id:str,payload:RunRequest,request:Request):
    project=read_project(request,project_id)
    if not payload.acknowledge_assumptions: raise ApiProblem(422,'REVIEW_REQUIRED','Review and acknowledge the disclosed modelling assumptions first.')
    if bool(payload.pipe_id)!=(payload.diameter_m is not None): raise ApiProblem(422,'INTERVENTION_INVALID','Supply both pipe ID and diameter, or neither for the baseline.')
    try: snapshot=snapshot_inputs(compile_site(project,payload.pipe_id,payload.diameter_m))
    except ValueError as exc: raise ApiProblem(422,'MODEL_NOT_READY',str(exc),{'issues':project['issues']}) from exc
    service=request.app.state.scenarios
    run={'run_id':'run_'+uuid4().hex,'status':'queued','model_version_id':project['model_version_id'],'input_snapshot':snapshot,'input_hash':canonical_hash(snapshot),'engine':'EPA SWMM','engine_version':None,'is_verified_site_model':False,'assumptions':snapshot['assets']['assumptions'],'warnings':[],'error':None,'evidence_references':[],'storm_id':'uploaded_rainfall','debris_scenario_id':'uploaded_direct_entry','tailwater_case':'uploaded_boundary','created_at':now(),'started_at':None,'completed_at':None}
    from .storage import QueueFullError
    with service.lock:
        if service.closed: raise ApiProblem(503,'SERVICE_STOPPING','The API is stopping.')
        try: service.store.create_run(run,service.max_pending)
        except QueueFullError as exc: raise ApiProblem(429,'QUEUE_FULL','Wait for an existing simulation to finish.') from exc
        try: service.executor.submit(service.execute,run['run_id'])
        except RuntimeError as exc:
            service.fail(run['run_id'],'SCHEDULING_FAILED',str(exc))
            raise ApiProblem(503,'SCHEDULING_FAILED','Run could not be scheduled.') from exc
    return {'run_id':run['run_id'],'status':'queued'}

@router.get('/{project_id}/simulations')
def runs(project_id:str,request:Request):
    read_project(request,project_id)
    return {'items':[run for run in request.app.state.scenarios.store.list_runs(limit=1000) if run['input_snapshot'].get('project_id')==project_id]}

def records(request,project_id,kind):
    read_project(request,project_id)
    path=path_for(request,project_id)/f'{kind}.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else []

@router.get('/{project_id}/inspections')
def inspections(project_id:str,request:Request): return {'items':records(request,project_id,'inspections')}

@router.post('/{project_id}/inspections',status_code=201)
def inspection(project_id:str,payload:InspectionCreate,request:Request):
    project=read_project(request,project_id);site=project['site']
    known={x['node_id'] for x in site['nodes']}|{x['conduit_id'] for x in site['pipes']}|{x['inlet_id'] for x in site['inlets']}
    if payload.asset_id not in known: raise ApiProblem(422,'ASSET_INVALID','Choose an asset from this uploaded site.')
    if payload.timestamp>datetime.now(timezone.utc) or not payload.source_reference.strip() or not payload.notes.strip(): raise ApiProblem(422,'EVIDENCE_INVALID','Use a non-future timestamp, source reference and condition notes.')
    if payload.visible_grate_coverage_fraction is not None and payload.asset_id not in {x['inlet_id'] for x in site['inlets']}: raise ApiProblem(422,'EVIDENCE_INVALID','Grate coverage applies only to an inlet.')
    value={**payload.model_dump(mode='json'),'inspection_id':'inspection_'+uuid4().hex,'created_at':now(),'model_version_id':project['model_version_id'],'is_verified_site_model':False,'media':[],'media_urls':[]}
    with lock:
        items=records(request,project_id,'inspections');items.insert(0,value);save_json(path_for(request,project_id)/'inspections.json',items)
    return value

@router.post('/{project_id}/inspections/{inspection_id}/media',status_code=201)
async def upload_media(project_id:str,inspection_id:str,request:Request,file:UploadFile=File(...)):
    items=records(request,project_id,'inspections')
    record=next((x for x in items if x['inspection_id']==inspection_id),None)
    if record is None: raise ApiProblem(404,'NOT_FOUND','Unknown site inspection.')
    try: data=await file.read(10*1024*1024+1)
    finally: await file.close()
    if not data or len(data)>10*1024*1024: raise ApiProblem(413,'MEDIA_TOO_LARGE','Use a nonempty attachment up to 10 MiB.')
    mime='image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'application/pdf' if data.startswith(b'%PDF-') else 'image/webp' if data[:4]==b'RIFF' and data[8:12]==b'WEBP' else None
    if mime is None or file.content_type not in (mime,'application/octet-stream'): raise ApiProblem(415,'UNSUPPORTED_MEDIA','Use PNG, JPEG, WebP or PDF with a matching file signature.')
    media_id='media_'+uuid4().hex
    metadata={'media_id':media_id,'inspection_id':inspection_id,'filename':(file.filename or 'evidence').replace('\\','/').rsplit('/',1)[-1][:180],'content_type':mime,'size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'created_at':now(),'source_type':record['source_type'],'url':f'/api/site-projects/{project_id}/inspections/{inspection_id}/media/{media_id}'}
    directory=path_for(request,project_id)/'media';directory.mkdir(exist_ok=True)
    (directory/(media_id+'.blob')).write_bytes(data)
    with lock:
        items=records(request,project_id,'inspections');record=next(x for x in items if x['inspection_id']==inspection_id)
        record['media'].append(metadata);record['media_urls'].append(metadata['url']);save_json(path_for(request,project_id)/'inspections.json',items)
    return metadata

@router.get('/{project_id}/inspections/{inspection_id}/media/{media_id}')
def download_media(project_id:str,inspection_id:str,media_id:str,request:Request):
    inspection=next((x for x in records(request,project_id,'inspections') if x['inspection_id']==inspection_id),None)
    media=next((m for m in (inspection or {}).get('media',[]) if m['media_id']==media_id),None)
    if media is None: raise ApiProblem(404,'NOT_FOUND','Unknown site attachment.')
    path=path_for(request,project_id)/'media'/(media['media_id']+'.blob')
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=media['sha256']: raise ApiProblem(500,'MEDIA_INTEGRITY_ERROR','Attachment is missing or failed its hash check.')
    return FileResponse(path,media_type=media['content_type'],filename=media['filename'])

@router.get('/{project_id}/proposals')
def proposals(project_id:str,request:Request): return {'items':records(request,project_id,'proposals')}

@router.post('/{project_id}/proposals',status_code=201)
def proposal(project_id:str,payload:ProposalRequest,request:Request):
    project=read_project(request,project_id)
    known={x['node_id'] for x in project['site']['nodes']}|{x['conduit_id'] for x in project['site']['pipes']}|{x['inlet_id'] for x in project['site']['inlets']}
    if payload.asset_id not in known or any(not v.strip() for v in (payload.scope,payload.owner,payload.justification)): raise ApiProblem(422,'PROPOSAL_INVALID','Choose an uploaded asset and enter scope, owner and reason.')
    if bool(payload.baseline_run_id)!=bool(payload.candidate_run_id): raise ApiProblem(422,'COMPARISON_INVALID','Attach both baseline and candidate, or neither.')
    comparison=None
    if payload.baseline_run_id:
        service=request.app.state.scenarios
        baseline=service.get_run(payload.baseline_run_id);candidate=service.get_run(payload.candidate_run_id)
        a,b=baseline['input_snapshot'],candidate['input_snapshot']
        if a.get('project_id')!=project_id or b.get('project_id')!=project_id or a['intervention'] is not None or not b['intervention']: raise ApiProblem(422,'COMPARISON_INVALID','Runs must be a baseline and intervention from this project.')
        change=b['intervention']['changes']
        if len(change)!=1 or change[0]['asset_id']!=payload.asset_id: raise ApiProblem(422,'COMPARISON_INVALID','Proposal target must match the candidate pipe.')
        expected=snapshot_inputs(compile_site(project,payload.asset_id,change[0]['after']))
        reference=snapshot_inputs(compile_site(project))
        if canonical_hash(expected)!=candidate['input_hash'] or canonical_hash(reference)!=baseline['input_hash']: raise ApiProblem(422,'COMPARISON_INVALID','Candidate inputs do not match the declared change and project.')
        comparison={'baseline':{'run_id':baseline['run_id'],'input_hash':baseline['input_hash'],'metrics':service.result(baseline['run_id'],'metrics')},'candidate':{'run_id':candidate['run_id'],'input_hash':candidate['input_hash'],'metrics':service.result(candidate['run_id'],'metrics')},'changes':change}
    value={**payload.model_dump(),'proposal_id':'proposal_'+uuid4().hex,'project_id':project_id,'model_version_id':project['model_version_id'],'created_at':now(),'status':'Draft','estimate_basis':'illustrative' if payload.estimate_myr is not None else 'unknown','comparison':comparison,'inspection_snapshot':[x for x in records(request,project_id,'inspections') if x['asset_id']==payload.asset_id],'manifest':project['manifest'],'model_hash':project['model_hash'],'limitations':project['assumptions']}
    with lock:
        items=records(request,project_id,'proposals');items.insert(0,value);save_json(path_for(request,project_id)/'proposals.json',items)
    return value
