"""Build the README's self-contained FloodOps architecture SVG. No dependencies."""
from html import escape
from pathlib import Path

OUT = Path(__file__).with_name('floodops-architecture.svg')
INK = '#28282e'
RED = '#c8102e'
GOLD = '#f1b43c'
PALE = '#f7e5e8'
BG = '#faf8f2'
parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1360" viewBox="0 0 1600 1360" role="img" aria-labelledby="title description">
<title id="title">FloodOps system architecture</title>
<desc id="description">The default browser portal imports INP, GeoJSON and ASC files, checks readiness, builds a React and Three.js workspace, and runs the TypeScript flood engine in a web worker. Rule-based AI decision support diagnoses baseline bottlenecks and ponding, generates pipe upsizing, relief pipe and extra inlet candidates, simulates them with the same browser engine, and ranks improving options for map pins and engineering review. This uses programmed rules, not machine learning or an LLM. Local browser storage uses IndexedDB for projects, retained runs and media and localStorage for the operations register. A separate illustrative demo can call the optional FastAPI service, which runs native EPA SWMM and retains SQLite metadata and local run files.</desc>
<rect width="1600" height="1360" rx="24" fill="{BG}"/>
<defs>
  <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerUnits="userSpaceOnUse" markerWidth="17" markerHeight="17" orient="auto-start-reverse"><path d="M2 2L10 6L2 10" fill="none" stroke="{INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>
</defs>
<style>text{{font-family:Arial,Helvetica,sans-serif;fill:{INK};text-anchor:middle}}.label{{font-size:27px;font-weight:700}}.sub{{font-size:20px;fill:#63616a}}.line{{fill:none;stroke:{INK};stroke-width:3;stroke-linecap:round;stroke-linejoin:round;marker-end:url(#arrow)}}.icon{{stroke:{INK};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}}.section{{font-size:18px;font-weight:700;letter-spacing:2px;text-anchor:start;fill:{RED}}}</style>
''']


def text(x, y, value, cls='label'):
    parts.append(f'<text x="{x}" y="{y}" class="{cls}">{escape(value)}</text>')


def line(d, both=False):
    attr = ' marker-start="url(#arrow)"' if both else ''
    parts.append(f'<path d="{d}" class="line"{attr}/>')


def icon(x, y, kind):
    shapes = {
        'files': f'''<path d="M-42-42H6L26-22V42H-42Z" fill="{PALE}"/><path d="M-25-53H23L43-33V31H-25Z" fill="{BG}"/><path d="M23-53V-33H43" fill="{PALE}"/><path d="M-10-13H23M-10 1H23M-10 15H11" stroke="{RED}"/>''',
        'portal': f'''<rect x="-52" y="-43" width="104" height="75" rx="8" fill="{PALE}"/><path d="M-59 33H59L51 45H-51Z" fill="{BG}"/><path d="M-52-25H52"/><circle cx="-39" cy="-34" r="2" fill="{RED}" stroke="none"/><path d="M-20 2L-6 16L23-12" stroke="{RED}" stroke-width="6"/>''',
        'workspace': f'''<rect x="-56" y="-44" width="112" height="78" rx="8" fill="{BG}"/><path d="M-12 35V48M12 35V48M-27 48H27"/><path d="M0-28L30-12V16L0 32L-30 16V-12Z" fill="{PALE}"/><path d="M-30-12L0 4L30-12M0 4V32" stroke="{RED}"/><path d="M0-28L30-12L0 4L-30-12Z" fill="{GOLD}"/>''',
        'engine': f'''<rect x="-39" y="-39" width="78" height="78" rx="10" fill="{PALE}"/><path d="M-24-39V-51M0-39V-51M24-39V-51M-24 39V51M0 39V51M24 39V51M-39-24H-51M-39 0H-51M-39 24H-51M39-24H51M39 0H51M39 24H51"/><path d="M5-25L-16 5H0L-6 26L19-6H3Z" fill="{RED}" stroke="{RED}"/>''',
        'results': f'''<rect x="-51" y="-44" width="102" height="86" rx="8" fill="{BG}"/><path d="M-31 23V-6H-17V23Z" fill="{PALE}"/><path d="M-7 23V-23H7V23Z" fill="{RED}"/><path d="M17 23V-14H31V23Z" fill="{GOLD}"/><path d="M-35 24H35"/>''',
        'database': f'''<path d="M-49-28V29C-49 51 49 51 49 29V-28" fill="{PALE}"/><ellipse cy="-28" rx="49" ry="17" fill="{BG}"/><path d="M-49-7C-49 15 49 15 49-7M-49 14C-49 36 49 36 49 14"/><circle cx="0" cy="26" r="4" fill="{RED}" stroke="none"/>''',
        'operations': f'''<rect x="-38" y="-43" width="76" height="93" rx="8" fill="{BG}"/><rect x="-19" y="-51" width="38" height="17" rx="5" fill="{GOLD}"/><path d="M-21-13L-16-8L-8-18M1-13H23M-21 10L-16 15L-8 5M1 10H23M-21 33H23" stroke="{RED}"/>''',
        'demo': f'''<rect x="-51" y="-42" width="102" height="78" rx="8" fill="{BG}"/><path d="M-51-25H51"/><path d="M-9-10L17 6L-9 22Z" fill="{GOLD}"/><path d="M-15 37V47M15 37V47M-28 47H28"/>''',
        'api': f'''<rect x="-49" y="-43" width="98" height="32" rx="7" fill="{PALE}"/><rect x="-49" y="-5" width="98" height="32" rx="7" fill="{PALE}"/><path d="M-34-32V-22M-23-32V-22M-34 6V16M-23 6V16"/><circle cx="30" cy="-27" r="4" fill="{RED}" stroke="none"/><circle cx="30" cy="11" r="4" fill="{GOLD}" stroke="none"/><path d="M0 28V46M-25 46H25"/>''',
        'swmm': f'''<rect x="-47" y="-44" width="94" height="90" rx="8" fill="{BG}"/><path d="M-25-12H2V18H27M-25 18H2" fill="none" stroke="{RED}" stroke-width="6"/><circle cx="-25" cy="-12" r="7" fill="{GOLD}"/><circle cx="-25" cy="18" r="7" fill="{GOLD}"/><circle cx="27" cy="18" r="7" fill="{GOLD}"/><path d="M-27-30H27" stroke="{RED}"/>''',
        'evidence': f'''<path d="M-51-28V26C-51 43 17 43 17 26V-28" fill="{PALE}"/><ellipse cx="-17" cy="-28" rx="34" ry="12" fill="{BG}"/><path d="M-51-2C-51 15 17 15 17-2"/><path d="M7-10H38L53 5V48H7Z" fill="{BG}"/><path d="M38-10V5H53M19 20H41M19 32H36" stroke="{RED}"/>''',
    }
    parts.append(f'<g class="icon" fill="none" transform="translate({x} {y})">{shapes[kind]}</g>')


# Header and primary browser path.
parts.append(f'<text x="800" y="82" style="font-size:46px;font-weight:700">FloodOps System Architecture</text>')
text(800, 125, 'From site files to an evidence-linked decision', 'sub')
text(80, 193, 'DEFAULT · IN YOUR BROWSER', 'section')

for x, kind, label, sub in [
    (150, 'files', 'Site files', '.inp · .geojson · .asc'),
    (465, 'portal', 'Import & checks', 'Geometry · model readiness'),
    (780, 'workspace', '3D workspace', 'React · Three.js'),
    (1095, 'engine', 'Flood engine', 'TypeScript · Web Worker'),
    (1410, 'results', 'Results & compare', 'Frames · metrics · options'),
]:
    icon(x, 284, kind)
    text(x, 375, label)
    text(x, 409, sub, 'sub')

for start, end in [(217, 395), (534, 710), (850, 1024), (1165, 1338)]:
    line(f'M{start} 284H{end}')

# Automated suggestions: programmed rules generate candidates; simulation tests them.
line('M1410 437V455H40V575H80')
text(800, 444, 'Baseline results', 'sub')
text(80, 497, 'RULE-BASED AI · SIMULATION-BASED DECISION SUPPORT', 'section')
for x, kind, label, sub, detail in [
    (150, 'portal', 'Diagnose problems', 'Bottlenecks · ponding', 'Up to 3 detected problems'),
    (570, 'swmm', 'Generate fixes', 'Upsize · relief pipe · extra inlet', 'Up to 8 candidate fixes'),
    (990, 'engine', 'Simulate candidates', 'Same browser flood engine', 'Same rain · baseline comparison'),
    (1410, 'results', 'Rank & recommend', 'Improvement · indicative cost', 'Map pins · before / after'),
]:
    icon(x, 575, kind)
    text(x, 662, label)
    text(x, 696, sub, 'sub')
    text(x, 726, detail, 'sub')
for start, end in [(222, 495), (642, 916), (1062, 1338)]:
    line(f'M{start} 575H{end}')
text(800, 783, 'Programmed rules · no ML / LLM · uncalibrated results require engineering review', 'sub')

# Persistence and investigation output: retained runs are saved when accepted.
icon(780, 875, 'database')
text(780, 961, 'Browser storage')
text(780, 995, 'IndexedDB + localStorage', 'sub')

icon(1410, 875, 'operations')
text(1410, 961, 'Operations & drafts')
text(1410, 995, 'Evidence · follow-up · exports', 'sub')
line('M1410 747V812')
line('M1340 875H850', both=True)
text(1095, 859, 'Save / reopen', 'sub')

# Explicit alternate route: the default portal does not invoke this API.
parts.append('<path d="M80 1035H1520" stroke="#ded8cd" stroke-width="2"/>')
text(80, 1085, 'OPTIONAL · ILLUSTRATIVE DEMO API MODE', 'section')

for x, kind, label, sub in [
    (150, 'demo', 'Illustrative demo', 'Explicit API mode'),
    (570, 'api', 'FastAPI service', 'Python · API contracts'),
    (990, 'swmm', 'Native EPA SWMM', 'Network simulation'),
    (1410, 'evidence', 'Retained evidence', 'SQLite metadata · local files'),
]:
    icon(x, 1181, kind)
    text(x, 1268, label)
    text(x, 1302, sub, 'sub')

line('M222 1181H495', both=True)
line('M642 1181H916', both=True)
line('M1062 1181H1338')
text(1200, 1161, 'Run outputs', 'sub')

parts.append('</svg>')
OUT.write_text('\n'.join(parts), encoding='utf-8')
print(OUT)
