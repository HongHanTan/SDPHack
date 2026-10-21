> **Legacy:** describes the earlier API-based multi-file upload. The app now uses the three-file, in-browser flow — see README.md.

# Upload-first township workflow

The operations manager starts with an actual drainage catchment and the files available for that catchment. The application constructs their site and identifies missing inputs before proposing a calculation.

## Start and exact practice inputs

Start the existing API and Vite server using the repository setup guides. Open http://localhost:5173. The default page is now **Build around your township**, without preloaded houses, rain or incidents.

On this Windows workspace, if the servers are not running, use two terminals from the repository root. API: `.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000`. Frontend: `npm run dev:web`. Existing Python/frontend dependencies must be installed first, as described in the setup guides. Uploads require the updated API; native runs require the installed SWMM toolkit.

Download [the complete fictional site](../apps/web/public/site-examples/riverside-complete.site.json). Enter **Riverside Estate drainage review**, select that file, leave its role as **bundle**, and click **Check my files**. Expect **5 nodes, 4 pipes, 4 catchments, 49 terrain points, 3 roads, 8 building footprints**. The bundle also supplies 4 inlet markers and 12 five-minute rainfall intervals. Both input-readiness checks pass, with synthetic provenance and uncalibrated status retained.

Click **Build my township**. First terrain appears, then road/building geometry, then uploaded drainage assets. This short sequence reveals layers from the reviewed model; it does not pretend to scan or survey the site. Select **MH-C** in the asset list to see its uploaded values. Select **Surface view** for solid terrain or **X-ray drainage** for underground connections. Missing optional layers are not invented.

## Find out whether the network needs investigation

Open **Compare actions**, expand **Modelling assumptions**, read them and tick the review checkbox. Click **Run uploaded baseline**. This submits the imported site's immutable input snapshot to the native EPA SWMM worker. Expect approximately **1,597.115 m³ network flooding loss** with engine 5.2.4. The calculation includes the uploaded one-hour storm and a dry hour. This is modelled water lost from drainage nodes, not a measurement of street flood depth or damage.

Select **LINK-TRUNK**, enter proposed diameter **0.60**, click **Test this pipe change**. Its original diameter is **0.30 m**. Expect approximately **148.722 m³** loss with the same engine. Only that pipe diameter changes. Compare the two results, select a result for playback, select **MH-C**, and use **Jump to this node's sampled peak**. The plotted depth is inside the node, measured from its invert. Run/input hashes and warnings remain visible. A difference gives a reason to investigate the option; it does not establish construction feasibility or cost effectiveness.

## Turn the result into accountable follow-up

Click **Prepare pipe review**. The system fills the target, review scope and conditional calculation result. Enter **Responsible person / team** = `Township engineering team`. Keep the estimate blank: the saved cost remains unknown, not RM0. The notice confirms that both retained runs will be attached. Click **Save project draft**. The API independently verifies that both runs belong to this model and that the candidate changes the proposal's pipe. Save/export is available; approval and dispatch are outside this uploaded-site pilot.

In **Operations**, click **Record a problem**. Enter **Problem title** = `Water reported near the trunk drain`, **Location** = `Riverside example central road`, **Linked asset** = `LINK-TRUNK (conduit)`, **Source reference** = `DEMO-REPORT-01`, and leave **Report source** = `Synthetic demonstration`. Enter **What was reported?** = `Practice complaint for the uploaded fictional catchment; no real event is claimed.` Enter **Responsible person / team** = `Township engineering team` and an appropriate future **Due date**. Keep the current/past incident time and click **Save problem**. The register retains sources, investigation status and follow-up. Its records are browser-local and project-scoped.

In **Site map**, select **GRATE-3**, then **Record inspection**. Enter **Inspector** = `Demo inspector`, leave **Evidence source** = `Synthetic demonstration`, enter **Source reference** = `DEMO-INSPECTION-01`, keep a current/past **Captured at** time, and enter **Condition / notes** = `Practice visual inspection only. Verify inlet condition on site.` Enter **Visible grate coverage (%)** = `20`. An attachment is optional and must match its stated source; do not label a fictional file observed. Click **Save inspection**. It appears in **Evidence & inputs** with the project, source label and timestamp. Coverage does not silently change hydraulic capacity.

In **Evidence & inputs**, review missing-data messages, software assumptions, source filenames and hashes; download the original source. **Export project evidence** saves the normalized project, manifest, inspections, proposals and run records. Use the separate Operations exports for browser-local problem follow-up. Originals and native artifacts remain on the API. To reopen, return to **Projects**, open the saved project and load results under **Compare actions > Retained runs**.

## Demonstrate honest handling of incomplete data

Return to **Projects**, enter **Riverside incomplete survey**, upload [the incomplete example](../apps/web/public/site-examples/riverside-map-only.site.json), and click **Check my files**. Mapping is usable, while MH-C invert elevation, LINK-TRUNK diameter, catchments and rainfall are missing. Build the map: those gaps remain visible. **Compare actions** cannot run. The manager now has a specific data-collection list. To correct it, obtain the missing measurements, update the source and create a new reviewed import/model version.

## Real stakeholder files and boundary

Use existing GIS/survey/drain registers to export the documented CSV/JSON tables in one metric coordinate system. Surveyed x/y/elevations, pipe dimensions/roughness, outfall boundary conditions, catchment data and rainfall are required for the supported calculation. Road/building/terrain geometry builds the matching map. Column mapping handles different CSV headers. Original source text and hashes preserve the chain from upload to result. See [the full specification and sample pack](../apps/web/public/site-examples/README.md).

This upgrade implements ingestion and data-driven map/native calculations. It does not implement automatic CAD/PDF/GeoTIFF extraction, mobile/drone capture, continuous sensor ingestion, field calibration, a 2D street-flood solver or production multi-user governance. Those remain separate engineering work, with no automatic mock fallback.
