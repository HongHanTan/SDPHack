"""SQLite metadata persistence; every thread uses its own short-lived connection."""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def encode(value) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


class QueueFullError(RuntimeError):
    pass


class Store:
    def __init__(self, directory: Path):
        self.directory = directory
        self.path = directory / "floodops.sqlite3"

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self, storms: list[dict]):
        self.directory.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS storms (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
                    created_at TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    artifacts TEXT NOT NULL DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS runs_status ON runs(status);
                CREATE TRIGGER IF NOT EXISTS storms_no_update BEFORE UPDATE ON storms
                    BEGIN SELECT RAISE(ABORT, 'storms are immutable'); END;
                CREATE TRIGGER IF NOT EXISTS storms_no_delete BEFORE DELETE ON storms
                    BEGIN SELECT RAISE(ABORT, 'storms are immutable'); END;
                CREATE TRIGGER IF NOT EXISTS run_inputs_immutable BEFORE UPDATE OF payload ON runs
                WHEN json_extract(OLD.payload,'$.input_hash') != json_extract(NEW.payload,'$.input_hash')
                  OR json_extract(OLD.payload,'$.input_snapshot') != json_extract(NEW.payload,'$.input_snapshot')
                  OR json_extract(OLD.payload,'$.created_at') != json_extract(NEW.payload,'$.created_at')
                    BEGIN SELECT RAISE(ABORT, 'run inputs are immutable'); END;
            """)
            for storm in storms:
                db.execute("INSERT OR IGNORE INTO storms(id,payload) VALUES (?,?)", (storm["storm_id"], encode(storm)))

    def create_storm(self, storm: dict):
        with self.connect() as db:
            db.execute("INSERT INTO storms(id,payload) VALUES (?,?)", (storm["storm_id"], encode(storm)))

    def get_storm(self, storm_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT payload FROM storms WHERE id=?", (storm_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list_storms(self) -> list[dict]:
        with self.connect() as db:
            rows = db.execute("SELECT payload FROM storms ORDER BY rowid").fetchall()
        return [json.loads(row[0]) for row in rows]

    def create_run(self, run: dict, max_pending: int):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            count = db.execute("SELECT count(*) FROM runs WHERE status IN ('queued','running')").fetchone()[0]
            if count >= max_pending:
                raise QueueFullError("Simulation queue is full")
            db.execute("INSERT INTO runs(id,status,created_at,payload) VALUES (?,?,?,?)", (run["run_id"],run["status"],run["created_at"],encode(run)))

    def get_run(self, run_id: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT payload FROM runs WHERE id=?", (run_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list_runs(self, limit: int = 20, pending_only: bool = False) -> list[dict]:
        with self.connect() as db:
            query = "SELECT payload FROM runs"
            if pending_only:
                query += " WHERE status IN ('queued','running')"
            rows = db.execute(query + " ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def transition(self, run_id: str, expected_status: str, changes: dict, artifacts: dict | None = None) -> bool:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM runs WHERE id=? AND status=?", (run_id,expected_status)).fetchone()
            if row is None:
                return False
            run = json.loads(row[0])
            run.update(changes)
            db.execute("UPDATE runs SET status=?,payload=? WHERE id=?", (run["status"],encode(run),run_id))
            if artifacts is not None:
                db.execute("UPDATE runs SET artifacts=? WHERE id=?", (encode(artifacts),run_id))
        return True

    def artifacts(self, run_id: str) -> dict:
        with self.connect() as db:
            row = db.execute("SELECT artifacts FROM runs WHERE id=?", (run_id,)).fetchone()
        return json.loads(row[0]) if row else {}
