from __future__ import annotations

import base64
import hashlib
import http.server
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
import zipfile
import ctypes
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SUPPORTED_EXTS = {'.shp','.shx','.dbf','.prj','.cpg','.xlsx','.xls','.csv','.geojson','.json'}
MAX_UPLOAD = 300 * 1024 * 1024
TARGET_SITE = 'https://www.landsurvey-eg.com:2410/'
TARGET_HOST_TOKEN = 'landsurvey-eg.com'
TARGET_FILE_INPUT = '#attach_cad_img'
DEBUG_PORT = None
# Keep one persistent browser profile outside the extracted GeoAudit version folder.
# This lets the work-site login/password/session survive app upgrades and new ZIP folders.
_PERSIST_ROOT = Path(os.environ.get('LOCALAPPDATA') or (Path.home() / '.geoaudit_studio')) / 'GeoAuditStudio'
_PERSIST_ROOT.mkdir(parents=True, exist_ok=True)
PROFILE_DIR = _PERSIST_ROOT / 'BrowserProfile'
TOOLS_DIR = _PERSIST_ROOT / 'Tools'
TOOLS_DIR.mkdir(parents=True, exist_ok=True)
UNRAR_EXE = TOOLS_DIR / 'UnRAR.exe'
UNRAR_BOOTSTRAP = TOOLS_DIR / 'unrarw64.exe'
UNRAR_OFFICIAL_URL = 'https://www.rarlab.com/rar/unrarw64.exe'
BROWSER_PROCESS = None
FIREFOX_PROCESS = None
FIREFOX_DEBUG_PORT = 9224
FIREFOX_PROFILE_DIR = ROOT / '.GeoAuditFirefoxProfile'
BIDI_CLIENT = None
BIDI_LOCK = threading.RLock()

# Watches the user's Downloads folder for newly-downloaded Shapefile archives.
DOWNLOADS_DIR = Path.home() / 'Downloads'
DOWNLOAD_WATCH_LOCK = threading.RLock()
DOWNLOAD_WATCH_SEEN = set()
DOWNLOAD_WATCH_EXTS = {'.zip', '.rar'}

def _download_key(path: Path):
    try:
        st = path.stat()
        return (str(path.resolve()).lower(), int(st.st_mtime_ns), int(st.st_size))
    except Exception:
        return (str(path).lower(), 0, 0)

def _ignore_auto_download(path: Path):
    name = path.name.lower()
    return (name.startswith('boundary-wgs84-') or name.startswith('geoaudit-') or
            name.startswith('cad_') or name.endswith('.crdownload') or name.endswith('.part'))

def _archive_contains_shapefile(path: Path):
    try:
        if path.suffix.lower() == '.zip':
            if not zipfile.is_zipfile(path):
                return False
            with zipfile.ZipFile(path, 'r') as zf:
                return any(str(n).lower().endswith('.shp') for n in zf.namelist())
        if path.suffix.lower() == '.rar':
            with tempfile.TemporaryDirectory(prefix='GeoAuditWatch_') as td:
                out = Path(td) / 'out'; out.mkdir()
                ok, _, _ = extract_rar(path, out)
                if not ok:
                    return False
                normalize_extracted_names(out)
                return any(x.is_file() and x.suffix.lower() == '.shp' for x in out.rglob('*'))
    except Exception:
        return False
    return False

def initialize_download_watch():
    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        with DOWNLOAD_WATCH_LOCK:
            for path in DOWNLOADS_DIR.iterdir():
                if path.is_file() and path.suffix.lower() in DOWNLOAD_WATCH_EXTS:
                    DOWNLOAD_WATCH_SEEN.add(_download_key(path))
    except Exception:
        pass

def next_downloaded_shapefile():
    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        candidates = [p for p in DOWNLOADS_DIR.iterdir() if p.is_file() and p.suffix.lower() in DOWNLOAD_WATCH_EXTS and not _ignore_auto_download(p)]
        candidates.sort(key=lambda p: p.stat().st_mtime, reverse=False)
        now = time.time()
        with DOWNLOAD_WATCH_LOCK:
            for path in candidates:
                key = _download_key(path)
                if key in DOWNLOAD_WATCH_SEEN:
                    continue
                try:
                    # Wait until the browser has finished writing the file.
                    if now - path.stat().st_mtime < 0.9:
                        continue
                except Exception:
                    continue
                DOWNLOAD_WATCH_SEEN.add(key)
                if _archive_contains_shapefile(path):
                    return path
    except Exception:
        pass
    return None


def extractor_candidates():
    seen = set(); candidates = []
    def add(label, path, build):
        if not path: return
        p = Path(path)
        if p.exists() and str(p).lower() not in seen:
            seen.add(str(p).lower()); candidates.append((label, str(p), build))
    # GeoAudit's persistent UnRAR comes first once bootstrapped.
    add('GeoAudit UnRAR', UNRAR_EXE, lambda exe, src, dst: [exe, 'x', '-y', str(src), str(dst) + os.sep])
    for name in ('tar.exe', 'tar'):
        add('Windows tar', shutil.which(name), lambda exe, src, dst: [exe, '-xf', str(src), '-C', str(dst)])
    for name in ('7z.exe', '7zz.exe', '7z', '7zz'):
        add('7-Zip', shutil.which(name), lambda exe, src, dst: [exe, 'x', '-y', f'-o{dst}', str(src)])
    pf = os.environ.get('ProgramFiles'); pfx86 = os.environ.get('ProgramFiles(x86)')
    for base in filter(None, (pf, pfx86)):
        add('7-Zip', Path(base) / '7-Zip' / '7z.exe', lambda exe, src, dst: [exe, 'x', '-y', f'-o{dst}', str(src)])
        add('WinRAR UnRAR', Path(base) / 'WinRAR' / 'UnRAR.exe', lambda exe, src, dst: [exe, 'x', '-y', str(src), str(dst) + os.sep])
        add('WinRAR', Path(base) / 'WinRAR' / 'WinRAR.exe', lambda exe, src, dst: [exe, 'x', '-y', str(src), str(dst) + os.sep])
    return candidates


def ensure_geoaudit_unrar():
    """Download and silently unpack the official RARLAB Windows UnRAR once, then reuse it."""
    if os.name != 'nt':
        return None, 'Automatic UnRAR bootstrap is Windows-only.'
    if UNRAR_EXE.exists() and UNRAR_EXE.stat().st_size > 100_000:
        return UNRAR_EXE, ''
    try:
        TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(UNRAR_OFFICIAL_URL, headers={'User-Agent':'GeoAudit-Studio/1.0'})
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = resp.read(5 * 1024 * 1024)
        if len(payload) < 100_000 or payload[:2] != b'MZ':
            raise RuntimeError('RARLAB download did not return a valid Windows executable.')
        UNRAR_BOOTSTRAP.write_bytes(payload)
        # RARLAB's unrarw64.exe is a self-extracting package. /s extracts silently to cwd.
        creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        subprocess.Popen([str(UNRAR_BOOTSTRAP), '/s'], cwd=str(TOOLS_DIR),
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         creationflags=creationflags)
        deadline = time.time() + 30
        found = None
        while time.time() < deadline:
            if UNRAR_EXE.exists() and UNRAR_EXE.stat().st_size > 100_000:
                found = UNRAR_EXE; break
            matches = list(TOOLS_DIR.rglob('UnRAR.exe')) + list(TOOLS_DIR.rglob('unrar.exe'))
            if matches:
                found = matches[0]
                if found.resolve() != UNRAR_EXE.resolve():
                    shutil.copy2(found, UNRAR_EXE)
                break
            time.sleep(0.25)
        if not found or not UNRAR_EXE.exists():
            raise RuntimeError('Official UnRAR package finished but UnRAR.exe was not found.')
        try: UNRAR_BOOTSTRAP.unlink(missing_ok=True)
        except Exception: pass
        return UNRAR_EXE, ''
    except Exception as exc:
        return None, str(exc)


def _clear_dir(dst: Path):
    for child in dst.iterdir():
        shutil.rmtree(child, ignore_errors=True) if child.is_dir() else child.unlink(missing_ok=True)


def _run_extractor(label, exe, build, src: Path, dst: Path):
    _clear_dir(dst)
    proc = subprocess.run(build(exe, src, dst), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, errors='replace', timeout=180,
                          creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0))
    files = [p for p in dst.rglob('*') if p.is_file()]
    return proc.returncode == 0 and bool(files), proc.stdout


def extract_rar(src: Path, dst: Path):
    logs = []
    attempted = set()
    for label, exe, build in extractor_candidates():
        try:
            attempted.add(str(exe).lower())
            ok, output = _run_extractor(label, exe, build, src, dst)
            if ok: return True, label, output
            logs.append(f'{label}: extraction failed\n{output}')
        except Exception as exc:
            logs.append(f'{label}: {exc}')

    # No installed extractor worked. Bootstrap official freeware UnRAR automatically.
    unrar, bootstrap_error = ensure_geoaudit_unrar()
    if unrar and str(unrar).lower() not in attempted:
        try:
            ok, output = _run_extractor('GeoAudit UnRAR (auto)', str(unrar),
                lambda exe, s, d: [exe, 'x', '-y', str(s), str(d) + os.sep], src, dst)
            if ok: return True, 'GeoAudit UnRAR', output
            logs.append('GeoAudit UnRAR: extraction failed\n' + output)
        except Exception as exc:
            logs.append(f'GeoAudit UnRAR: {exc}')
    elif bootstrap_error:
        logs.append('GeoAudit UnRAR bootstrap: ' + bootstrap_error)
    return False, '', '\n\n'.join(logs)


def normalize_extracted_names(root: Path):
    """Repair common malformed sidecar names such as 'poly.shp .dbf' -> 'poly.dbf'."""
    for p in sorted([x for x in root.rglob('*') if x.is_file()], key=lambda x: len(str(x)), reverse=True):
        name = p.name.strip()
        fixed = re.sub(r'(?i)\.shp\s+\.(shp|shx|dbf|prj|cpg)$', r'.\1', name)
        fixed = re.sub(r'(?i)\s+\.(shp|shx|dbf|prj|cpg)$', r'.\1', fixed)
        if fixed == p.name:
            continue
        target = p.with_name(fixed)
        if target.exists():
            continue
        try:
            p.rename(target)
        except Exception:
            pass


def find_browser():
    candidates = []
    for name in ('msedge.exe','msedge','chrome.exe','chrome'):
        p = shutil.which(name)
        if p: candidates.append(Path(p))
    pf = os.environ.get('ProgramFiles',''); pfx86 = os.environ.get('ProgramFiles(x86)',''); local = os.environ.get('LOCALAPPDATA','')
    for p in [
        Path(pf) / 'Microsoft/Edge/Application/msedge.exe' if pf else None,
        Path(pfx86) / 'Microsoft/Edge/Application/msedge.exe' if pfx86 else None,
        Path(pf) / 'Google/Chrome/Application/chrome.exe' if pf else None,
        Path(pfx86) / 'Google/Chrome/Application/chrome.exe' if pfx86 else None,
        Path(local) / 'Google/Chrome/Application/chrome.exe' if local else None,
        Path(local) / 'Microsoft/Edge/Application/msedge.exe' if local else None,
    ]:
        if p and p.exists(): candidates.append(p)
    seen=set()
    for p in candidates:
        s=str(p).lower()
        if s not in seen and p.exists():
            seen.add(s); return str(p)
    return None


def cdp_alive():
    if not isinstance(DEBUG_PORT, int) or DEBUG_PORT <= 0:
        return False
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{DEBUG_PORT}/json/version', timeout=0.8) as r:
            return r.status == 200
    except Exception:
        return False


def list_cdp_pages():
    """Return all controllable Chromium page targets for the exact GeoAudit CDP session."""
    if not cdp_alive():
        return []
    last_error = None
    for endpoint in ('json/list', 'json'):
        try:
            req = urllib.request.Request(
                f'http://127.0.0.1:{DEBUG_PORT}/{endpoint}',
                headers={'Cache-Control': 'no-cache'}
            )
            with urllib.request.urlopen(req, timeout=2.0) as r:
                data = json.loads(r.read().decode('utf-8', errors='replace'))
            if not isinstance(data, list):
                continue
            pages = []
            seen = set()
            for item in data:
                if not isinstance(item, dict):
                    continue
                target_type = str(item.get('type') or '').lower()
                if target_type and target_type not in ('page', 'webview', 'iframe'):
                    continue
                ws = str(item.get('webSocketDebuggerUrl') or '')
                if not ws:
                    continue
                key = item.get('id') or ws
                if key in seen:
                    continue
                seen.add(key)
                pages.append(item)
            return pages
        except Exception as exc:
            last_error = exc
    try:
        (ROOT / '.GeoAuditLastSendDebug.json').write_text(
            json.dumps({'port': DEBUG_PORT, 'listPagesError': str(last_error)}, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
    except Exception:
        pass
    return []


def pick_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return int(s.getsockname()[1])


def _session_info_path():
    return _PERSIST_ROOT / 'GeoAuditBrowserSession.json'


def terminate_previous_browser():
    """Terminate only the dedicated browser process started by a previous GeoAudit run."""
    info_path = _session_info_path()
    try:
        if not info_path.exists():
            return
        info = json.loads(info_path.read_text(encoding='utf-8'))
        pid = int(info.get('pid') or 0)
        if pid > 0 and os.name == 'nt':
            subprocess.run(['taskkill','/PID',str(pid),'/T','/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
            time.sleep(.6)
    except Exception:
        pass
    try:
        info_path.unlink(missing_ok=True)
    except Exception:
        pass


def get_screen_size():
    """Return the primary Windows work area-ish size; safe fallback elsewhere."""
    try:
        if os.name == 'nt':
            user32 = ctypes.windll.user32
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass
            return int(user32.GetSystemMetrics(0)), int(user32.GetSystemMetrics(1))
    except Exception:
        pass
    return 1920, 1080


def launch_chromium_controlled_browser(geoaudit_url: str):
    """Launch exactly one dedicated Chromium debugging session for this GeoAudit run."""
    global BROWSER_PROCESS, DEBUG_PORT
    exe = find_browser()
    if not exe:
        print('[GeoAudit] Edge/Chrome not found; opening GeoAudit in default browser.')
        webbrowser.open(geoaudit_url)
        return False

    # Prevent stale debug sessions from older builds from receiving the CAD image.
    terminate_previous_browser()
    DEBUG_PORT = pick_free_port()
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    print(f'[GeoAudit] Persistent browser profile: {PROFILE_DIR}')
    print('[GeoAudit] Log in once to the work site and choose Save password if the browser asks; future GeoAudit versions reuse the same profile.')
    sw, sh = get_screen_size()
    half = max(640, sw // 2)
    right_w = max(640, sw - half)
    common = [
        exe,
        f'--remote-debugging-port={DEBUG_PORT}',
        '--remote-allow-origins=*',
        f'--user-data-dir={PROFILE_DIR}',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=Translate',
    ]

    args = common + [
        '--new-window',
        '--window-position=0,0',
        f'--window-size={half},{sh}',
        TARGET_SITE,
    ]
    try:
        BROWSER_PROCESS = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        _session_info_path().write_text(json.dumps({'pid':BROWSER_PROCESS.pid,'port':DEBUG_PORT,'started':time.time()}), encoding='utf-8')
    except Exception as exc:
        print(f'[GeoAudit] Could not launch controlled browser: {exc}')
        webbrowser.open(geoaudit_url)
        return False

    for _ in range(120):
        if cdp_alive():
            break
        time.sleep(.1)
    if not cdp_alive():
        print('[GeoAudit] Browser started but DevTools control did not become available.')
        return False

    # Open GeoAudit in the same exact controlled browser/profile.
    try:
        subprocess.Popen([
            exe,
            f'--user-data-dir={PROFILE_DIR}',
            '--new-window',
            f'--window-position={half},0',
            f'--window-size={right_w},{sh}',
            geoaudit_url,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as exc:
        print(f'[GeoAudit] Could not open GeoAudit window: {exc}')
        webbrowser.open(geoaudit_url)
    return True


def find_firefox():
    candidates=[]
    for name in ('firefox.exe','firefox'):
        p=shutil.which(name)
        if p: candidates.append(Path(p))
    pf=os.environ.get('ProgramFiles',''); pfx86=os.environ.get('ProgramFiles(x86)','')
    local=os.environ.get('LOCALAPPDATA','')
    for p in [
        Path(pf)/'Mozilla Firefox/firefox.exe' if pf else None,
        Path(pfx86)/'Mozilla Firefox/firefox.exe' if pfx86 else None,
        Path(local)/'Mozilla Firefox/firefox.exe' if local else None,
    ]:
        if p and p.exists(): candidates.append(p)
    seen=set()
    for p in candidates:
        key=str(p).lower()
        if key not in seen and p.exists():
            seen.add(key); return str(p)
    return None


class BiDiClient:
    def __init__(self, ws_url: str):
        self.ws_url=ws_url; self.sock=None; self.next_id=1; self.session_id=None; self.lock=threading.RLock()

    def connect(self):
        with self.lock:
            if self.sock: return
            self.sock=ws_connect(self.ws_url)
            resp=self.command('session.new', {'capabilities': {'alwaysMatch': {'browserName':'firefox','acceptInsecureCerts':True}}})
            if resp.get('type')!='success':
                raise RuntimeError(f"Firefox BiDi session failed: {resp}")
            self.session_id=resp.get('result',{}).get('sessionId')

    def close(self):
        with self.lock:
            try:
                if self.sock: self.sock.close()
            except Exception: pass
            self.sock=None; self.session_id=None

    def command(self, method: str, params: dict | None=None, timeout: float=12.0):
        with self.lock:
            if not self.sock and method!='session.new':
                self.connect()
            cid=self.next_id; self.next_id+=1
            ws_send_text(self.sock, json.dumps({'id':cid,'method':method,'params':params or {}}, ensure_ascii=False))
            deadline=time.time()+timeout
            while time.time()<deadline:
                msg=ws_recv_message(self.sock)
                if not isinstance(msg,str): continue
                obj=json.loads(msg)
                if obj.get('id')==cid: return obj
            raise TimeoutError(f'BiDi timeout: {method}')


def firefox_bidi_port_alive():
    try:
        with socket.create_connection(('127.0.0.1',FIREFOX_DEBUG_PORT), timeout=.5): return True
    except Exception: return False


def ensure_bidi_client():
    global BIDI_CLIENT
    with BIDI_LOCK:
        if BIDI_CLIENT and BIDI_CLIENT.sock:
            try:
                r=BIDI_CLIENT.command('browsingContext.getTree', {}, 3.0)
                if r.get('type')=='success': return BIDI_CLIENT
            except Exception:
                try: BIDI_CLIENT.close()
                except Exception: pass
                BIDI_CLIENT=None
        if not firefox_bidi_port_alive(): return None
        c=BiDiClient(f'ws://127.0.0.1:{FIREFOX_DEBUG_PORT}/session')
        try:
            c.connect(); BIDI_CLIENT=c; return c
        except Exception as exc:
            print(f'[GeoAudit] Firefox BiDi connect failed: {exc}')
            try: c.close()
            except Exception: pass
            return None


def _bidi_flatten_contexts(items):
    out=[]
    for item in items or []:
        out.append(item)
        out.extend(_bidi_flatten_contexts(item.get('children') or []))
    return out


def launch_firefox_controlled_browser(geoaudit_url: str):
    """Launch a dedicated Firefox BiDi session and make two side-by-side windows."""
    global FIREFOX_PROCESS, BIDI_CLIENT
    exe=find_firefox()
    if not exe: return False
    FIREFOX_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    args=[exe,'-no-remote','-profile',str(FIREFOX_PROFILE_DIR),f'--remote-debugging-port={FIREFOX_DEBUG_PORT}','about:blank']
    try:
        FIREFOX_PROCESS=subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as exc:
        print(f'[GeoAudit] Could not launch Firefox: {exc}'); return False
    for _ in range(120):
        if firefox_bidi_port_alive(): break
        time.sleep(.1)
    if not firefox_bidi_port_alive():
        print('[GeoAudit] Firefox started but WebDriver BiDi did not become available.'); return False
    client=None
    for _ in range(40):
        client=ensure_bidi_client()
        if client: break
        time.sleep(.15)
    if not client: return False
    try:
        tree=client.command('browsingContext.getTree', {})
        contexts=_bidi_flatten_contexts(tree.get('result',{}).get('contexts',[]))
        top=[c for c in contexts if c.get('parent') is None]
        if top:
            left_ctx=top[0]['context']
            client.command('browsingContext.navigate', {'context':left_ctx,'url':TARGET_SITE,'wait':'interactive'}, 30)
        else:
            created=client.command('browsingContext.create', {'type':'window'})
            left_ctx=created.get('result',{}).get('context')
            if left_ctx: client.command('browsingContext.navigate', {'context':left_ctx,'url':TARGET_SITE,'wait':'interactive'}, 30)
        created=client.command('browsingContext.create', {'type':'window'})
        right_ctx=created.get('result',{}).get('context')
        if right_ctx: client.command('browsingContext.navigate', {'context':right_ctx,'url':geoaudit_url,'wait':'interactive'}, 20)
        # Position the two Firefox windows if supported.
        time.sleep(.5)
        tree2=client.command('browsingContext.getTree', {})
        tops=[c for c in _bidi_flatten_contexts(tree2.get('result',{}).get('contexts',[])) if c.get('parent') is None]
        by_ctx={c.get('context'):c for c in tops}
        sw,sh=get_screen_size(); half=max(620,sw//2)
        left_win=by_ctx.get(left_ctx,{}).get('clientWindow'); right_win=by_ctx.get(right_ctx,{}).get('clientWindow')
        if left_win:
            try: client.command('browser.setClientWindowState', {'clientWindow':left_win,'state':'normal','x':0,'y':0,'width':half,'height':sh},8)
            except Exception: pass
        if right_win:
            try: client.command('browser.setClientWindowState', {'clientWindow':right_win,'state':'normal','x':half,'y':0,'width':max(620,sw-half),'height':sh},8)
            except Exception: pass
        return True
    except Exception as exc:
        print(f'[GeoAudit] Firefox setup failed: {exc}'); return False


def inject_file_into_work_site_firefox(data_url: str, filename: str):
    """Put the generated CAD image into the work-site #attach_cad_img field.

    V2 deliberately does not depend on browsingContext.locateNodes alone.  Some
    Firefox builds/pages can expose the element to JavaScript while locateNodes
    returns no result (especially after tabbed UI updates).  We therefore scan
    every browsing context/iframe with script.evaluate, obtain the DOM node's
    WebDriver BiDi sharedId, then call input.setFiles on that exact node.
    """
    client=ensure_bidi_client()
    if not client:
        return False, 'جلسة Firefox الخاصة بـ GeoAudit غير متاحة. شغّل START_GeoAudit.bat.'

    try:
        b64=data_url.split(',',1)[1] if ',' in data_url else data_url
        raw=base64.b64decode(b64, validate=False)
        if not raw: raise ValueError('empty image')
    except Exception as exc:
        return False, f'تعذر تجهيز صورة الأوتوكاد: {exc}'

    out_dir=ROOT/'.GeoAuditSentCad'; out_dir.mkdir(parents=True, exist_ok=True)
    safe_base=''.join(ch for ch in Path(filename or 'GeoAudit-CAD.png').stem if ch.isalnum() or ch in ('-','_')) or 'GeoAudit-CAD'
    file_path=out_dir/f'{safe_base}-{int(time.time()*1000)}.png'
    file_path.write_bytes(raw)
    abs_path=str(file_path.resolve())

    selector = '#attach_cad_img'
    try:
        # Retry briefly because the site's tab can be changing/rendering at the
        # exact moment the user presses Send.
        last='INPUT_NOT_FOUND'
        for attempt in range(4):
            tree=client.command('browsingContext.getTree', {})
            contexts=_bidi_flatten_contexts(tree.get('result',{}).get('contexts',[]))

            # Search every non-GeoAudit context, not only URLs containing the host.
            # This also covers iframes whose own URL differs from the top-level URL.
            ordered=[]
            for c in contexts:
                url=str(c.get('url',''))
                score=0
                if TARGET_HOST_TOKEN.lower() in url.lower(): score += 100
                if url.startswith('http://127.0.0.1:') or url.startswith('http://localhost:'): score -= 100
                ordered.append((score,c))
            ordered.sort(key=lambda x:x[0], reverse=True)

            any_work_site=False
            for score,ctx in ordered:
                cid=ctx.get('context')
                if not cid: continue
                url=str(ctx.get('url',''))
                if TARGET_HOST_TOKEN.lower() in url.lower(): any_work_site=True

                # First ask page JavaScript for the exact element. A DOM node returned
                # by script.evaluate is a NodeRemoteValue and carries a sharedId.
                ev=client.command('script.evaluate', {
                    'expression': "document.querySelector('#attach_cad_img')",
                    'target':{'context':cid},
                    'awaitPromise':False,
                    'resultOwnership':'root',
                    'serializationOptions':{'maxObjectDepth':0,'maxDomDepth':0}
                },8)
                remote=ev.get('result',{}).get('result',{}) if ev.get('type')=='success' else {}
                shared=remote.get('sharedId') if isinstance(remote,dict) else None

                # Fallback for Firefox versions where evaluate serializes the node
                # differently but locateNodes works.
                if not shared:
                    try:
                        loc=client.command('browsingContext.locateNodes', {
                            'context':cid,
                            'locator':{'type':'css','value':selector},
                            'maxNodeCount':1
                        },6)
                        nodes=loc.get('result',{}).get('nodes') or [] if loc.get('type')=='success' else []
                        if nodes: shared=nodes[0].get('sharedId')
                    except Exception as exc:
                        last=f'LOCATE:{exc}'

                if not shared:
                    continue

                setr=client.command('input.setFiles', {
                    'context':cid,
                    'element':{'sharedId':shared},
                    'files':[abs_path]
                },12)
                if setr.get('type')!='success':
                    last=f'SET_FILES:{setr}'
                    continue

                # Dispatch the same events the page receives after a manual Browse.
                vr=client.command('script.evaluate', {
                    'expression': """(() => {
                      const i=document.querySelector('#attach_cad_img');
                      if(!i) return JSON.stringify({ok:false,reason:'NO_INPUT'});
                      i.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
                      i.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
                      try { i.scrollIntoView({block:'center',behavior:'smooth'}); } catch(e) {}
                      const oldOutline=i.style.outline, oldOffset=i.style.outlineOffset;
                      i.style.outline='3px solid #2563eb'; i.style.outlineOffset='3px';
                      setTimeout(()=>{i.style.outline=oldOutline;i.style.outlineOffset=oldOffset},1800);
                      return JSON.stringify({ok:true,count:(i.files&&i.files.length)||0,name:(i.files&&i.files[0]&&i.files[0].name)||'',url:location.href});
                    })()""",
                    'target':{'context':cid},
                    'awaitPromise':False,
                    'resultOwnership':'none'
                },8)
                val=vr.get('result',{}).get('result',{}).get('value') if vr.get('type')=='success' else None
                try:
                    parsed=json.loads(val) if isinstance(val,str) else {}
                except Exception:
                    parsed={}
                if parsed.get('ok') and int(parsed.get('count') or 0)>0:
                    try: client.command('browsingContext.activate', {'context':cid},5)
                    except Exception: pass
                    return True, f"تم إرسال صورة الأوتوكاد ووضعها في الخانة تلقائيًا: {parsed.get('name') or Path(abs_path).name}"

                # input.setFiles itself succeeded, so even if the verification return
                # was unusual, make one lightweight confirmation query.
                confirm=client.command('script.evaluate', {
                    'expression': "(() => { const i=document.querySelector('#attach_cad_img'); return i&&i.files?i.files.length:0; })()",
                    'target':{'context':cid},'awaitPromise':False,'resultOwnership':'none'
                },5)
                count=confirm.get('result',{}).get('result',{}).get('value') if confirm.get('type')=='success' else 0
                if isinstance(count,(int,float)) and count>0:
                    try: client.command('browsingContext.activate', {'context':cid},5)
                    except Exception: pass
                    return True, 'تم إرسال صورة الأوتوكاد ووضعها في الخانة تلقائيًا.'
                last=f'VERIFY:{val or confirm}'

            if not any_work_site:
                last='WORK_SITE_CONTEXT_NOT_SEEN'
            time.sleep(.45)

        return False, ('لم أجد خانة صورة الأوتوكاد في سياق Firefox الذي يتحكم فيه GeoAudit. '
                       'تأكد فقط أن صفحة السجل المفتوحة هي نفسها داخل النافذة اليسرى التي فتحها START_GeoAudit.bat. '
                       f'({last})')
    except Exception as exc:
        return False, f'تعذر التحكم في Firefox: {exc}'

def launch_controlled_browser(geoaudit_url: str):
    # V3 intentionally uses one exact Chromium DevTools session only.
    # This removes ambiguity with stale Firefox/Edge sessions from older builds.
    return launch_chromium_controlled_browser(geoaudit_url)


def recv_exact(sock, n):
    chunks=[]; got=0
    while got<n:
        b=sock.recv(n-got)
        if not b: raise ConnectionError('WebSocket closed')
        chunks.append(b); got += len(b)
    return b''.join(chunks)


def ws_connect(ws_url: str):
    u=urllib.parse.urlparse(ws_url)
    host=u.hostname or '127.0.0.1'; port=u.port or 80
    s=socket.create_connection((host, port), timeout=5)
    key=base64.b64encode(os.urandom(16)).decode('ascii')
    path=u.path + (('?' + u.query) if u.query else '')
    req=(f'GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
         f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nOrigin: http://127.0.0.1\r\n\r\n')
    s.sendall(req.encode('ascii'))
    buf=b''
    while b'\r\n\r\n' not in buf:
        part=s.recv(4096)
        if not part: break
        buf += part
        if len(buf)>65536: break
    if b' 101 ' not in buf.split(b'\r\n',1)[0]:
        s.close(); raise ConnectionError('CDP WebSocket handshake failed')
    return s


def ws_send_text(sock, text: str):
    payload=text.encode('utf-8'); n=len(payload); mask=os.urandom(4)
    header=bytearray([0x81])
    if n<126: header.append(0x80|n)
    elif n<65536: header.append(0x80|126); header.extend(struct.pack('!H',n))
    else: header.append(0x80|127); header.extend(struct.pack('!Q',n))
    header.extend(mask)
    masked=bytearray(n)
    for i,b in enumerate(payload): masked[i]=b ^ mask[i%4]
    sock.sendall(bytes(header)+bytes(masked))


def ws_recv_message(sock):
    fragments=[]; opcode0=None
    while True:
        b1,b2=recv_exact(sock,2)
        fin=bool(b1&0x80); opcode=b1&0x0f; masked=bool(b2&0x80); n=b2&0x7f
        if n==126: n=struct.unpack('!H',recv_exact(sock,2))[0]
        elif n==127: n=struct.unpack('!Q',recv_exact(sock,8))[0]
        mask=recv_exact(sock,4) if masked else None
        payload=bytearray(recv_exact(sock,n)) if n else bytearray()
        if mask:
            for i in range(len(payload)): payload[i] ^= mask[i%4]
        if opcode==0x9:  # ping -> pong
            # Minimal masked pong
            p=bytes(payload); m=os.urandom(4); h=bytearray([0x8A])
            if len(p)<126: h.append(0x80|len(p))
            else: continue
            h.extend(m); mp=bytes(v ^ m[i%4] for i,v in enumerate(p)); sock.sendall(bytes(h)+mp); continue
        if opcode==0x8: raise ConnectionError('CDP WebSocket closed')
        if opcode in (0x1,0x2): opcode0=opcode; fragments=[bytes(payload)]
        elif opcode==0x0: fragments.append(bytes(payload))
        else: continue
        if fin:
            data=b''.join(fragments)
            return data.decode('utf-8', errors='replace') if opcode0==0x1 else data


def cdp_command(ws_url: str, method: str, params: dict | None = None, command_id: int = 1):
    sock=ws_connect(ws_url)
    try:
        ws_send_text(sock, json.dumps({'id':command_id,'method':method,'params':params or {}}, ensure_ascii=False))
        deadline=time.time()+10
        while time.time()<deadline:
            msg=ws_recv_message(sock)
            if isinstance(msg,str):
                obj=json.loads(msg)
                if obj.get('id')==command_id: return obj
        raise TimeoutError('CDP response timeout')
    finally:
        try: sock.close()
        except Exception: pass


def _cdp_result_value(resp):
    try:
        return resp.get('result', {}).get('result', {}).get('value')
    except Exception:
        return None



def install_smart_copy_on_work_site(number_text: str, full_text: str, unit: str = ''):
    """Keep one Copy button, but paste the unit only inside the work-site description field."""
    if not cdp_alive():
        return False, 'browser-control-unavailable'
    pages = [p for p in list_cdp_pages() if TARGET_HOST_TOKEN.lower() in str(p.get('url','')).lower()]
    if not pages:
        return False, 'work-site-not-open'

    payload = {'number': str(number_text), 'full': str(full_text), 'unit': str(unit)}
    payload_js = json.dumps(payload, ensure_ascii=False)
    js_template = r"""(() => {
      const P = __PAYLOAD__;
      window.__geoAuditSmartCopy = P;
      const norm = s => String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
      const textOf = el => norm(el?.innerText || el?.textContent || '');

      function isDescriptionField(el){
        if(!el || !['TEXTAREA','INPUT'].includes(el.tagName)) return false;
        if(el.tagName === 'INPUT'){
          const t=(el.type || 'text').toLowerCase();
          if(!['text','search',''].includes(t)) return false;
        }
        const meta = norm([el.id,el.name,el.placeholder,el.getAttribute('aria-label'),el.getAttribute('title')].filter(Boolean).join(' '));
        if(meta.includes('الوصف') || meta.includes('description') || meta.includes('desc')) return true;
        let n=el;
        for(let i=0;i<6 && n;i++,n=n.parentElement){
          const raw=String(n.innerText || n.textContent || '');
          if(raw.length > 1400) break;
          if(norm(raw).includes('الوصف')) return true;
        }
        return false;
      }

      function setInsertedValue(el,value){
        const old=String(el.value || '');
        const start=Number.isFinite(el.selectionStart) ? el.selectionStart : old.length;
        const end=Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;
        const next=old.slice(0,start)+value+old.slice(end);
        try{
          const proto=el.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
          setter ? setter.call(el,next) : (el.value=next);
        }catch(_){ el.value=next; }
        try{ el.setSelectionRange(start+value.length,start+value.length); }catch(_){ }
        el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
        el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      }

      if(!window.__geoAuditSmartCopyPasteInstalled){
        window.__geoAuditSmartCopyPasteInstalled=true;
        document.addEventListener('paste', e => {
          const el=e.target;
          if(!isDescriptionField(el)) return;
          const cfg=window.__geoAuditSmartCopy;
          if(!cfg || !cfg.full) return;
          let clip='';
          try{ clip=(e.clipboardData || window.clipboardData)?.getData('text') || ''; }catch(_){ }
          if(String(clip).trim() !== String(cfg.number).trim()) return;
          e.preventDefault();
          setInsertedValue(el,String(cfg.full));
        }, true);
      }
      return {ok:true,number:P.number,full:P.full,unit:P.unit};
    })()"""
    js = js_template.replace('__PAYLOAD__', payload_js)

    installed = 0
    for page in pages:
        ws = page.get('webSocketDebuggerUrl')
        if not ws:
            continue
        try:
            resp = cdp_command(ws, 'Runtime.evaluate', {
                'expression': js,
                'returnByValue': True,
                'userGesture': True,
            }, 61)
            result = _cdp_result_value(resp) or {}
            if isinstance(result, dict) and result.get('ok'):
                installed += 1
        except Exception:
            continue
    return installed > 0, f'installed:{installed}'

def inject_file_into_work_site_chromium(data_url: str, filename: str):
    """Insert the generated CAD image into #attach_cad_img in this run's exact browser session."""
    if not cdp_alive():
        return False, 'جلسة GeoAudit الحالية غير متصلة بالمتصفح. اقفل البرنامج وشغّل START_GeoAudit.bat من هذه النسخة.'

    pages = list_cdp_pages()
    target_pages = [p for p in pages if TARGET_HOST_TOKEN.lower() in str(p.get('url', '')).lower()]
    if not target_pages:
        return False, 'صفحة موقع العمل غير موجودة داخل نافذة المتصفح التي فتحها GeoAudit.'

    try:
        b64 = data_url.split(',', 1)[1] if ',' in data_url else data_url
        raw = base64.b64decode(b64, validate=False)
        if not raw:
            raise ValueError('empty image')
    except Exception as exc:
        return False, f'تعذر تجهيز صورة الأوتوكاد: {exc}'

    out_dir = ROOT / '.GeoAuditSentCad'
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_base = ''.join(ch for ch in Path(filename or 'GeoAudit-CAD.png').stem if ch.isalnum() or ch in ('-','_')) or 'GeoAudit-CAD'
    file_path = out_dir / f'{safe_base}-{int(time.time()*1000)}.png'
    file_path.write_bytes(raw)
    abs_path = str(file_path.resolve())

    debug_rows = []
    # Search every work-site page in this exact DevTools session. Prefer the currently active/most recently listed page.
    for page in reversed(target_pages):
        ws = page.get('webSocketDebuggerUrl')
        if not ws:
            continue
        page_url = str(page.get('url',''))
        try:
            # JavaScript existence check first. This avoids querying the wrong document target.
            probe = cdp_command(ws, 'Runtime.evaluate', {
                'expression': "(() => { const i=document.querySelector('#attach_cad_img'); return {exists:!!i, type:i?.type||'', disabled:!!i?.disabled, title:document.title, url:location.href}; })()",
                'returnByValue': True,
                'userGesture': True,
            }, 31)
            info = _cdp_result_value(probe) or {}
            debug_rows.append({'url':page_url,'probe':info})
            if not isinstance(info, dict) or not info.get('exists'):
                continue

            # Obtain the live DOM object's objectId, then set the file directly on that object.
            obj = cdp_command(ws, 'Runtime.evaluate', {
                'expression': "document.querySelector('#attach_cad_img')",
                'returnByValue': False,
                'objectGroup': 'geoaudit-upload',
                'userGesture': True,
            }, 32)
            remote = obj.get('result',{}).get('result',{})
            object_id = remote.get('objectId')
            if not object_id:
                debug_rows[-1]['object']='NO_OBJECT_ID'
                continue

            set_resp = cdp_command(ws, 'DOM.setFileInputFiles', {
                'files': [abs_path],
                'objectId': object_id,
            }, 33)
            if 'error' in set_resp:
                debug_rows[-1]['setError']=set_resp.get('error')
                continue

            verify = cdp_command(ws, 'Runtime.evaluate', {
                'expression': "(() => { const i=document.querySelector('#attach_cad_img'); if(!i) return {ok:false,reason:'GONE'}; i.dispatchEvent(new Event('input',{bubbles:true,composed:true})); i.dispatchEvent(new Event('change',{bubbles:true,composed:true})); try{i.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}; const old=i.style.outline; i.style.outline='3px solid #2563eb'; setTimeout(()=>i.style.outline=old,1800); return {ok:(i.files?.length||0)>0,count:i.files?.length||0,name:i.files?.[0]?.name||'',url:location.href}; })()",
                'returnByValue': True,
                'userGesture': True,
            }, 34)
            result = _cdp_result_value(verify) or {}
            if isinstance(result, dict) and result.get('ok'):
                try:
                    cdp_command(ws, 'Page.bringToFront', {}, 35)
                except Exception:
                    pass
                return True, f"تم وضع صورة الأوتوكاد في الخانة تلقائيًا: {result.get('name') or Path(abs_path).name}"
            debug_rows[-1]['verify']=result
        except Exception as exc:
            debug_rows.append({'url':page_url,'error':str(exc)})

    # Save a local diagnostic file automatically; the user never has to use DevTools.
    try:
        (ROOT/'.GeoAuditLastSendDebug.json').write_text(json.dumps({'port':DEBUG_PORT,'pages':debug_rows}, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception:
        pass
    return False, 'وجدت موقع العمل في جلسة GeoAudit لكن لم أجد خانة صورة الأوتوكاد في الصفحة المفتوحة. تم حفظ تشخيص تلقائي داخل .GeoAuditLastSendDebug.json.'




def find_cad_drop_screen_point_chromium():
    """Find the visible CAD attachment field in any controlled Chromium page.

    V14 does not depend on the current URL. It scans every controllable page,
    prefers #attach_cad_img, then the Arabic AutoCAD label, then the second
    visible file input in the attachments section.
    """
    if not cdp_alive():
        return None, 'BROWSER_CONTROL_NOT_AVAILABLE'

    probe_js = r"""(() => {
      const visible = el => {
        if(!el) return false;
        const r=el.getBoundingClientRect();
        const cs=getComputedStyle(el);
        return r.width>8 && r.height>8 && cs.display!=='none' && cs.visibility!=='hidden';
      };
      let i=document.querySelector('#attach_cad_img') || document.querySelector('input[name="attach_cad_img"]');
      let how=i ? 'id' : '';
      if(!i){
        const lab=[...document.querySelectorAll('label')].find(l => /صورة\s*الأوتوكاد|صوره\s*الاوتوكاد|autocad/i.test((l.textContent||'').trim()));
        if(lab){
          const block=lab.closest('.mb-3,.form-group,.form-section,div') || lab.parentElement;
          if(block) i=block.querySelector('input[type="file"]');
          if(i) how='label';
        }
      }
      if(!i){
        const files=[...document.querySelectorAll('input[type="file"]')].filter(visible);
        if(files.length>=2){ i=files[1]; how='second-file-input'; }
      }
      if(!i) return {exists:false,url:location.href,title:document.title,fileInputs:document.querySelectorAll('input[type="file"]').length};
      try{i.scrollIntoView({block:'center',inline:'center',behavior:'instant'})}catch(e){try{i.scrollIntoView()}catch(_){}}
      try{i.focus({preventScroll:true})}catch(e){}
      return {exists:true,how,id:i.id||'',name:i.name||'',url:location.href,title:document.title};
    })()"""

    metrics_js = r"""(() => {
      const visible = el => {
        if(!el) return false;
        const r=el.getBoundingClientRect();
        const cs=getComputedStyle(el);
        return r.width>8 && r.height>8 && cs.display!=='none' && cs.visibility!=='hidden';
      };
      let i=document.querySelector('#attach_cad_img') || document.querySelector('input[name="attach_cad_img"]');
      let how=i ? 'id' : '';
      if(!i){
        const lab=[...document.querySelectorAll('label')].find(l => /صورة\s*الأوتوكاد|صوره\s*الاوتوكاد|autocad/i.test((l.textContent||'').trim()));
        if(lab){ const b=lab.closest('.mb-3,.form-group,.form-section,div')||lab.parentElement; if(b)i=b.querySelector('input[type="file"]'); if(i)how='label'; }
      }
      if(!i){ const fs=[...document.querySelectorAll('input[type="file"]')].filter(visible); if(fs.length>=2){i=fs[1];how='second-file-input';} }
      if(!i) return {exists:false,url:location.href};
      try{i.scrollIntoView({block:'center',inline:'center',behavior:'instant'})}catch(e){}
      const r=i.getBoundingClientRect();
      const dpr=window.devicePixelRatio||1;
      const side=Math.max(0,(window.outerWidth-window.innerWidth)/2);
      const top=Math.max(0,window.outerHeight-window.innerHeight-side);
      const cssX=window.screenX+side+r.left+r.width/2;
      const cssY=window.screenY+top+r.top+r.height/2;
      const old=i.style.outline, oldOff=i.style.outlineOffset;
      i.style.outline='3px solid #2563eb'; i.style.outlineOffset='2px';
      setTimeout(()=>{i.style.outline=old;i.style.outlineOffset=oldOff},2200);
      return {
        exists:true,visible:visible(i),how,id:i.id||'',name:i.name||'',
        x:Math.round(cssX*dpr),y:Math.round(cssY*dpr),
        rect:{left:r.left,top:r.top,width:r.width,height:r.height},
        win:{screenX:window.screenX,screenY:window.screenY,outerWidth:window.outerWidth,outerHeight:window.outerHeight,innerWidth:window.innerWidth,innerHeight:window.innerHeight,dpr},
        url:location.href,title:document.title
      };
    })()"""

    debug=[]
    deadline=time.time()+4.5
    attempt=0
    while time.time()<deadline:
        attempt += 1
        pages=list_cdp_pages()
        ranked=[]
        for page in pages:
            url=str(page.get('url',''))
            lu=url.lower(); score=0
            if TARGET_HOST_TOKEN.lower() in lu: score += 100
            if page.get('type')=='page': score += 5
            if lu.startswith('http://127.0.0.1:') or lu.startswith('http://localhost:'): score -= 200
            ranked.append((score,page))
        ranked.sort(key=lambda x:x[0], reverse=True)

        for _,page in ranked:
            url=str(page.get('url','')); lu=url.lower()
            if lu.startswith('http://127.0.0.1:') or lu.startswith('http://localhost:'):
                continue
            ws=page.get('webSocketDebuggerUrl')
            if not ws:
                continue
            try:
                probe=cdp_command(ws,'Runtime.evaluate',{
                    'expression':probe_js,'returnByValue':True,'userGesture':True
                },100+attempt)
                first=_cdp_result_value(probe) or {}
                if not isinstance(first,dict) or not first.get('exists'):
                    debug.append({'url':url,'probe':first})
                    continue

                try: cdp_command(ws,'Page.bringToFront',{},200+attempt)
                except Exception: pass
                time.sleep(.32)

                metrics=cdp_command(ws,'Runtime.evaluate',{
                    'expression':metrics_js,'returnByValue':True,'userGesture':True
                },300+attempt)
                info=_cdp_result_value(metrics) or {}
                debug.append(info)
                if isinstance(info,dict) and info.get('exists') and info.get('visible'):
                    x=int(info.get('x') or 0); y=int(info.get('y') or 0)
                    if x or y:
                        try:
                            (ROOT/'.GeoAuditLastDropTarget.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
                        except Exception:
                            pass
                        return (x,y),'OK'
            except Exception as exc:
                debug.append({'url':url,'error':str(exc)})
        time.sleep(.22)

    try:
        (ROOT/'.GeoAuditLastDropTarget.json').write_text(json.dumps({'pages':debug},ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception:
        pass
    return None,'CAD_INPUT_NOT_VISIBLE'

def _wait_for_downloaded_file(filename: str, timeout: float = 7.0):
    downloads=Path.home()/'Downloads'
    downloads.mkdir(parents=True,exist_ok=True)
    desired=downloads/Path(filename).name
    deadline=time.time()+timeout
    last_size=-1
    stable=0
    while time.time()<deadline:
        if desired.exists() and desired.is_file():
            try:
                size=desired.stat().st_size
                if size>0 and size==last_size:
                    stable += 1
                else:
                    stable = 0
                last_size=size
                if stable>=2:
                    return desired
            except Exception:
                pass
        time.sleep(.18)
    return desired if desired.exists() else None


def _node_attrs(node):
    raw=node.get('attributes') or []
    return {str(raw[i]): str(raw[i+1]) for i in range(0, len(raw)-1, 2)}


def _flatten_dom_candidates(ws_url: str):
    # Find file inputs across top document, iframes and shadow DOM.
    try:
        cdp_command(ws_url, 'DOM.enable', {}, 450)
    except Exception:
        pass
    nodes=[]
    try:
        resp=cdp_command(ws_url, 'DOM.getFlattenedDocument', {'depth': -1, 'pierce': True}, 451)
        if 'error' not in resp:
            nodes=resp.get('result',{}).get('nodes') or []
    except Exception:
        pass
    if not nodes:
        try:
            resp=cdp_command(ws_url, 'DOM.getDocument', {'depth': -1, 'pierce': True}, 452)
            root=resp.get('result',{}).get('root') or {}
            stack=[root]
            while stack:
                n=stack.pop(); nodes.append(n)
                stack.extend(n.get('children') or [])
                stack.extend(n.get('shadowRoots') or [])
                cd=n.get('contentDocument')
                if isinstance(cd,dict): stack.append(cd)
        except Exception:
            pass
    exact=[]; named=[]; file_inputs=[]
    for n in nodes:
        if str(n.get('nodeName','')).upper()!='INPUT':
            continue
        a=_node_attrs(n)
        if a.get('type','').lower()!='file':
            continue
        row={'nodeId':n.get('nodeId'),'backendNodeId':n.get('backendNodeId'),'frameId':n.get('frameId'),'attrs':a}
        file_inputs.append(row)
        if a.get('id')=='attach_cad_img': exact.append(row)
        elif a.get('name')=='attach_cad_img': named.append(row)
    return exact + named + file_inputs


def _attach_downloaded_cad_to_work_site_chromium(file_path: Path):
    # Attach the downloaded CAD PNG to attach_cad_img without dialogs or OS automation.
    if not cdp_alive():
        return False, 'جلسة المتصفح الخاصة بـ GeoAudit غير متاحة. اقفل البرنامج وشغّل START_GeoAudit.bat من هذه النسخة.'

    abs_path=str(Path(file_path).resolve())
    pages=list_cdp_pages()
    ranked=[]
    for page in pages:
        url=str(page.get('url') or '')
        lu=url.lower(); score=0
        if TARGET_HOST_TOKEN.lower() in lu: score += 1000
        if page.get('type')=='iframe': score += 200
        if page.get('type')=='page': score += 100
        if lu.startswith('http://127.0.0.1:') or lu.startswith('http://localhost:'): score -= 5000
        ranked.append((score,page))
    ranked.sort(key=lambda x:x[0], reverse=True)

    debug=[]
    seen_backend=set()
    for score,page in ranked:
        url=str(page.get('url') or '')
        if url.lower().startswith(('http://127.0.0.1:','http://localhost:')):
            continue
        ws=page.get('webSocketDebuggerUrl')
        if not ws:
            continue
        try:
            candidates=_flatten_dom_candidates(ws)
            debug.append({'url':url,'type':page.get('type'),'candidateCount':len(candidates)})
            for cand in candidates:
                backend=cand.get('backendNodeId')
                node_id=cand.get('nodeId')
                attrs=cand.get('attrs') or {}
                if backend and backend in seen_backend:
                    continue
                if backend: seen_backend.add(backend)
                is_exact=(attrs.get('id')=='attach_cad_img' or attrs.get('name')=='attach_cad_img')
                accept=(attrs.get('accept') or '').lower()
                if not is_exact and 'image' not in accept and '.jpg' not in accept and '.png' not in accept and '.jpeg' not in accept:
                    continue
                params={'files':[abs_path]}
                if backend: params['backendNodeId']=backend
                elif node_id: params['nodeId']=node_id
                else: continue
                set_resp=cdp_command(ws,'DOM.setFileInputFiles',params,453)
                if 'error' in set_resp:
                    debug.append({'url':url,'attrs':attrs,'setError':set_resp.get('error')})
                    continue

                obj_id=None
                try:
                    rparams={}
                    if backend: rparams['backendNodeId']=backend
                    elif node_id: rparams['nodeId']=node_id
                    resolved=cdp_command(ws,'DOM.resolveNode',rparams,454)
                    obj_id=resolved.get('result',{}).get('object',{}).get('objectId')
                except Exception:
                    pass

                result={'ok':True,'count':1,'name':Path(abs_path).name}
                if obj_id:
                    fn = r'''function(){
                      const i=this;
                      try{i.dispatchEvent(new Event('input',{bubbles:true,composed:true}));}catch(e){}
                      try{i.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}catch(e){}
                      try{
                        const f=i.files && i.files[0];
                        if(f){
                          const dt=new DataTransfer(); dt.items.add(f);
                          const target=i.closest('.mb-3,.form-group,.form-section') || i.parentElement || i;
                          for(const t of ['dragenter','dragover','drop']){
                            try{target.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));}catch(e){}
                          }
                        }
                      }catch(e){}
                      try{i.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
                      try{const old=i.style.outline;i.style.outline='3px solid #2563eb';setTimeout(()=>i.style.outline=old,1600);}catch(e){}
                      return {ok:!!(i.files&&i.files.length),count:(i.files&&i.files.length)||0,name:(i.files&&i.files[0]&&i.files[0].name)||'',id:i.id||'',nameAttr:i.name||''};
                    }'''
                    called=cdp_command(ws,'Runtime.callFunctionOn',{
                        'objectId':obj_id,
                        'functionDeclaration':fn,
                        'returnByValue':True,
                        'userGesture':True,
                    },455)
                    result=called.get('result',{}).get('result',{}).get('value') or result
                if isinstance(result,dict) and result.get('ok'):
                    try: cdp_command(ws,'Page.bringToFront',{},456)
                    except Exception: pass
                    try: (ROOT/'.GeoAuditLastSendDebug.json').unlink(missing_ok=True)
                    except Exception: pass
                    return True, f"تم تنزيل الصورة ووضعها تلقائيًا في خانة صورة الأوتوكاد: {result.get('name') or Path(abs_path).name}"
                debug.append({'url':url,'attrs':attrs,'verify':result})
        except Exception as exc:
            debug.append({'url':url,'type':page.get('type'),'error':str(exc)})

    try:
        (ROOT/'.GeoAuditLastSendDebug.json').write_text(json.dumps({'file':abs_path,'debugPort':DEBUG_PORT,'pages':debug},ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception:
        pass
    return False, 'تم تنزيل الصورة، لكن لم أتمكن من العثور على خانة صورة الأوتوكاد داخل جلسة الموقع التي فتحها GeoAudit.'

def send_cad_download_then_auto_attach(data_url: str, filename: str):
    """Requested workflow: normal download first, then auto-attach that same file."""
    safe_name=Path(filename or 'GeoAudit-CAD.png').name
    downloads=Path.home()/'Downloads'
    downloads.mkdir(parents=True,exist_ok=True)

    file_path=_wait_for_downloaded_file(safe_name, timeout=7.0)
    if not file_path:
        # Browser download may be delayed/renamed. Materialize the exact file in
        # Downloads so the workflow still ends with a real downloaded file.
        try:
            b64=data_url.split(',',1)[1] if ',' in data_url else data_url
            raw=base64.b64decode(b64,validate=False)
            if not raw: raise ValueError('empty image')
            file_path=downloads/safe_name
            file_path.write_bytes(raw)
        except Exception as exc:
            return False, f'تعذر تنزيل صورة الأوتوكاد: {exc}'

    return _attach_downloaded_cad_to_work_site_chromium(Path(file_path))

def inject_file_into_work_site(data_url: str, filename: str):
    if os.name == 'nt':
        return send_cad_download_then_auto_attach(data_url, filename)
    return inject_file_into_work_site_chromium(data_url, filename)


def _attach_downloaded_shp_to_work_site_chromium(file_path: Path):
    """Exact CAD-engine twin for Shapefile ZIP, targeting only #shapefile_upload."""
    if not cdp_alive():
        return False, 'جلسة المتصفح الخاصة بـ GeoAudit غير متاحة. اقفل البرنامج وشغّل START_GeoAudit.bat من هذه النسخة.'

    abs_path=str(Path(file_path).resolve())
    pages=list_cdp_pages()
    ranked=[]
    for page in pages:
        url=str(page.get('url') or '')
        lu=url.lower(); score=0
        if TARGET_HOST_TOKEN.lower() in lu: score += 1000
        if page.get('type')=='iframe': score += 200
        if page.get('type')=='page': score += 100
        if lu.startswith('http://127.0.0.1:') or lu.startswith('http://localhost:'): score -= 5000
        ranked.append((score,page))
    ranked.sort(key=lambda x:x[0], reverse=True)

    debug=[]
    seen_backend=set()
    for score,page in ranked:
        url=str(page.get('url') or '')
        if url.lower().startswith(('http://127.0.0.1:','http://localhost:')):
            continue
        ws=page.get('webSocketDebuggerUrl')
        if not ws:
            continue
        try:
            candidates=_flatten_dom_candidates(ws)
            debug.append({'url':url,'type':page.get('type'),'candidateCount':len(candidates)})
            for cand in candidates:
                backend=cand.get('backendNodeId')
                node_id=cand.get('nodeId')
                attrs=cand.get('attrs') or {}
                if backend and backend in seen_backend:
                    continue
                if backend: seen_backend.add(backend)

                is_exact=(attrs.get('id')=='shapefile_upload' or attrs.get('name')=='shapefile_upload')
                if not is_exact:
                    continue

                params={'files':[abs_path]}
                if backend: params['backendNodeId']=backend
                elif node_id: params['nodeId']=node_id
                else: continue

                set_resp=cdp_command(ws,'DOM.setFileInputFiles',params,553)
                if 'error' in set_resp:
                    debug.append({'url':url,'attrs':attrs,'setError':set_resp.get('error')})
                    continue

                obj_id=None
                try:
                    rparams={}
                    if backend: rparams['backendNodeId']=backend
                    elif node_id: rparams['nodeId']=node_id
                    resolved=cdp_command(ws,'DOM.resolveNode',rparams,554)
                    obj_id=resolved.get('result',{}).get('object',{}).get('objectId')
                except Exception:
                    pass

                result={'ok':True,'count':1,'name':Path(abs_path).name}
                if obj_id:
                    fn = r'''function(){
                      const i=this;
                      try{i.dispatchEvent(new Event('input',{bubbles:true,composed:true}));}catch(e){}
                      try{i.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}catch(e){}
                      try{
                        const f=i.files && i.files[0];
                        if(f){
                          const dt=new DataTransfer(); dt.items.add(f);
                          const target=i.closest('.mb-3,.form-group,.form-section') || i.parentElement || i;
                          for(const t of ['dragenter','dragover','drop']){
                            try{target.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));}catch(e){}
                          }
                        }
                      }catch(e){}
                      try{i.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
                      try{const old=i.style.outline;i.style.outline='3px solid #2563eb';setTimeout(()=>i.style.outline=old,1600);}catch(e){}
                      return {ok:!!(i.files&&i.files.length),count:(i.files&&i.files.length)||0,name:(i.files&&i.files[0]&&i.files[0].name)||'',id:i.id||'',nameAttr:i.name||''};
                    }'''
                    called=cdp_command(ws,'Runtime.callFunctionOn',{
                        'objectId':obj_id,
                        'functionDeclaration':fn,
                        'returnByValue':True,
                        'userGesture':True,
                    },555)
                    result=called.get('result',{}).get('result',{}).get('value') or result

                if isinstance(result,dict) and result.get('ok'):
                    try: cdp_command(ws,'Page.bringToFront',{},556)
                    except Exception: pass
                    try: (ROOT/'.GeoAuditLastShpSendDebug.json').unlink(missing_ok=True)
                    except Exception: pass
                    return True, f"تم تنزيل ملف Shapefile ووضعه تلقائيًا في خانة رفع Shapefile: {result.get('name') or Path(abs_path).name}"
                debug.append({'url':url,'attrs':attrs,'verify':result})
        except Exception as exc:
            debug.append({'url':url,'type':page.get('type'),'error':str(exc)})

    try:
        (ROOT/'.GeoAuditLastShpSendDebug.json').write_text(
            json.dumps({'file':abs_path,'debugPort':DEBUG_PORT,'pages':debug},ensure_ascii=False,indent=2),
            encoding='utf-8'
        )
    except Exception:
        pass
    return False, 'تم تنزيل ملف Shapefile، لكن لم أتمكن من وضعه في #shapefile_upload داخل جلسة الموقع.'


def send_shp_download_then_auto_attach(data_url: str, filename: str):
    """Exact twin of CAD workflow: browser download first, then attach that same ZIP."""
    safe_name=Path(filename or 'GeoAudit-Shapefile.zip').name
    if not safe_name.lower().endswith('.zip'):
        safe_name += '.zip'
    downloads=Path.home()/'Downloads'
    downloads.mkdir(parents=True,exist_ok=True)

    file_path=_wait_for_downloaded_file(safe_name, timeout=7.0)
    if not file_path:
        try:
            b64=data_url.split(',',1)[1] if ',' in data_url else data_url
            raw=base64.b64decode(b64,validate=False)
            if not raw: raise ValueError('empty zip')
            file_path=downloads/safe_name
            file_path.write_bytes(raw)
        except Exception as exc:
            return False, f'تعذر تجهيز ملف Shapefile: {exc}'

    return _attach_downloaded_shp_to_work_site_chromium(Path(file_path))


def inject_shp_file_into_work_site(data_url: str, filename: str):
    if os.name == 'nt':
        return send_shp_download_then_auto_attach(data_url, filename)
    try:
        b64=data_url.split(',',1)[1] if ',' in data_url else data_url
        raw=base64.b64decode(b64,validate=False)
        if not raw: raise ValueError('empty zip')
        tmp_dir=ROOT/'.GeoAuditSentShp'
        tmp_dir.mkdir(parents=True,exist_ok=True)
        safe=Path(filename or 'GeoAudit-Shapefile.zip').name
        p=tmp_dir/safe
        p.write_bytes(raw)
        return _attach_downloaded_shp_to_work_site_chromium(p)
    except Exception as exc:
        return False, f'تعذر تجهيز ملف Shapefile: {exc}'


def sync_review_decision_to_work_site(status: str, reason: str = '', order_number: str = ''):
    """Apply a GeoAudit review decision to the open landsurvey form.

    Accepted/QC keep the existing auto-save behavior. Rejected is intentionally
    different: select Rejected, write the exact reason into the site's comment
    field, click Add Comment, then STOP without clicking Save.
    """
    if not cdp_alive():
        return False, 'جلسة موقع العمل غير متاحة.'

    pages = [p for p in list_cdp_pages() if TARGET_HOST_TOKEN.lower() in str(p.get('url', '')).lower()]
    if not pages:
        return False, 'موقع العمل غير مفتوح في جلسة GeoAudit.'

    payload = {
        'status': str(status or '').strip(),
        'reason': str(reason or '').strip(),
        'order': str(order_number or '').strip(),
    }
    payload_js = json.dumps(payload, ensure_ascii=False)
    js = r"""(async() => {
      const P = __PAYLOAD__;
      const norm = s => String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
      const compact = s => norm(s).replace(/[^0-9a-z\u0600-\u06ff]+/g,'');
      const shown = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const fire = (el, type) => el.dispatchEvent(new Event(type,{bubbles:true,composed:true}));
      const textOf = el => norm(el?.innerText || el?.textContent || '');

      function pageContainsOrder(order){
        if(!order) return true;
        const needle=compact(order);
        if(!needle) return true;
        const body=compact(document.body?.innerText || '');
        if(body.includes(needle)) return true;
        for(const el of document.querySelectorAll('input,textarea,select')){
          if(compact(el.value || '').includes(needle)) return true;
        }
        return false;
      }

      function sectionFor(title, expected){
        const titleN=norm(title);
        const candidates=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,label,legend,div,span,p,strong,b')]
          .filter(shown)
          .filter(el=>{ const t=textOf(el); return t===titleN || t.startsWith(titleN) || t.includes(titleN); });
        let best=null, bestLen=Infinity;
        for(const el of candidates){
          let n=el;
          for(let i=0;i<8 && n;i++,n=n.parentElement){
            const t=textOf(n);
            if(t.includes(titleN) && expected.every(x=>t.includes(norm(x)))){
              if(t.length<bestLen){ best=n; bestLen=t.length; }
              break;
            }
          }
        }
        return best;
      }

      function activateChoice(root, wanted){
        if(!root) return false;
        const wn=norm(wanted);
        const labels=[...root.querySelectorAll('label')].filter(shown);
        for(const lab of labels){
          const t=textOf(lab);
          if(t===wn || t.includes(wn)){
            const input=lab.control || lab.querySelector('input[type=radio],input[type=checkbox]') ||
              (lab.htmlFor ? document.getElementById(lab.htmlFor) : null);
            if(input){
              try{ input.click(); }catch(_){ }
              try{ input.checked=true; }catch(_){ }
              fire(input,'input'); fire(input,'change');
              try{ lab.click(); }catch(_){ }
              return true;
            }
            try{ lab.click(); return true; }catch(_){ }
          }
        }
        const buttons=[...root.querySelectorAll('button,[role=button]')].filter(shown);
        for(const b of buttons){
          const t=textOf(b);
          if(t===wn || t.includes(wn)){
            try{ b.click(); return true; }catch(_){ }
          }
        }
        const radios=[...root.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(shown);
        for(const r of radios){
          const around=textOf(r.closest('label,.form-check,.mb-3,.form-group,div') || r.parentElement);
          const value=norm(r.value);
          if(value===wn || around.includes(wn)){
            try{ r.click(); }catch(_){ }
            try{ r.checked=true; }catch(_){ }
            fire(r,'input'); fire(r,'change');
            return true;
          }
        }
        return false;
      }

      function setFieldValue(el,value){
        if(!el) return false;
        const exact=String(value ?? '');
        try{
          const proto = el.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
          if(setter) setter.call(el,exact); else el.value=exact;
        }catch(_){ el.value=exact; }
        try{ el.focus(); }catch(_){ }
        try{ el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:exact})); }catch(_){ fire(el,'input'); }
        fire(el,'change');
        try{ el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'Unidentified'})); }catch(_){ }
        return String(el.value ?? '')===exact;
      }

      function findCommentField(){
        // First prefer the field explicitly belonging to the label "التعليق".
        const labels=[...document.querySelectorAll('label,legend,h4,h5,h6,span,div,p,strong,b')].filter(shown);
        for(const lab of labels){
          const t=textOf(lab);
          if(!(t==='التعليق' || t.startsWith('التعليق'))) continue;
          const control=lab.control || (lab.htmlFor ? document.getElementById(lab.htmlFor) : null);
          if(control && shown(control) && !control.disabled && !control.readOnly && /^(TEXTAREA|INPUT)$/.test(control.tagName)) return control;
          let n=lab;
          for(let i=0;i<6 && n;i++,n=n.parentElement){
            const f=n.querySelector?.('textarea,input[type=text],input:not([type])');
            if(f && shown(f) && !f.disabled && !f.readOnly) return f;
          }
          let sib=lab.nextElementSibling;
          for(let i=0;i<4 && sib;i++,sib=sib.nextElementSibling){
            if(sib.matches?.('textarea,input[type=text],input:not([type])') && shown(sib) && !sib.disabled && !sib.readOnly) return sib;
            const f=sib.querySelector?.('textarea,input[type=text],input:not([type])');
            if(f && shown(f) && !f.disabled && !f.readOnly) return f;
          }
        }

        const fields=[...document.querySelectorAll('textarea,input[type=text],input:not([type])')]
          .filter(shown).filter(el=>!el.disabled && !el.readOnly);
        let best=null,bestScore=-999;
        for(const el of fields){
          const meta=norm([el.id,el.name,el.placeholder,el.getAttribute('aria-label')].filter(Boolean).join(' '));
          let n=el, context='';
          for(let i=0;i<6 && n;i++,n=n.parentElement) context+=' '+textOf(n);
          let score=0;
          if(meta==='التعليق' || meta.includes('التعليق')) score+=80;
          if(context.includes('التعليق')) score+=45;
          if(context.includes('إضافة تعليق') || context.includes('اضافة تعليق')) score+=45;
          if(meta.includes('comment')) score+=25;
          if(el.tagName==='TEXTAREA') score+=12;
          if(meta.includes('سبب الرفض')) score-=30;
          if(context.includes('سبب الرفض') && !context.includes('إضافة تعليق') && !context.includes('اضافة تعليق')) score-=20;
          if(score>bestScore){ best=el; bestScore=score; }
        }
        return bestScore>=35 ? best : null;
      }

      function findAddCommentButton(field){
        const roots=[];
        if(field){
          let n=field;
          for(let i=0;i<7 && n;i++,n=n.parentElement) roots.push(n);
        }
        roots.push(document);
        const seen=new Set();
        let best=null,bestScore=-999;
        for(const root of roots){
          const candidates=[...root.querySelectorAll('button,input[type=button],input[type=submit],[role=button],a')].filter(shown);
          for(const el of candidates){
            if(seen.has(el) || el.disabled) continue;
            seen.add(el);
            const txt=norm(el.tagName==='INPUT' ? (el.value || '') : (el.innerText || el.textContent || ''));
            const meta=norm([el.id,el.name,el.className,el.getAttribute('title'),el.getAttribute('aria-label')].filter(Boolean).join(' '));
            let score=0;
            if(txt==='إضافة تعليق' || txt==='اضافة تعليق') score+=120;
            else if(txt.includes('إضافة تعليق') || txt.includes('اضافة تعليق')) score+=90;
            if(meta.includes('comment')) score+=20;
            if(field && field.closest('form') && el.closest('form')===field.closest('form')) score+=12;
            if(txt.includes('حفظ') || txt.includes('عودة') || txt.includes('الغاء') || txt.includes('إلغاء')) score-=120;
            if(score>bestScore){ best=el; bestScore=score; }
          }
        }
        return bestScore>=70 ? best : null;
      }

      async function addRejectionComment(value){
        const exact=String(value ?? '').trim();
        if(!exact || exact==='-') return {ok:false, reason:'empty-comment'};
        // Rejection selection can reveal the comment area asynchronously.
        let field=null;
        for(let i=0;i<12 && !field;i++){
          field=findCommentField();
          if(!field) await new Promise(resolve=>setTimeout(resolve,100));
        }
        if(!field) return {ok:false, reason:'comment-field-not-found'};
        if(!setFieldValue(field,exact)) return {ok:false, reason:'comment-write-failed'};
        await new Promise(resolve=>setTimeout(resolve,120));
        const btn=findAddCommentButton(field);
        if(!btn) return {ok:false, reason:'add-comment-button-not-found'};
        try{ btn.scrollIntoView({block:'center',inline:'nearest'}); }catch(_){ }
        await new Promise(resolve=>setTimeout(resolve,80));
        try{ btn.click(); }catch(_){ return {ok:false, reason:'add-comment-click-failed'}; }
        // Give the site's own handler time to persist/add the comment before Save.
        await new Promise(resolve=>setTimeout(resolve,500));
        return {ok:true, fieldId:field.id || '', exactValue:exact, buttonText:(btn.innerText || btn.value || '').trim() || 'إضافة تعليق'};
      }

      function findSaveButton(preferredRoot){
        const roots=[];
        if(preferredRoot){
          const form=preferredRoot.closest?.('form');
          if(form) roots.push(form);
          roots.push(preferredRoot);
        }
        roots.push(document);
        let best=null,bestScore=-999;
        const seen=new Set();
        for(const root of roots){
          const candidates=[...root.querySelectorAll('button,input[type=submit],input[type=button],[role=button]')].filter(shown);
          for(const el of candidates){
            if(seen.has(el) || el.disabled) continue;
            seen.add(el);
            const txt=norm(el.tagName==='INPUT' ? (el.value || el.getAttribute('aria-label') || '') : (el.innerText || el.textContent || el.getAttribute('aria-label') || ''));
            const meta=norm([el.id,el.name,el.className,el.getAttribute('title')].filter(Boolean).join(' '));
            let score=0;
            if(txt==='حفظ') score+=40;
            else if(txt.startsWith('حفظ')) score+=28;
            else if(txt.includes('حفظ')) score+=18;
            if(norm(el.type)==='submit') score+=5;
            if(meta.includes('save')) score+=7;
            if(preferredRoot && preferredRoot.closest?.('form') && el.closest?.('form')===preferredRoot.closest('form')) score+=12;
            if(txt.includes('عودة') || txt.includes('الغاء') || txt.includes('إلغاء')) score-=60;
            if(score>bestScore){best=el;bestScore=score;}
          }
          if(best && bestScore>=40) break;
        }
        return bestScore>=18 ? best : null;
      }

      // If the record number is visible on the page, require it to match.  If the
      // page does not render the number anywhere we still allow the currently open form.
      const orderVisibleAnywhere=[...document.querySelectorAll('body,input,textarea,select')]
        .some(el=>compact(el.value || el.innerText || el.textContent || '').includes(compact(P.order)));
      if(P.order && orderVisibleAnywhere && !pageContainsOrder(P.order)){
        return {ok:false, reason:'wrong-order-page', order:P.order, url:location.href};
      }

      const status=P.status;
      let applied=false, commentResult={ok:true}, target='', root=null;
      if(status==='مقبول' || status==='مرفوض'){
        root=sectionFor('نتيجة المراجعة',['مقبول','مرفوض']) || document.body;
        applied=activateChoice(root,status);
        target='review_result';
        if(status==='مرفوض'){ await new Promise(resolve=>setTimeout(resolve,180)); commentResult=await addRejectionComment(P.reason); }
      } else if(norm(status)==='qc') {
        root=sectionFor('المراجعة الداخلية',['qc']) || document.body;
        applied=activateChoice(root,'QC') || activateChoice(root,'Qc') || activateChoice(root,'qc');
        target='internal_review';
      } else if(status==='معلق') {
        // The landsurvey page shown by the user has no explicit "معلق" result.
        // Keep it in system-review only rather than inventing a destructive mapping.
        return {ok:true, skipped:true, reason:'no-explicit-suspended-field', status, url:location.href};
      } else {
        return {ok:false, reason:'unsupported-status', status, url:location.href};
      }

      if(!applied) return {ok:false, reason:'review-choice-not-found', status, target, url:location.href};
      if(status==='مرفوض' && !commentResult.ok) return {ok:false, reason:commentResult.reason || 'comment-sync-failed', status, target, url:location.href};

      // IMPORTANT: Rejected stops immediately after Add Comment.
      // Do NOT click the work-site Save button and do NOT auto-advance.
      if(status==='مرفوض') {
        return {
          ok:true,
          applied:true,
          commentAdded:true,
          commentButton:commentResult.buttonText || 'إضافة تعليق',
          saved:false,
          stopAfterComment:true,
          target,
          status,
          order:P.order,
          url:location.href,
          title:document.title
        };
      }

      const btn=findSaveButton(root);
      if(!btn) return {ok:false, reason:'save-button-not-found', applied:true, status, target, url:location.href};
      try{ btn.scrollIntoView({block:'center',inline:'nearest'}); }catch(_){ }
      try{ btn.click(); }catch(_){ return {ok:false, reason:'save-click-failed', applied:true, status, target, url:location.href}; }

      return {
        ok:true,
        applied:true,
        commentAdded:status==='مرفوض' ? !!commentResult.ok : false,
        commentButton:status==='مرفوض' ? (commentResult.buttonText || 'إضافة تعليق') : '',
        saved:true,
        saveText:(btn.innerText || btn.value || '').trim() || 'حفظ',
        target,
        status,
        order:P.order,
        url:location.href,
        title:document.title
      };
    })()""".replace('__PAYLOAD__', payload_js)

    last = None
    for i, page in enumerate(pages):
        ws = page.get('webSocketDebuggerUrl')
        if not ws:
            continue
        try:
            resp = cdp_command(ws, 'Runtime.evaluate', {
                'expression': js,
                'returnByValue': True,
                'userGesture': True,
                'awaitPromise': True,
            }, 740 + i)
            result = _cdp_result_value(resp) or {}
            last = result
            if isinstance(result, dict) and result.get('ok'):
                # Give the work-site submit handler a short head start before the
                # tracker update is sent to Supabase.
                if result.get('saved'):
                    time.sleep(0.35)
                return True, 'OK'
        except Exception as exc:
            last = {'error': str(exc)}

    try:
        (ROOT / '.GeoAuditLastReviewSync.json').write_text(
            json.dumps({'payload': payload, 'result': last, 'pages': [p.get('url') for p in pages]}, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
    except Exception:
        pass

    reason_code = last.get('reason') if isinstance(last, dict) else ''
    messages = {
        'review-choice-not-found': 'لم أجد اختيار نتيجة المراجعة داخل صفحة موقع العمل المفتوحة.',
        'comment-field-not-found': 'تم اختيار مرفوض لكن لم أجد خانة التعليق في موقع العمل.',
        'comment-write-failed': 'وجدت خانة التعليق لكن تعذر كتابة نفس سبب الرفض فيها.',
        'add-comment-button-not-found': 'تم كتابة نفس سبب الرفض في التعليق لكن لم أجد زر إضافة تعليق في موقع العمل.',
        'add-comment-click-failed': 'تم كتابة سبب الرفض لكن تعذر الضغط على زر إضافة تعليق.',
        'empty-comment': 'اكتب سبب الرفض قبل تنفيذ قرار مرفوض.',
        'save-button-not-found': 'تم تطبيق القرار لكن لم أجد زر حفظ في موقع العمل.',
        'save-click-failed': 'تم تطبيق القرار لكن تعذر الضغط على زر حفظ في موقع العمل.',
        'wrong-order-page': 'الطلب المفتوح في موقع العمل لا يطابق رقم الطلب الحالي في GeoAudit.',
    }
    return False, messages.get(reason_code, 'تعذر تطبيق القرار وحفظه داخل موقع العمل.')


class GeoAuditHandler(http.server.SimpleHTTPRequestHandler):
    server_version='GeoAuditStudio/48.0-RejectNoSave'
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,fmt,*args): print(f'[GeoAudit] {self.address_string()} - {fmt % args}')
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate'); self.send_header('Pragma','no-cache'); super().end_headers()

    def json_response(self, code, obj):
        data=json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        path=self.path.split('?',1)[0]
        if path=='/api/health':
            self.json_response(200, {'ok':True,'oneClickSend':True,'engine':('download-then-browser-auto-attach' if os.name=='nt' else ('chromium-cdp-exact' if cdp_alive() else 'none')),'target':TARGET_SITE,'debugPort':DEBUG_PORT}); return
        if path=='/api/auto-shapefile':
            shp_path = next_downloaded_shapefile()
            if not shp_path:
                self.send_response(204); self.end_headers(); return
            try:
                data = shp_path.read_bytes()
                ctype = 'application/zip' if shp_path.suffix.lower()=='.zip' else 'application/octet-stream'
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('X-GeoAudit-Filename', urllib.parse.quote(shp_path.name))
                self.send_header('Content-Length', str(len(data)))
                self.end_headers(); self.wfile.write(data); return
            except Exception:
                self.send_response(204); self.end_headers(); return
        return super().do_GET()

    def do_POST(self):
        path=self.path.split('?',1)[0]
        try: length=int(self.headers.get('Content-Length','0') or '0')
        except ValueError: length=0
        if length<=0: self.json_response(400, {'ok':False,'message':'Empty upload'}); return
        if length>MAX_UPLOAD: self.json_response(413, {'ok':False,'message':'File too large'}); return
        body=self.rfile.read(length)
        if len(body)!=length: self.json_response(400, {'ok':False,'message':'Incomplete upload'}); return

        if path=='/api/work-review-sync':
            try:
                payload=json.loads(body.decode('utf-8'))
                status=str(payload.get('status') or '').strip()
                reason=str(payload.get('reason') or '').strip()
                order_number=str(payload.get('orderNumber') or '').strip()
                if not status:
                    raise ValueError('Missing review status')
                ok,msg=sync_review_decision_to_work_site(status, reason, order_number)
                self.json_response(200 if ok else 409, {'ok':ok,'message':msg}); return
            except Exception as exc:
                self.json_response(500, {'ok':False,'message':f'تعذر مزامنة قرار المراجعة مع موقع العمل: {exc}'}); return

        if path=='/api/smart-copy':
            try:
                payload=json.loads(body.decode('utf-8'))
                number_text=str(payload.get('number') or '')
                full_text=str(payload.get('full') or number_text)
                unit=str(payload.get('unit') or '')
                if not number_text:
                    raise ValueError('Missing number')
                ok,msg=install_smart_copy_on_work_site(number_text, full_text, unit)
                # Copy itself must never fail just because the site listener is unavailable.
                self.json_response(200, {'ok':ok,'message':msg}); return
            except Exception as exc:
                self.json_response(200, {'ok':False,'message':str(exc)}); return

        if path=='/api/send-cad':
            try:
                payload=json.loads(body.decode('utf-8'))
                data_url=str(payload.get('dataUrl',''))
                filename=str(payload.get('filename') or 'GeoAudit-CAD.png')
                if not data_url.startswith('data:image/'):
                    raise ValueError('Invalid CAD image')
                ok,msg=inject_file_into_work_site(data_url, filename)
                self.json_response(200 if ok else 409, {'ok':ok,'message':msg}); return
            except Exception as exc:
                self.json_response(500, {'ok':False,'message':f'تعذر إرسال الصورة: {exc}'}); return

        if path=='/api/send-shp':
            try:
                payload=json.loads(body.decode('utf-8'))
                data_url=str(payload.get('dataUrl',''))
                filename=str(payload.get('filename') or 'GeoAudit-Shapefile.zip')
                if not data_url.startswith('data:'):
                    raise ValueError('Invalid Shapefile ZIP data')
                ok,msg=inject_shp_file_into_work_site(data_url, filename)
                self.json_response(200 if ok else 409, {'ok':ok,'message':msg}); return
            except Exception as exc:
                self.json_response(500, {'ok':False,'message':f'تعذر إرفاق ملف Shapefile: {exc}'}); return

        if path!='/api/unrar': self.send_error(404,'Not Found'); return
        with tempfile.TemporaryDirectory(prefix='GeoAudit_') as td:
            temp=Path(td); rar_path=temp/'upload.rar'; out_dir=temp/'out'; out_dir.mkdir(); rar_path.write_bytes(body)
            ok,engine,log=extract_rar(rar_path,out_dir)
            if not ok:
                msg=('تعذر فك ملف RAR حتى بعد محاولة تجهيز UnRAR الرسمي تلقائيًا. '
                     'تأكد فقط أن الإنترنت متاح أول مرة، أو استخدم ZIP كحل بديل.\n\n'+(log[-6000:] if log else ''))
                data=msg.encode('utf-8',errors='replace'); self.send_response(422); self.send_header('Content-Type','text/plain; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data); return
            normalize_extracted_names(out_dir)
            supported=[p for p in out_dir.rglob('*') if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS]
            if not supported:
                data='تم فك RAR لكن لا توجد داخله ملفات GIS/Excel مدعومة.'.encode('utf-8'); self.send_response(422); self.send_header('Content-Type','text/plain; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data); return
            zip_path=temp/'gis_files.zip'
            with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as zf:
                for p in supported: zf.write(p,p.relative_to(out_dir).as_posix())
            data=zip_path.read_bytes(); self.send_response(200); self.send_header('Content-Type','application/zip'); self.send_header('X-GeoAudit-Extractor',engine); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)


def main():
    initialize_download_watch()
    try: server=http.server.ThreadingHTTPServer(('127.0.0.1',0),GeoAuditHandler)
    except Exception as exc:
        print('\nERROR: GeoAudit Studio could not start:'); print(exc); input('\nPress Enter to close...'); raise SystemExit(1)
    port=server.server_address[1]; url=f'http://127.0.0.1:{port}/'
    print('='*62); print('        GeoAudit Studio - V35 SILENT AUTO IMPORT'); print('='*62)
    print(f'GeoAudit: {url}')
    print('CAD: download -> auto attach #attach_cad_img | SHP: download -> auto attach #shapefile_upload')
    print('No extension, no file picker, no WinForms/UI Automation.')
    print('='*62)
    def open_windows():
        ok=launch_chromium_controlled_browser(url)
        if not ok:
            print('[GeoAudit] Automatic attachment requires Edge or Chrome opened by GeoAudit.')
            webbrowser.open(url)
    threading.Timer(0.7, open_windows).start()
    try: server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt: print('\nStopping GeoAudit Studio...')
    finally: server.server_close()

if __name__=='__main__': main()
