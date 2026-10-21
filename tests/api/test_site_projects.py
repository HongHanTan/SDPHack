import copy
import hashlib
import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from services.api.app.main import create_app
from simulation.site_import import parse_upload

EXAMPLES=Path(__file__).resolve().parents[2]/'apps/web/public/site-examples'

def payload(filename='riverside-complete.site.json'):
    return {'name':'Customer import test','files':[{'name':filename,'text':(EXAMPLES/filename).read_text(),'role':'bundle'}]}

def bundle_request(site):
    value=payload();value['files'][0]['text']=json.dumps(site);return value

def wait(client,run_id):
    for _ in range(250):
        value=client.get('/api/simulations/'+run_id).json()
        if value['status'] in ('failed','succeeded'):
            assert value['status']=='succeeded',value.get('error')
            return value
        time.sleep(.05)
    pytest.fail('Native job did not finish')

def test_map_only_import_blocks_hydraulics_and_preserves_missing_fields(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        preview=client.post('/api/site-projects/inspect',json=payload('riverside-map-only.site.json'))
        assert preview.status_code==200
        value=preview.json();assert value['map_ready'] and not value['simulation_ready']
        assert value['site']['nodes'][2]['invert_elevation_m'] is None
        project=client.post('/api/site-projects',json=payload('riverside-map-only.site.json')).json()
        result=client.post(f"/api/site-projects/{project['project_id']}/simulations",json={'acknowledge_assumptions':True})
        assert result.status_code==422
        assert client.get(f"/api/site-projects/{project['project_id']}/simulations").json()['items']==[]

def test_bad_coordinates_connections_and_source_types_are_not_accepted(tmp_path):
    source=json.loads(payload()['files'][0]['text'])
    with TestClient(create_app(tmp_path)) as client:
        for mutate in [lambda s:s['project'].update(coordinate_units='degrees'),lambda s:s['pipes'][0].update(to_node_id='NOT-UPLOADED'),lambda s:s['nodes'][0].update(x=None)]:
            site=copy.deepcopy(source);mutate(site)
            result=client.post('/api/site-projects/inspect',json=bundle_request(site)).json()
            assert not result['map_ready']
            assert client.post('/api/site-projects',json=bundle_request(site)).status_code==422
        site=copy.deepcopy(source);site['project']['name']={'invalid':'object'}
        assert client.post('/api/site-projects/inspect',json=bundle_request(site)).status_code==422
        site=copy.deepcopy(source);site['project']['source_type']='uploaded_means_verified'
        result=client.post('/api/site-projects/inspect',json=bundle_request(site)).json()
        assert result['map_ready'] and not result['simulation_ready']

def test_csv_mapping_and_geometry_files_compile_the_same_site():
    files=[]
    for name in ['project.json','nodes.csv','pipes.csv','inlets.csv','catchments.csv','rainfall.csv','terrain.csv','roads.geojson','buildings.geojson']:
        text=(EXAMPLES/name).read_text()
        if name=='nodes.csv': text=text.replace('node_id,','survey_asset,',1)
        files.append({'name':name,'role':name.split('.')[0],'text':text})
    missing=parse_upload(files)
    assert not missing['map_ready']
    value=parse_upload(files,mappings={'nodes.csv':{'node_id':'survey_asset'}})
    assert value['simulation_ready']
    assert value['site']['nodes'][0]['node_id']=='MH-A'
    assert len(value['site']['buildings'])==8
    assert value['manifest'][1]['sha256']==hashlib.sha256(files[1]['text'].encode()).hexdigest()
    files[2]['text']=files[2]['text'].replace('manning_n','manning_n,shape').replace('0.013','0.013,rectangular')
    unsupported=parse_upload(files,mappings={'nodes.csv':{'node_id':'survey_asset'}})
    assert not unsupported['simulation_ready']

def test_native_uploaded_rain_and_arbitrary_pipe_change_are_retained(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        response=client.post('/api/site-projects',json=payload());assert response.status_code==201,response.text
        project=response.json();pid=project['project_id'];prefix='/api/site-projects/'+pid
        assert project['simulation_ready'] and not project['is_verified_site_model']
        assert client.post(prefix+'/simulations',json={}).status_code==422
        a=client.post(prefix+'/simulations',json={'acknowledge_assumptions':True});assert a.status_code==202,a.text
        baseline=wait(client,a.json()['run_id'])
        b=client.post(prefix+'/simulations',json={'acknowledge_assumptions':True,'pipe_id':'LINK-TRUNK','diameter_m':.6});assert b.status_code==202,b.text
        candidate=wait(client,b.json()['run_id'])
        base_metrics=client.get('/api/simulations/'+baseline['run_id']+'/metrics').json()
        pipe_metrics=client.get('/api/simulations/'+candidate['run_id']+'/metrics').json()
        assert base_metrics['total_flooding_volume_m3']>pipe_metrics['total_flooding_volume_m3']
        assert baseline['input_snapshot']['assets']['conduits'][2]['diameter_m']==.3
        assert candidate['input_snapshot']['assets']['conduits'][2]['diameter_m']==.6
        assert 'NODE-J07' not in candidate['input_snapshot']['swmm_input']
        assert candidate['input_snapshot']['storm']==baseline['input_snapshot']['storm']
        assert '00:20:00 120' in candidate['input_snapshot']['swmm_input']
        assert any('software assumption' in text for text in candidate['assumptions'])
        frames=client.get('/api/simulations/'+candidate['run_id']+'/frames').json()['frames']
        assert {n['node_id'] for n in frames[0]['node_states']}=={n['node_id'] for n in project['site']['nodes']}
        proposal={'asset_id':'LINK-TRUNK','scope':'Review the pipe','owner':'Engineer','justification':'Check feasibility','baseline_run_id':baseline['run_id'],'candidate_run_id':candidate['run_id']}
        saved=client.post(prefix+'/proposals',json=proposal);assert saved.status_code==201,saved.text
        assert saved.json()['comparison']['candidate']['metrics']==pipe_metrics
        assert saved.json()['estimate_myr'] is None
        assert client.post(prefix+'/proposals',json={**proposal,'asset_id':'LINK-A'}).status_code==422
        other=client.post('/api/site-projects',json=payload()).json()
        assert client.post('/api/site-projects/'+other['project_id']+'/proposals',json=proposal).status_code==422
        for filename in ['model.inp','model.rpt','model.out','inputs.json','qa.json']:
            assert client.get(f"/api/simulations/{candidate['run_id']}/artifacts/{filename}").status_code==200

def test_project_sources_and_evidence_survive_restart_and_remain_scoped(tmp_path):
    request=payload()
    with TestClient(create_app(tmp_path)) as client:
        project=client.post('/api/site-projects',json=request).json();pid=project['project_id'];prefix='/api/site-projects/'+pid
        evidence={'asset_id':'GRATE-1','timestamp':'2026-01-01T00:00:00Z','inspector':'Example inspector','method':'visual','source_type':'synthetic','visible_grate_coverage_fraction':.5,'debris_category':'leaf_litter','notes':'Fictional evidence','source_reference':'IMPORT-TEST'}
        inspection=client.post(prefix+'/inspections',json=evidence);assert inspection.status_code==201,inspection.text
        url=prefix+'/inspections/'+inspection.json()['inspection_id']+'/media'
        data=b'%PDF-1.4\nsynthetic test record'
        media=client.post(url,files={'file':('example.pdf',data,'application/pdf')});assert media.status_code==201,media.text
        assert media.json()['sha256']==hashlib.sha256(data).hexdigest()
        assert client.get(media.json()['url']).content==data
        assert client.post(url,files={'file':('bad.pdf',b'<html>bad</html>','application/pdf')}).status_code==415
        assert client.post(prefix+'/inspections',json={**evidence,'asset_id':'INLET-D07'}).status_code==422
        assert client.get(prefix+'/sources').json()=={**request,'mappings':{}}
    with TestClient(create_app(tmp_path)) as client:
        assert client.get('/api/site-projects').json()['items'][0]['project_id']==pid
        assert client.get(prefix+'/inspections').json()['items'][0]['media'][0]['sha256']==hashlib.sha256(data).hexdigest()
        assert client.get(prefix).json()['model_hash']==project['model_hash']
        path=tmp_path/'site-projects'/pid/'project.json'
        corrupt=json.loads(path.read_text());corrupt['site']['pipes'][0]['diameter_m']=9;path.write_text(json.dumps(corrupt))
        assert client.get(prefix).status_code==500

@pytest.mark.parametrize('change',[lambda s:s['rainfall'][1].update(time_s=100),lambda s:s['nodes'][0].update(ground_elevation_m=10),lambda s:s['pipes'][0].update(manning_n=0),lambda s:s['pipes'][0].update(inlet_offset_m=1),lambda s:s['catchments'][0].update(area_ha=0)])
def test_bad_hydraulic_inputs_can_be_mapped_but_never_run(change):
    source=json.loads(payload()['files'][0]['text']);change(source)
    preview=parse_upload(bundle_request(source)['files'])
    assert preview['map_ready'] and not preview['simulation_ready']
