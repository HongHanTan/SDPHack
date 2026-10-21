import copy
import time
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from services.api.app.main import create_app


def wait(client,accepted):
    deadline=time.monotonic()+40
    while True:
        run=client.get(f"/api/simulations/{accepted['run_id']}").json()
        if run['status'] in ('succeeded','failed'):break
        assert time.monotonic()<deadline
        time.sleep(.03)
    assert run['status']=='succeeded',run
    return run


def test_native_api_comparisons_and_proposals_accept_only_the_actual_selected_changes(tmp_path):
    with TestClient(create_app(tmp_path/'runtime')) as client:
        boot=client.get('/api/bootstrap').json();assert boot['capabilities']['interventions']
        storm=client.post('/api/storms',json={'name':'Input isolation case','intensity_mmh':120,'duration_s':300,'source_type':'synthetic'}).json()
        debris=client.post('/api/debris/scenarios',json={'name':'Shared loss','inlet_id':'INLET-D07','storm_id':storm['storm_id'],'hydraulic_inlet_clogging_fraction':.4}).json()
        request={'model_version_id':'taman_kyra_synthetic_v1','storm_id':storm['storm_id'],'debris_scenario_id':debris['debris_scenario_id'],'tailwater_case':'normal','intervention':None}
        base=wait(client,client.post('/api/simulations',json=request).json())
        candidate=wait(client,client.post('/api/simulations',json={**request,'intervention':{'actions':['upsize-p07']}}).json())
        assert base['input_snapshot']['assets']['conduits'][6]['diameter_m']==.6
        assert candidate['input_snapshot']['assets']['conduits'][6]['diameter_m']==.75
        assert client.get('/api/townships/taman_kyra_demo/assets').json()['conduits'][6]['diameter_m']==.6
        assert candidate['input_snapshot']['intervention']['changes']==[{'path':'assets.PIPE-P07.diameter_m','before':.6,'after':.75}]
        def result(option,run):return {'id':option,'option_id':option,'title':option,'target_asset_ids':[],'status':'succeeded','run_id':run['run_id'],'metrics':{'total_flooding_volume_m3':999999}}
        payload={'asset_id':'PIPE-P07','location':'Illustrative lower trunk','scope':'Review pipe upsizing','owner':'Test engineer','justification':'Native comparison; site verification needed','mode':'api','estimate':{'lines':[{'description':'Review','quantity':1,'unit':'item','rate':None}],'source':'','date':'','basis':'illustrative','exclusions':''},'inspection_ids':[],'inspection_snapshot':[],'option_id':'upsize-p07',
            'comparison':{'comparison_id':'test-native','created_at':datetime.now(timezone.utc).isoformat(),'scenario':{'mode':'api','storm_id':storm['storm_id'],'debris_id':debris['debris_scenario_id'],'tailwater':'normal','model_version_id':'taman_kyra_synthetic_v1'},'results':[result('baseline',base),result('upsize-p07',candidate)]}}
        response=client.post('/api/maintenance/proposals',json=payload);assert response.status_code==201,response.text
        assert response.json()['comparison']['results'][1]['metrics']['total_flooding_volume_m3']!=999999
        forged=copy.deepcopy(payload);forged['asset_id']='NODE-J05';forged['option_id']='storage-tank';forged['comparison']['results'][1]['option_id']='storage-tank'
        assert client.post('/api/maintenance/proposals',json=forged).status_code==422
        for actions in (['upsize-p07','upsize-p07'],['unknown']):assert client.post('/api/simulations',json={**request,'intervention':{'actions':actions}}).status_code==422


def test_native_reference_checks_are_executable_and_keep_field_validation_unestablished(tmp_path):
    with TestClient(create_app(tmp_path/'runtime')) as client:
        response=client.post('/api/validation/reference-checks');assert response.status_code==200,response.text
        report=response.json();assert report['all_passed'] and report['field_validation']=='not established'
        assert report['surface_validation']=='not established'
        assert report['checks'][0]['calculated']>0
        assert len(list((tmp_path/'runtime'/'reference-checks').glob('*/pipe/model.out')))==1
