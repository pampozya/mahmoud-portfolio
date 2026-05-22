#!/usr/bin/env python3
"""Local preview server for the finance tracker.

It serves the static app and emulates api.php against finance-data.json so the
live endpoint is never touched during local review.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "finance-data.json"
SEED_FILE = ROOT / "data-seed.json"
BACKUP_DIR = ROOT / "backups"


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    if SEED_FILE.exists():
        DATA_FILE.write_bytes(SEED_FILE.read_bytes())
        return
    DATA_FILE.write_text(
        json.dumps(
            {
                "month": datetime.now(timezone.utc).strftime("%Y-%m"),
                "expenses": {},
                "income": [],
                "payouts": [],
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def backup_current_data() -> None:
    if not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0:
        return
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = BACKUP_DIR / f"local-finance-data-{stamp}.json"
    target.write_bytes(DATA_FILE.read_bytes())


def safe_backup_path(file_name: str) -> Path:
    path = BACKUP_DIR / Path(file_name).name
    if path.name != file_name or not path.exists() or path.suffix != ".json":
        raise FileNotFoundError(file_name)
    return path


def backup_revision(path: Path) -> int | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    revision = payload.get("_meta", {}).get("revision")
    return int(revision) if isinstance(revision, int | float | str) and str(revision).isdigit() else None


def list_backups() -> list[dict[str, object]]:
    if not BACKUP_DIR.exists():
        return []
    backups = []
    for path in sorted(BACKUP_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        backups.append(
            {
                "file": path.name,
                "size": path.stat().st_size,
                "createdAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                "revision": backup_revision(path),
            }
        )
    return backups[:50]


class FinancePreviewHandler(SimpleHTTPRequestHandler):
    server_version = "FinancePreview/0.4"

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        clean_path = unquote(parsed.path)
        if clean_path.startswith("/finance/"):
            clean_path = clean_path[len("/finance") :]
        if clean_path in {"", "/"}:
            return str(ROOT / "index.html")
        return str(ROOT / clean_path.lstrip("/"))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/api.php", "/finance/api.php"}:
            query = parse_qs(parsed.query)
            action = query.get("action", [""])[0]
            if action == "backups":
                payload = json.dumps({"backups": list_backups()}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            if action == "backup":
                try:
                    payload = safe_backup_path(query.get("file", [""])[0]).read_bytes()
                except FileNotFoundError:
                    self.send_error(404, "Backup not found")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            ensure_data_file()
            payload = DATA_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/api.php", "/finance/api.php"}:
            self.send_error(404, "Not found")
            return
        query = parse_qs(parsed.query)
        action = query.get("action", [""])[0]

        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 5 * 1024 * 1024:
            self.send_error(413, "Payload too large")
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        if not isinstance(payload, dict):
            self.send_error(400, "Expected JSON object")
            return

        if action == "restore":
            file_name = str(payload.get("file", ""))
            try:
                restore_path = safe_backup_path(file_name)
            except FileNotFoundError:
                self.send_error(404, "Backup not found")
                return
            ensure_data_file()
            backup_current_data()
            DATA_FILE.write_bytes(restore_path.read_bytes())
            response = json.dumps(
                {
                    "ok": True,
                    "restoredAt": datetime.now(timezone.utc).isoformat(),
                    "file": restore_path.name,
                }
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return

        ensure_data_file()
        backup_current_data()
        DATA_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        response = json.dumps(
            {
                "ok": True,
                "savedAt": datetime.now(timezone.utc).isoformat(),
                "revision": payload.get("_meta", {}).get("revision"),
            }
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


def main() -> None:
    os.chdir(ROOT)
    ensure_data_file()
    port = int(os.environ.get("PORT", "8888"))
    server = ThreadingHTTPServer(("127.0.0.1", port), FinancePreviewHandler)
    print(f"Finance tracker preview: http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
