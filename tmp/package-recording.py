from pathlib import Path
import json, subprocess, html

root = Path('output/recorded-walkthrough').resolve()
raw = root / 'FloodOps-full-walkthrough.webm'
chapters = json.loads((root / 'replay-final/chapters.json').read_text())
duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(raw)],text=True).strip())
def stamp(t):
    seconds = int(t)
    return f'{seconds // 60:02d}:{seconds % 60:02d}'

metadata=[';FFMETADATA1','title=Township FloodOps - recorded operator walkthrough','comment=Actual visible Playwright clicks; synthetic demonstration; captioned, no narration.']
for i, chapter in enumerate(chapters):
    start = max(0, round(chapter['seconds']*1000))
    end = round((chapters[i+1]['seconds'] if i+1<len(chapters) else duration)*1000)
    title = chapter['title'].replace('=',r'\=').replace(';',r'\;').replace('#',r'\#')
    metadata += ['[CHAPTER]','TIMEBASE=1/1000',f'START={start}',f'END={max(start+1,end)}',f'title={title}']
(root/'video-chapters.ffmetadata').write_text('\n'.join(metadata)+'\n',encoding='utf-8')

readme = ['# Recorded FloodOps walkthrough','',
'Recorded with actual clicks and typing in a visible Playwright Chromium window on localhost:5173. The MP4 has burned-in step captions and click highlights, with no voice narration. The recording uses a separate browser context and fictional practice data. No original browser records were changed.','',
f'Length: {stamp(duration)}. Start with **FloodOps-walkthrough.mp4** or **Watch-walkthrough.html**. The original recording is **FloodOps-full-walkthrough.webm**.','',
'| Time | Action |','|---|---|']
readme += [f"| {stamp(c['seconds'])} | {c['title']} |" for c in chapters]
readme += ['', 'The workflow records a D07 complaint, uploads its synthetic inspection PDF, computes original/cleaning/larger-pipe cases, shows matching-input and browser/native reference checks, saves an engineering-review draft with unknown cost, exports evidence, and assigns a follow-up.', '',
'Observed in this recording: baseline R1 peak 60.0 cm, cleaning 59.8 cm, pipe option 7.7 cm; maximum simultaneous selected area above 15 cm 760/760/0 m2; approximate R1 durations 75/74/0 minutes. Five idealised reference checks passed. These results do not establish real-site or 2D street-depth validation.', '',
'The engineering-review proposal remains Draft. Its cost rates remain blank. The problem remains Investigating, assigned to Township engineering team with due date 2026-10-22; no contractor was contacted.', '',
'The replay-final folder contains exported proposal/problem JSON, CSV, selected screenshots, chapter timing and the isolated demo browser state. The browser state contains only the synthetic records from this run, including the PDF attachment.', '',
'Exact-entry instructions: ../../md/EXACT_DEMO_WALKTHROUGH.md. Re-recording script: ../../tests/e2e/record-walkthrough.cjs (run from the repository root; requires the verified temporary Playwright/encoder setup used in this session).']
(root/'README.md').write_text('\n'.join(readme)+'\n',encoding='utf-8')

buttons='\n'.join(f'<button onclick="seek({c["seconds"]})"><time>{stamp(c["seconds"])}</time>{html.escape(c["title"])}</button>' for c in chapters)
player='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FloodOps recorded walkthrough</title><style>body{margin:0;background:#eef3f5;color:#193044;font:15px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}h1{margin:0 0 6px;font-size:28px}p{color:#526a7c;margin:0 0 20px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:20px}video{width:100%;background:#162c3c;border-radius:12px;position:sticky;top:20px}nav{display:grid;gap:8px}button{text-align:left;border:1px solid #d8e3e8;border-radius:9px;background:white;padding:10px;color:#20394b;cursor:pointer;font:inherit}button:hover{border-color:#0a7c82;background:#e8f6f5}time{display:inline-block;width:52px;color:#0a7c82;font-weight:700}small{display:block;color:#60798a;margin-top:18px}@media(max-width:1000px){.layout{grid-template-columns:1fr}video{position:static}}</style><main><h1>FloodOps: from complaint to assigned engineering review</h1><p>Actual recorded browser clicks. Use the chapter buttons to jump to a step. Synthetic practice data; captions and click highlights; no voice narration.</p><div class="layout"><section><video id="v" controls preload="metadata" src="FloodOps-walkthrough.mp4"></video><small>Road results come from the FloodOps browser engine. The separate native checks use EPA SWMM. Reference checks do not establish real-site flood-depth accuracy.</small></section><nav>BUTTONS</nav></div></main><script>function seek(s){const v=document.getElementById('v');v.currentTime=s;v.play();}</script></html>'''
(root/'Watch-walkthrough.html').write_text(player.replace('BUTTONS',buttons).replace('src="FloodOps-walkthrough.mp4"','src="FloodOps-full-walkthrough.webm"'),encoding='utf-8')
print(json.dumps({'duration_seconds':duration,'chapters':len(chapters),'chapter_times':[(stamp(c['seconds']),c['title']) for c in chapters]},indent=2))
