"""
Shared ground for the Loop Soul film pipeline (scripts/loop/film/).

The pipeline turns ONE continuous take of Mani dancing the whole album into the
film, the per-song cuts and the social clips. Every stage writes into a work
directory and skips itself when nothing it depends on changed.

Where things live, all overridable by environment variable:
  FILM_WORK     the work directory (big: plan on ~60 GB for a full take).
                Default ~/Documents/Loop-soul-the-entertainment-room/film-work.
  FILM_MASTERS  the album masters as m01.m4a .. m14.m4a.
  FILM_MODELS   the MediaPipe models (pose_landmarker_full.task,
                selfie_segmenter.tflite).
"""
import hashlib, json, os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parent / "reel"))
from common import INK, INK_SOFT, SAND, SAND_BRIGHT, SAND_DEEP, onset_envelope, read_frames  # noqa: E402,F401

HOME = Path.home()
MEDIA = HOME / "Documents/Loop-soul-the-entertainment-room"
WORK = Path(os.environ.get("FILM_WORK", MEDIA / "film-work")).expanduser()
MASTERS = Path(os.environ.get("FILM_MASTERS", MEDIA / "social-2026-10/heard-once-work")).expanduser()
MODELS = Path(os.environ.get("FILM_MODELS", HOME / "Documents/Apps/Game/tools/models")).expanduser()
SONGS = json.loads((REPO / "src/lib/loop/film/songs.json").read_text())["songs"]


def master(number: int) -> Path:
    p = MASTERS / f"m{number:02d}.m4a"
    if not p.exists():
        raise SystemExit(f"missing master {p}. Set FILM_MASTERS to the folder holding m01.m4a .. m14.m4a.")
    return p


def model(name: str) -> Path:
    for base in (MODELS, REPO / "public/loop/models", Path("/tmp/claude-501/models")):
        if (base / name).exists():
            return base / name
    raise SystemExit(f"missing model {name}. Put it in FILM_MODELS ({MODELS}).")


def run(args, **kw):
    return subprocess.run([str(a) for a in args], check=True, **kw)


def work(*parts) -> Path:
    p = WORK.joinpath(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


def fingerprint(*items) -> str:
    """A stable hash of a stage's inputs: files by size and mtime, values as JSON."""
    h = hashlib.sha256()
    for it in items:
        p = Path(it) if isinstance(it, (str, Path)) else None
        if p is not None and p.exists():
            st = p.stat()
            h.update(f"{p}:{st.st_size}:{int(st.st_mtime)}".encode())
        else:
            h.update(json.dumps(it, sort_keys=True, default=str).encode())
    return h.hexdigest()[:16]


def fresh(manifest: Path, key: str) -> bool:
    """True when the stage already ran with exactly these inputs."""
    try:
        return json.loads(manifest.read_text()).get("key") == key
    except (FileNotFoundError, json.JSONDecodeError):
        return False


def done(manifest: Path, key: str, **info) -> None:
    manifest.write_text(json.dumps({"key": key, **info}, indent=2))


def _env(name: str):
    """From the environment, else from the repo's .env.local (python has no --env-file)."""
    if os.environ.get(name):
        return os.environ[name]
    env = REPO / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def d1(sql: str, params=None):
    """One statement against the production D1 (the same database the site uses)."""
    import urllib.request
    url, token = _env("DATABASE_URL"), _env("CLOUDFLARE_D1_API_TOKEN")
    if not url or not token:
        raise SystemExit("D1 is not configured: DATABASE_URL and CLOUDFLARE_D1_API_TOKEN (see .env.local).")
    req = urllib.request.Request(url.rstrip("/").removesuffix("/query") + "/query", method="POST",
                                 data=json.dumps({"sql": sql, "params": params or []}).encode(),
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    if not body.get("success"):
        raise RuntimeError(f"D1: {body.get('errors')}")
    return body["result"][0].get("results", [])
