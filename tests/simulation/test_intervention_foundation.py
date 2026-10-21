import copy
import math

import pytest

from simulation.swmm.model import build_inp, canonical_hash, read_json, resolve_inputs
from simulation.swmm.inlets import configure_inlets
from simulation.swmm.interventions import apply_interventions, effective_d07_loss
from simulation.swmm.runner import run_model
from simulation.swmm.reference_checks import run_reference_checks


def baseline():
    inputs=resolve_inputs('synthetic_120mmh_60min')
    inputs['storm']['parameters']['duration_s']=300
    configure_inlets(inputs,'INLET-D07',.4)
    return inputs


def test_candidate_changes_are_explicit_and_original_inputs_are_preserved():
    inputs=baseline();original=copy.deepcopy(inputs)
    pipe=apply_interventions(inputs,['upsize-p07'])
    assert inputs==original
    assert pipe['storm']==inputs['storm'] and pipe['hydrology']==inputs['hydrology'] and pipe['inlet_model']==inputs['inlet_model'] and pipe['tailwater']==inputs['tailwater']
    for a,b in zip(inputs['assets']['conduits'],pipe['assets']['conduits']):
        assert b==({**a,'diameter_m':.75} if a['conduit_id']=='PIPE-P07' else a)
    clean=apply_interventions(inputs,['desilt-d07'])
    assert clean['assets']==inputs['assets'];assert effective_d07_loss(clean)==0
    assert effective_d07_loss(inputs)==.4
    for actions in ([],['unknown'],['upsize-p07','upsize-p07']):
        with pytest.raises(ValueError):apply_interventions(inputs,actions)


@pytest.fixture(scope='module')
def native_candidates(tmp_path_factory):
    directory=tmp_path_factory.mktemp('native-interventions')
    variants={'baseline':[],'clean':['desilt-d07'],'pipe':['upsize-p07'],'combined':['desilt-d07','upsize-p07'],'storage':['storage-tank'],'pond':['lake-overflow']}
    records={}
    for name,actions in variants.items():
        inputs=apply_interventions(baseline(),actions) if actions else baseline()
        run=run_model(inputs,directory/name)
        records[name]=(run,read_json(directory/name/'metrics.json'))
    return directory,records


def test_native_interventions_produce_retained_actual_outputs_and_matching_hashes(native_candidates):
    directory,records=native_candidates
    assert len({r['input_hash'] for r,m in records.values()})==6
    for name,(run,metrics) in records.items():
        assert run['status']=='succeeded' and metrics['engine']=='EPA SWMM'
        assert math.isfinite(metrics['total_flooding_volume_m3'])
        assert run['input_hash']==canonical_hash(run['input_snapshot'])
        assert (directory/name/'model.out').stat().st_size>0
        assert read_json(directory/name/'qa.json')['status']=='passed'
    assert '[STORAGE]' in build_inp(records['storage'][0]['input_snapshot'])
    assert records['storage'][0]['input_snapshot']['storm']==records['baseline'][0]['input_snapshot']['storm']


def test_actual_native_solver_agrees_with_analytic_pipe_and_storage_references(tmp_path):
    report=run_reference_checks(tmp_path/'references')
    assert report['all_passed']
    assert report['field_validation']==report['surface_validation']=='not established'
    assert report['checks'][0]['absolute_error']<.001
    assert report['checks'][1]['calculated']<1e-6
    assert len(report['report_hash'])==64
