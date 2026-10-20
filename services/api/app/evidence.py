"""Append-only inspection metadata and locally retained, hash-checked media."""

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .catalog import load_assets
from .errors import ApiProblem
from .schemas import InspectionCreate, InspectionRecord, MediaRecord

MAX_MEDIA_BYTES = 10 * 1024 * 1024


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EvidenceService:
    def __init__(self, store, directory: Path):
        self.store = store
        self.directory = directory / "media"
        self.directory.mkdir(exist_ok=True)

    def check_asset(self, asset_id: str):
        assets = load_assets()
        known = {x.node_id for x in assets.nodes} | {x.conduit_id for x in assets.conduits} | {x.inlet_id for x in assets.inlets}
        if asset_id not in known:
            raise ApiProblem(404,"NOT_FOUND","Unknown inspection asset.",{"asset_id":asset_id})
        return assets

    def create(self, payload: InspectionCreate) -> dict:
        assets = self.check_asset(payload.asset_id)
        if payload.visible_grate_coverage_fraction is not None and payload.asset_id not in {x.inlet_id for x in assets.inlets}:
            raise ApiProblem(422,"VALIDATION_ERROR","Visible grate coverage applies only to an inlet, not a pipe or node.")
        record = {
            **payload.model_dump(mode="json"),
            "timestamp":payload.timestamp.astimezone(timezone.utc).isoformat(),
            "inspection_id":f"inspection_{uuid.uuid4().hex}","created_at":utc_now(),
            "model_version_id":assets.model_version_id,"is_verified_site_model":False,
            "media":[],"media_urls":[],
        }
        self.store.create_inspection(record)
        return record

    def get(self, inspection_id: str) -> dict:
        record = self.store.get_inspection(inspection_id)
        if record is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown inspection.",{"inspection_id":inspection_id})
        record["media"] = self.store.list_media(inspection_id)
        record["media_urls"] = [m["url"] for m in record["media"]]
        return InspectionRecord.model_validate(record).model_dump(mode="json")

    def list(self, asset_id: str | None, limit: int) -> dict:
        if asset_id is not None:
            self.check_asset(asset_id)
        return {"items":[self.get(x["inspection_id"]) for x in self.store.list_inspections(asset_id,limit)]}

    async def upload(self, inspection_id: str, upload) -> dict:
        inspection = self.get(inspection_id)
        media_id = f"media_{uuid.uuid4().hex}"
        path = self.directory / f"{media_id}.blob"
        digest, size, prefix = hashlib.sha256(), 0, b""
        try:
            with path.open("xb") as target:
                while chunk := await upload.read(64 * 1024):
                    size += len(chunk)
                    if size > MAX_MEDIA_BYTES:
                        raise ApiProblem(413,"MEDIA_TOO_LARGE","Media is limited to 10 MiB per file.")
                    prefix = (prefix + chunk)[:16]
                    digest.update(chunk)
                    target.write(chunk)
            mime = None
            if prefix.startswith(b"\x89PNG\r\n\x1a\n"):
                mime = "image/png"
            elif prefix.startswith(b"\xff\xd8\xff"):
                mime = "image/jpeg"
            elif prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
                mime = "image/webp"
            elif prefix.startswith(b"%PDF-"):
                mime = "application/pdf"
            if mime is None or size == 0 or upload.content_type not in (mime,"application/octet-stream"):
                raise ApiProblem(415,"UNSUPPORTED_MEDIA","Use PNG, JPEG, WebP or PDF with matching content type and file signature.")
            # The original name is display metadata only, never a filesystem path.
            filename = (upload.filename or "evidence").replace("\\","/").rsplit("/",1)[-1]
            filename = "".join(c for c in filename if c.isprintable())[:200] or "evidence"
            record = MediaRecord(
                media_id=media_id,inspection_id=inspection_id,filename=filename,
                content_type=mime,size_bytes=size,sha256=digest.hexdigest(),created_at=utc_now(),
                source_type=inspection["source_type"],url=f"/api/inspections/{inspection_id}/media/{media_id}",
            ).model_dump(mode="json")
            self.store.create_media(record)
            return record
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        finally:
            await upload.close()

    def download(self, inspection_id: str, media_id: str):
        self.get(inspection_id)
        record = self.store.get_media(inspection_id,media_id)
        if record is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown inspection media.")
        path = self.directory / f"{record['media_id']}.blob"
        try:
            data = path.read_bytes()
            if len(data) != record["size_bytes"] or hashlib.sha256(data).hexdigest() != record["sha256"]:
                raise ValueError("Media size/hash mismatch")
        except (OSError,ValueError) as exc:
            raise ApiProblem(500,"MEDIA_ARTIFACT_INVALID","Retained media is missing or corrupt; its immutable metadata is preserved.",{"media_id":media_id}) from exc
        return path, record
