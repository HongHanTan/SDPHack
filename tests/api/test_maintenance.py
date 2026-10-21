import sqlite3
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app


def draft():
    return {'asset_id':'INLET-D07','location':'Illustrative cul-de-sac','scope':'Inspect inlet and document debris',
            'owner':'Test O&M','justification':'Missing verified condition evidence','mode':'api',
            'estimate':{'lines':[{'description':'Inspection','quantity':1,'unit':'visit','rate':100}],
                        'source':'Test contractor Q-01','date':'2026-10-21','basis':'quote','exclusions':'Illustrative test quote'},
            'inspection_ids':[],'inspection_snapshot':[],'comparison':None,'option_id':None}


def inspection(asset_id='INLET-D07', timestamp=None):
    return {'asset_id':asset_id,'timestamp':timestamp or datetime.now(timezone.utc).isoformat(),
            'inspector':'Test inspector','method':'visual','source_type':'synthetic',
            'visible_grate_coverage_fraction':0.2,'debris_category':'mixed','notes':'Synthetic test only','source_reference':'Automated test'}


def test_proposal_lifecycle_restart_revision_conflict_and_verification(tmp_path):
    directory=tmp_path/'runtime'
    with TestClient(create_app(directory)) as client:
        old=client.post('/api/inspections',json=inspection()).json()
        payload=draft(); payload['inspection_ids']=[old['inspection_id']]; payload['inspection_snapshot']=[{'notes':'forged'}]
        response=client.post('/api/maintenance/proposals',json=payload)
        assert response.status_code==201, response.text
        p=response.json(); endpoint=f"/api/maintenance/proposals/{p['proposal_id']}/transition"
        assert p['inspection_snapshot'][0]['notes']=='Synthetic test only'
        assert p['status']=='Draft' and p['revision']==1
        assert client.post(endpoint,json={'revision':1,'status':'Completed','note':'Skip'}).status_code==422
        p=client.post(endpoint,json={'revision':1,'status':'Reviewed','note':'Reviewer checked quote and evidence'}).json()
        assert p['revision']==2
        assert client.post(endpoint,json={'revision':1,'status':'Scheduled','note':'Stale update'}).status_code==409
        for state in ('Scheduled','Completed'):
            r=client.post(endpoint,json={'revision':p['revision'],'status':state,'note':'Test lifecycle record only'})
            assert r.status_code==200,r.text
            p=r.json()
        rejected=client.post(endpoint,json={'revision':p['revision'],'status':'Verified','note':'Old evidence','verification_inspection_id':old['inspection_id']})
        assert rejected.status_code==422
        # Windows clock ticks can coincide across these immediate requests. Keep the
        # production rule strictly "after completion" and wait for a later real tick.
        completed_at=datetime.fromisoformat(next(h['timestamp'] for h in p['history'] if h['status']=='Completed').replace('Z','+00:00'))
        deadline=time.monotonic()+2
        while datetime.now(timezone.utc)<=completed_at:
            assert time.monotonic()<deadline
            time.sleep(.001)
        post=client.post('/api/inspections',json=inspection()).json()
        r=client.post(endpoint,json={'revision':p['revision'],'status':'Verified','note':'Post-work condition recorded','verification_inspection_id':post['inspection_id']})
        assert r.status_code==200,r.text
        p=r.json()
        assert p['status']=='Verified' and len(p['history'])==5
    with TestClient(create_app(directory)) as client:
        assert client.get('/api/maintenance/proposals').json()['items']==[p]
    with sqlite3.connect(directory/'floodops.sqlite3') as db:
        assert db.execute('SELECT count(*) FROM maintenance_proposals').fetchone()[0]==5
        with pytest.raises(sqlite3.IntegrityError,match='append-only'):
            db.execute('DELETE FROM maintenance_proposals')


@pytest.mark.parametrize('patch', [
    {'basis':'illustrative'}, {'source':' '}, {'date':'2026-02-31'},
    {'lines':[{'description':'Inspection','quantity':1,'unit':'visit','rate':None}]},
])
def test_unknown_or_unsourced_costs_cannot_be_reviewed(tmp_path,patch):
    with TestClient(create_app(tmp_path/'runtime')) as client:
        payload=draft();payload['estimate'].update(patch)
        p=client.post('/api/maintenance/proposals',json=payload).json()
        response=client.post(f"/api/maintenance/proposals/{p['proposal_id']}/transition",json={'revision':1,'status':'Reviewed','note':'Test'})
        assert response.status_code==422


def test_invalid_evidence_and_payloads_cannot_create_recommendations(tmp_path):
    with TestClient(create_app(tmp_path/'runtime')) as client:
        wrong=client.post('/api/inspections',json=inspection('INLET-D01')).json()
        payload=draft();payload['inspection_ids']=[wrong['inspection_id']]
        assert client.post('/api/maintenance/proposals',json=payload).status_code==422
        for patch in ({'option_id':'desilt-d07'},{'asset_id':'unknown'},{'owner':' '},{'mode':'engine'},{'comparison':{'scenario':[]}}):
            payload=draft();payload.update(patch)
            assert client.post('/api/maintenance/proposals',json=payload).status_code in (404,422)
        payload=draft();payload['estimate']['lines'][0]['rate']=-1
        assert client.post('/api/maintenance/proposals',json=payload).status_code==422
        assert client.get('/api/maintenance/proposals').json()['items']==[]


def test_native_comparison_saves_retained_metrics_and_rejects_mismatched_inputs(tmp_path):
    with TestClient(create_app(tmp_path/'runtime')) as client:
        storm=client.post('/api/storms',json={'name':'Maintenance validation','intensity_mmh':120,'duration_s':300,'source_type':'synthetic'}).json()
        results=[]
        for option,loss in [('baseline',0.4),('desilt-d07',0)]:
            debris=client.post('/api/debris/scenarios',json={'name':option,'inlet_id':'INLET-D07','storm_id':storm['storm_id'],'hydraulic_inlet_clogging_fraction':loss}).json()
            accepted=client.post('/api/simulations',json={'model_version_id':'taman_kyra_synthetic_v1','storm_id':storm['storm_id'],'debris_scenario_id':debris['debris_scenario_id'],'tailwater_case':'normal','intervention':None}).json()
            deadline=time.monotonic()+30
            while True:
                run=client.get(f"/api/simulations/{accepted['run_id']}").json()
                if run['status'] in ('succeeded','failed'):break
                assert time.monotonic()<deadline
                time.sleep(0.05)
            assert run['status']=='succeeded',run
            results.append({'id':option,'option_id':option,'title':option,'target_asset_ids':['wrong'], 'status':'succeeded','run_id':run['run_id'],'metrics':{'total_flooding_volume_m3':999999}})
        payload=draft();payload['option_id']='desilt-d07'
        payload['comparison']={'comparison_id':'test-pair','created_at':datetime.now(timezone.utc).isoformat(),
            'scenario':{'mode':'api','storm_id':storm['storm_id'],'debris_id':'demo_inlet_40pct','tailwater':'normal','model_version_id':'taman_kyra_synthetic_v1'},'results':results}
        response=client.post('/api/maintenance/proposals',json=payload)
        assert response.status_code==201,response.text
        saved=response.json()['comparison']['results']
        assert saved[1]['metrics']['total_flooding_volume_m3']!=999999
        assert saved[1]['target_asset_ids']==['INLET-D07']
        assert saved[1]['input_hash']
        payload['comparison']['scenario']['tailwater']='high'
        assert client.post('/api/maintenance/proposals',json=payload).status_code==422
