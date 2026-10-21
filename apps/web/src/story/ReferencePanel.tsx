import { useState } from 'react';
import { apiClient } from '../api/client';
import { browserReferenceChecks, type ReferenceCheck } from './referenceChecks';
import type { StoryRun } from './model';

interface NativeReport {checks:ReferenceCheck[];all_passed:boolean;report_hash:string;limitations:string[]}
export function ReferencePanel({run}:{run?:StoryRun}) {
  const [checks,setChecks]=useState<ReferenceCheck[]|null>(null);const [native,setNative]=useState<NativeReport|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <details className="story-reference"><summary>Calculation checks and validation limits</summary><p><b>Site and street-depth validation: not established.</b> Passing an idealised check does not validate the township flood map, runoff assumptions or an intervention.</p><div className="story-reference-actions"><button onClick={()=>{setError('');try{setChecks(browserReferenceChecks());}catch(e){setError(String(e));}}}>Run browser reference checks</button><button disabled={busy} onClick={()=>{setBusy(true);setError('');setNative(null);void fetch(`${apiClient.getBaseUrl()}/api/validation/reference-checks`,{method:'POST'}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error?.message??`API ${response.status}`);if(!Array.isArray(value.checks))throw new Error('Native API did not return reference checks. Restart the updated API.');setNative(value);}).catch(e=>setError(`Native checks unavailable: ${String(e)}. No substitute result was generated.`)).finally(()=>setBusy(false));}}>{busy?'Executing native cases...':'Run native SWMM reference checks'}</button></div>
    <p>Checks compare actual calculations with idealised analytic references. Project diagnostic tolerances are shown explicitly. Pipe checks do not establish 2D street-depth accuracy.</p>
    {error&&<p role="alert" className="story-error">{error}</p>}
    {checks&&<CheckTable title="Browser calculations" checks={checks}/>}{native&&<><CheckTable title="Native EPA SWMM calculations" checks={native.checks}/><code>Native report SHA-256: {native.report_hash}</code>{native.limitations.map(t=><p key={t}>{t}</p>)}</>}
    {run&&<p>Selected result: {run.result.run_id}. Road samples use actual output frames; no native reference check validates the displayed road geometry.</p>}
    <p>To establish real-site performance, an engineer still needs surveyed road levels, verified drainage inputs and independent event observations. The previous unmatched catchment comparison in the repository is not accepted as a validation pass.</p>
  </details>;
}
function CheckTable({title,checks}:{title:string;checks:ReferenceCheck[]}) {
  return <div className="story-check-results"><b>{title}</b><table><thead><tr><th>Check / reference</th><th>Reference</th><th>Calculated</th><th>Error / tolerance</th><th>Result</th></tr></thead><tbody>{checks.map(c=><tr key={c.id}><td><b>{c.title}</b><small>{c.reference}</small></td><td>{c.expected.toPrecision(6)} {c.unit}</td><td>{c.calculated.toPrecision(6)} {c.unit}</td><td>{c.absolute_error.toExponential(2)} / {c.tolerance.toExponential(2)}</td><td>{c.passed?'Passed this check':'Failed this check'}</td></tr>)}</tbody></table></div>;
}
