"""Reviewable maintenance proposals. Revisions are append-only and do not dispatch work."""
import json
import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from .errors import ApiProblem
from simulation.swmm.interventions import apply_interventions, effective_d07_loss

OPTION_ACTIONS={'baseline':[],'desilt-d07':['desilt-d07'],'upsize-p07':['upsize-p07'],'combined':['desilt-d07','upsize-p07'],'storage-tank':['storage-tank'],'lake-overflow':['lake-overflow']}
OPTION_TARGETS={'baseline':[],'desilt-d07':['INLET-D07'],'upsize-p07':['PIPE-P07'],'combined':['INLET-D07','PIPE-P07'],'storage-tank':['NODE-J05'],'lake-overflow':['NODE-J04']}

Status = Literal['Draft', 'Reviewed', 'Scheduled', 'Completed', 'Verified']
STATUSES = ['Draft', 'Reviewed', 'Scheduled', 'Completed', 'Verified']


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)


class CostLine(StrictModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(gt=0, le=1e9)
    unit: str = Field(min_length=1, max_length=100)
    rate: float | None = Field(default=None, ge=0, le=1e12)


class Estimate(StrictModel):
    lines: list[CostLine] = Field(min_length=1, max_length=30)
    source: str = Field(max_length=1000)
    date: str = Field(max_length=10, pattern=r'^$|^\d{4}-\d{2}-\d{2}$')
    basis: Literal['illustrative', 'quote']
    exclusions: str = Field(max_length=5000)


class ComparisonScenario(StrictModel):
    mode: Literal['api']
    storm_id: str
    debris_id: str
    tailwater: str
    model_version_id: str


class ComparisonResult(StrictModel):
    id: str
    option_id: str
    title: str
    target_asset_ids: list[str]
    status: Literal['succeeded', 'failed', 'unavailable']
    run_id: str | None = None
    input_hash: str | None = None
    input_snapshot: dict | None = None
    metrics: dict | None = None
    error: str | None = None


class Comparison(StrictModel):
    comparison_id: str
    created_at: AwareDatetime
    scenario: ComparisonScenario
    results: list[ComparisonResult] = Field(min_length=2, max_length=10)


class ProposalCreate(StrictModel):
    asset_id: str = Field(min_length=1, max_length=128)
    location: str = Field(min_length=1, max_length=500)
    scope: str = Field(min_length=1, max_length=5000)
    owner: str = Field(min_length=1, max_length=500)
    justification: str = Field(min_length=1, max_length=5000)
    mode: Literal['api']
    estimate: Estimate
    inspection_ids: list[str] = Field(max_length=100)
    inspection_snapshot: list[dict] = Field(max_length=100)
    comparison: Comparison | None
    option_id: str | None = Field(max_length=128)


class ProposalTransition(StrictModel):
    revision: int = Field(ge=1)
    status: Status
    note: str = Field(min_length=1, max_length=5000)
    verification_inspection_id: str | None = Field(default=None, max_length=128)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def initialize(store):
    with store.connect() as db:
        db.execute('CREATE TABLE IF NOT EXISTS maintenance_proposals (id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id,revision))')
        for operation in ('UPDATE', 'DELETE'):
            db.execute(f"CREATE TRIGGER IF NOT EXISTS proposals_no_{operation.lower()} BEFORE {operation} ON maintenance_proposals BEGIN SELECT RAISE(ABORT, 'proposals are append-only'); END")


def list_proposals(service):
    with service.store.connect() as db:
        rows = db.execute('SELECT p.payload FROM maintenance_proposals p JOIN (SELECT id,MAX(revision) AS revision FROM maintenance_proposals GROUP BY id) latest USING(id,revision) ORDER BY p.rowid DESC').fetchall()
    return {'items': [json.loads(row[0]) for row in rows]}


def create_proposal(service, payload: ProposalCreate):
    service.evidence.check_asset(payload.asset_id)
    if not all(s.strip() for s in (payload.scope, payload.owner, payload.justification)):
        raise ApiProblem(422, 'VALIDATION_ERROR', 'Scope, owner and justification cannot be blank.')
    record = payload.model_dump(mode='json')
    # API evidence is resolved server-side; never accept substituted inspection snapshots.
    records = [service.evidence.get(i) for i in payload.inspection_ids]
    if any(i['asset_id'] != payload.asset_id for i in records):
        raise ApiProblem(422, 'VALIDATION_ERROR', 'Inspection evidence must belong to the selected asset.')
    record['inspection_snapshot'] = records
    comparison = record['comparison']
    if comparison:
        scenario = comparison['scenario']
        successful = {}
        for result in comparison['results']:
            if result['status'] == 'succeeded':
                option = result['option_id']
                if option in successful or option not in OPTION_ACTIONS:
                    raise ApiProblem(422, 'VALIDATION_ERROR', 'Only unique supported native comparison results are accepted.')
                run = service.get_run(result.get('run_id') or '')
                if run['status'] != 'succeeded':
                    raise ApiProblem(422, 'VALIDATION_ERROR', 'Comparison references an unfinished run.')
                if any(run[key] != scenario[field] for key, field in (('storm_id','storm_id'),('tailwater_case','tailwater'),('model_version_id','model_version_id'))):
                    raise ApiProblem(422, 'VALIDATION_ERROR', 'Comparison runs must use the same selected storm, model and boundary.')
                debris = run['input_snapshot'].get('debris_scenario', {})
                if debris.get('capture_model') != 'swmm_native_custom_diversion_v1':
                    raise ApiProblem(422, 'VALIDATION_ERROR', 'Native finite inlet runs are required for this cleaning comparison.')
                # Replace client-submitted metrics with retained engine results.
                result['metrics'] = service.result(run['run_id'], 'metrics')
                result['input_hash'] = run['input_hash']
                result['input_snapshot'] = run['input_snapshot']
                result['target_asset_ids'] = OPTION_TARGETS[option]
                successful[option] = run
            else:
                result['metrics'] = None
                result['input_hash'] = None
                result['input_snapshot'] = None
        if payload.option_id not in OPTION_TARGETS or payload.asset_id not in OPTION_TARGETS[payload.option_id] or not {'baseline',payload.option_id}.issubset(successful):
            raise ApiProblem(422, 'VALIDATION_ERROR', 'The selected action and asset require successful matching baseline and candidate runs.')
        baseline = successful['baseline']['input_snapshot']
        preset = next((d for d in service.bootstrap().debris_scenarios if d.debris_scenario_id == scenario['debris_id']), None)
        if baseline.get('intervention') is not None or preset is None or preset.parameters.hydraulic_inlet_clogging_fraction != effective_d07_loss(baseline):
            raise ApiProblem(422, 'VALIDATION_ERROR', 'The baseline must match the selected inlet loss assumption.')
        for option,run in successful.items():
            if option=='baseline':continue
            expected=apply_interventions(baseline,OPTION_ACTIONS[option]);actual=run['input_snapshot']
            # Request IDs and captured source metadata may differ; physical inputs must match exactly.
            if any(expected.get(key)!=actual.get(key) for key in ('assets','hydrology','storm','tailwater','inlet_model')):
                raise ApiProblem(422, 'VALIDATION_ERROR', 'Candidate changes inputs beyond the selected intervention; compare the retained input snapshots.')
    elif payload.option_id is not None:
        raise ApiProblem(422, 'VALIDATION_ERROR', 'Modelled benefit requires comparison evidence.')
    now = timestamp()
    record.update(proposal_id=f'proposal_{uuid.uuid4().hex}', revision=1, status='Draft', created_at=now, updated_at=now,
                  verification_inspection_id=None, history=[{'status':'Draft','timestamp':now,'note':'Proposed work only; no contractor contacted.'}])
    with service.store.connect() as db:
        db.execute('INSERT INTO maintenance_proposals VALUES (?,?,?)', (record['proposal_id'], 1, json.dumps(record, allow_nan=False)))
    return record


def transition_proposal(service, proposal_id: str, payload: ProposalTransition):
    with service.store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT payload FROM maintenance_proposals WHERE id=? ORDER BY revision DESC LIMIT 1', (proposal_id,)).fetchone()
        if not row:
            raise ApiProblem(404, 'NOT_FOUND', 'Unknown proposal.')
        record = json.loads(row[0])
        if record['revision'] != payload.revision:
            raise ApiProblem(409, 'REVISION_CONFLICT', 'Proposal changed; reload before updating.')
        if STATUSES.index(payload.status) != STATUSES.index(record['status']) + 1:
            raise ApiProblem(422, 'VALIDATION_ERROR', 'Advance one status at a time.')
        if not payload.note.strip():
            raise ApiProblem(422, 'VALIDATION_ERROR', 'A transition note is required.')
        if payload.status == 'Reviewed':
            e = record['estimate']
            try:
                datetime.strptime(e['date'], '%Y-%m-%d')
                complete = all(l['rate'] is not None for l in e['lines']) and bool(e['source'].strip()) and e['basis'] == 'quote'
            except ValueError:
                complete = False
            if not complete:
                raise ApiProblem(422, 'VALIDATION_ERROR', 'Review requires a complete sourced quote and date. Create a revised draft if the estimate changes.')
        if payload.status == 'Verified':
            inspection = service.evidence.get(payload.verification_inspection_id or '')
            completed = next(h for h in record['history'] if h['status'] == 'Completed')
            if inspection['asset_id'] != record['asset_id'] or datetime.fromisoformat(inspection['timestamp'].replace('Z', '+00:00')) <= datetime.fromisoformat(completed['timestamp']):
                raise ApiProblem(422, 'VALIDATION_ERROR', 'Verification requires a new inspection of this asset after completion.')
            record['verification_inspection_id'] = inspection['inspection_id']
            record['inspection_ids'].append(inspection['inspection_id'])
            record['inspection_snapshot'].append(inspection)
        record.update(status=payload.status, revision=record['revision'] + 1, updated_at=timestamp())
        record['history'].append({'status':payload.status,'timestamp':record['updated_at'],'note':payload.note})
        db.execute('INSERT INTO maintenance_proposals VALUES (?,?,?)', (proposal_id, record['revision'], json.dumps(record, allow_nan=False)))
    return record
