from __future__ import annotations

import asyncio
import os
import re
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Literal


def _irodori_tts_dir() -> Path:
    return Path(os.environ.get("IRODORI_TTS_DIR", "~/fork/Irodori-TTS")).expanduser()


IRODORI_TTS_DIR = _irodori_tts_dir()
if str(IRODORI_TTS_DIR) not in sys.path:
    sys.path.insert(0, str(IRODORI_TTS_DIR))

from fastapi import FastAPI, HTTPException, Response
from huggingface_hub import hf_hub_download
from pydantic import BaseModel, Field

from irodori_tts.inference_runtime import (
    InferenceRuntime,
    RuntimeKey,
    SamplingRequest,
    default_runtime_device,
    resolve_cfg_scales,
    save_wav,
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _optional_env_float(name: str) -> float | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return None
    lowered = raw.strip().lower()
    if lowered in {"none", "null", "off", "disable", "disabled"}:
        return None
    return float(raw)


def _resolve_checkpoint_path() -> str:
    checkpoint = os.environ.get("IRODORI_TTS_CHECKPOINT")
    if checkpoint:
        path = Path(checkpoint).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"IRODORI_TTS_CHECKPOINT not found: {path}")
        return str(path)

    repo_id = os.environ.get("IRODORI_TTS_HF_CHECKPOINT", "Aratako/Irodori-TTS-500M-v3")
    return hf_hub_download(repo_id=repo_id, filename="model.safetensors")


class SpeechRequest(BaseModel):
    model: str | None = Field(default=None)
    input: str = Field(min_length=1)
    voice: str | None = Field(default=None)
    response_format: Literal["wav"] = "wav"
    speed: float | None = Field(default=None)


class SpeechJobResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    chunk_count: int = Field(alias="chunkCount")

    model_config = {"populate_by_name": True}


class SpeechJobChunk(BaseModel):
    index: int
    status: Literal["pending", "running", "ready", "failed"]
    text: str
    audio_url: str | None = Field(default=None, alias="audioUrl")
    error: str | None = None

    model_config = {"populate_by_name": True}


class SpeechJobStatusResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: Literal["pending", "running", "ready", "failed"]
    chunks: list[SpeechJobChunk]

    model_config = {"populate_by_name": True}


class SpeechChunkState:
    def __init__(self, index: int, text: str) -> None:
        self.index = index
        self.text = text
        self.status: Literal["pending", "running", "ready", "failed"] = "pending"
        self.audio: bytes | None = None
        self.error: str | None = None


class SpeechJobState:
    def __init__(self, job_id: str, chunks: list[SpeechChunkState]) -> None:
        self.job_id = job_id
        self.chunks = chunks
        self.created_at = time.monotonic()
        self.status: Literal["pending", "running", "ready", "failed"] = "pending"


class SpeechJobStore:
    def __init__(self, ttl_seconds: float = 30 * 60) -> None:
        self._jobs: dict[str, SpeechJobState] = {}
        self._ttl_seconds = ttl_seconds

    def create(self, chunks: list[str]) -> SpeechJobState:
        self.prune()
        job_id = uuid.uuid4().hex
        job = SpeechJobState(
            job_id=job_id,
            chunks=[SpeechChunkState(index=index, text=chunk) for index, chunk in enumerate(chunks)],
        )
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> SpeechJobState | None:
        self.prune()
        return self._jobs.get(job_id)

    def prune(self) -> None:
        now = time.monotonic()
        expired_job_ids = [
            job_id
            for job_id, job in self._jobs.items()
            if now - job.created_at > self._ttl_seconds
        ]
        for job_id in expired_job_ids:
            del self._jobs[job_id]


def split_text_for_tts(text: str, max_chars: int = 120) -> list[str]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    chunks: list[str] = []
    for line in normalized.split("\n"):
        block = re.sub(r"[ \t\f\v]+", " ", line).strip()
        if not block:
            continue
        chunks.extend(_split_text_block(block, max_chars=max_chars))

    return chunks


def _split_text_block(text: str, max_chars: int) -> list[str]:
    sentences = [part.strip() for part in re.findall(r".+?(?:[。．！？!?]|$)", text) if part.strip()]
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(_split_long_sentence(sentence, max_chars=max_chars))
            continue

        next_chunk = _join_chunk_text(current, sentence) if current else sentence
        if current and len(next_chunk) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current = next_chunk

    if current:
        chunks.append(current)

    return chunks


def _join_chunk_text(current: str, sentence: str) -> str:
    separator = "" if current.endswith(("。", "．", "！", "？", "!", "?")) else " "
    return f"{current}{separator}{sentence}"


def _split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    chunks: list[str] = []
    current = ""
    parts = [part for part in re.split(r"([、,])", sentence) if part]

    for part in parts:
        next_chunk = f"{current}{part}"
        if current and len(next_chunk) > max_chars:
            chunks.append(current)
            current = part
        else:
            current = next_chunk

    if current:
        chunks.append(current)

    result: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
            continue
        result.extend(chunk[index : index + max_chars] for index in range(0, len(chunk), max_chars))
    return [chunk.strip() for chunk in result if chunk.strip()]


def serialize_job(job: SpeechJobState) -> SpeechJobStatusResponse:
    chunks = [
        SpeechJobChunk(
            index=chunk.index,
            status=chunk.status,
            text=chunk.text,
            audio_url=(
                f"/v1/audio/speech/jobs/{job.job_id}/chunks/{chunk.index}.wav"
                if chunk.status == "ready"
                else None
            ),
            error=chunk.error,
        )
        for chunk in job.chunks
    ]
    return SpeechJobStatusResponse(job_id=job.job_id, status=job.status, chunks=chunks)


class IrodoriTtsService:
    def __init__(self) -> None:
        runtime_device = default_runtime_device()
        self.model_device = os.environ.get("IRODORI_TTS_MODEL_DEVICE", runtime_device)
        self.codec_device = os.environ.get("IRODORI_TTS_CODEC_DEVICE", runtime_device)
        self.model_precision = os.environ.get("IRODORI_TTS_MODEL_PRECISION", "fp32")
        self.codec_precision = os.environ.get("IRODORI_TTS_CODEC_PRECISION", "fp32")
        self.codec_repo = os.environ.get(
            "IRODORI_TTS_CODEC_REPO", "Aratako/Semantic-DACVAE-Japanese-32dim"
        )
        self.caption = os.environ.get("IRODORI_TTS_CAPTION")
        self.no_ref = _env_bool("IRODORI_TTS_NO_REF", True)
        self.ref_wav = os.environ.get("IRODORI_TTS_REF_WAV")
        self.ref_latent = os.environ.get("IRODORI_TTS_REF_LATENT")
        self.ref_embed = os.environ.get("IRODORI_TTS_REF_EMBED")
        self.num_steps = _env_int("IRODORI_TTS_NUM_STEPS", 6)
        self.t_schedule_mode = os.environ.get("IRODORI_TTS_T_SCHEDULE_MODE", "sway")
        self.sway_coeff = _env_float("IRODORI_TTS_SWAY_COEFF", -1.0)
        self.duration_scale = _env_float("IRODORI_TTS_DURATION_SCALE", 1.0)
        self.seconds = _optional_env_float("IRODORI_TTS_SECONDS")
        self.cfg_guidance_mode = os.environ.get("IRODORI_TTS_CFG_GUIDANCE_MODE", "independent")
        self.cfg_scale_text = _env_float("IRODORI_TTS_CFG_SCALE_TEXT", 3.0)
        self.cfg_scale_caption = _env_float("IRODORI_TTS_CFG_SCALE_CAPTION", 3.0)
        self.cfg_scale_speaker = _env_float("IRODORI_TTS_CFG_SCALE_SPEAKER", 5.0)
        self.cfg_min_t = _env_float("IRODORI_TTS_CFG_MIN_T", 0.5)
        self.cfg_max_t = _env_float("IRODORI_TTS_CFG_MAX_T", 1.0)
        self.compile_model = _env_bool("IRODORI_TTS_COMPILE_MODEL", False)
        self.compile_dynamic = _env_bool("IRODORI_TTS_COMPILE_DYNAMIC", False)
        self._runtime: InferenceRuntime | None = None
        self._lock = asyncio.Lock()

    @property
    def loaded(self) -> bool:
        return self._runtime is not None

    def _load_runtime(self) -> InferenceRuntime:
        if self._runtime is not None:
            return self._runtime

        checkpoint_path = _resolve_checkpoint_path()
        self._runtime = InferenceRuntime.from_key(
            RuntimeKey(
                checkpoint=checkpoint_path,
                model_device=self.model_device,
                codec_repo=self.codec_repo,
                model_precision=self.model_precision,
                codec_device=self.codec_device,
                codec_precision=self.codec_precision,
                compile_model=self.compile_model,
                compile_dynamic=self.compile_dynamic,
            )
        )
        return self._runtime

    def _synthesize_to_wav_bytes(self, text: str) -> bytes:
        runtime = self._load_runtime()
        use_caption_condition = bool(
            runtime.model_cfg.use_caption_condition and self.caption is not None and self.caption.strip()
        )
        use_speaker_condition = bool(
            runtime.model_cfg.use_speaker_condition_resolved and not self.no_ref
        )
        cfg_scale_text, cfg_scale_caption, cfg_scale_speaker, _messages = resolve_cfg_scales(
            cfg_guidance_mode=self.cfg_guidance_mode,
            cfg_scale_text=self.cfg_scale_text,
            cfg_scale_caption=self.cfg_scale_caption,
            cfg_scale_speaker=self.cfg_scale_speaker,
            cfg_scale=None,
            use_caption_condition=use_caption_condition,
            use_speaker_condition=use_speaker_condition,
        )
        result = runtime.synthesize(
            SamplingRequest(
                text=text,
                caption=self.caption,
                ref_wav=self.ref_wav,
                ref_latent=self.ref_latent,
                ref_embed=self.ref_embed,
                no_ref=self.no_ref,
                seconds=self.seconds,
                duration_scale=self.duration_scale,
                num_steps=self.num_steps,
                cfg_scale_text=cfg_scale_text,
                cfg_scale_caption=cfg_scale_caption,
                cfg_scale_speaker=cfg_scale_speaker,
                cfg_guidance_mode=self.cfg_guidance_mode,
                cfg_min_t=self.cfg_min_t,
                cfg_max_t=self.cfg_max_t,
                t_schedule_mode=self.t_schedule_mode,
                sway_coeff=self.sway_coeff,
            ),
            log_fn=None,
        )

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            save_wav(tmp_path, result.audio, result.sample_rate)
            return tmp_path.read_bytes()
        finally:
            tmp_path.unlink(missing_ok=True)

    async def synthesize(self, text: str) -> bytes:
        async with self._lock:
            return await asyncio.to_thread(self._synthesize_to_wav_bytes, text)


service = IrodoriTtsService()
jobs = SpeechJobStore()
app = FastAPI(title="expo-sanpo Irodori-TTS server")


@app.on_event("startup")
async def prewarm() -> None:
    text = os.environ.get("IRODORI_TTS_PREWARM_TEXT")
    if text:
        await service.synthesize(text)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "loaded": service.loaded,
        "irodoriTtsDir": str(IRODORI_TTS_DIR),
        "modelDevice": service.model_device,
        "codecDevice": service.codec_device,
        "numSteps": service.num_steps,
        "tScheduleMode": service.t_schedule_mode,
        "swayCoeff": service.sway_coeff,
    }


async def run_speech_job(job: SpeechJobState) -> None:
    job.status = "running"
    for chunk in job.chunks:
        chunk.status = "running"
        try:
            chunk.audio = await service.synthesize(chunk.text)
            chunk.status = "ready"
        except Exception as error:  # noqa: BLE001
            chunk.status = "failed"
            chunk.error = str(error)
            job.status = "failed"
            return
    job.status = "ready"


@app.post("/v1/audio/speech/jobs")
async def create_speech_job(request: SpeechRequest) -> SpeechJobResponse:
    if request.response_format != "wav":
        raise HTTPException(status_code=400, detail="Only wav response_format is supported.")

    chunks = split_text_for_tts(request.input)
    if not chunks:
        raise HTTPException(status_code=400, detail="input is required.")

    job = jobs.create(chunks)
    asyncio.create_task(run_speech_job(job))
    return SpeechJobResponse(job_id=job.job_id, chunk_count=len(job.chunks))


@app.get("/v1/audio/speech/jobs/{job_id}")
async def get_speech_job(job_id: str) -> SpeechJobStatusResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Speech job was not found.")
    return serialize_job(job)


@app.get("/v1/audio/speech/jobs/{job_id}/chunks/{chunk_index}.wav")
async def get_speech_job_chunk(job_id: str, chunk_index: int) -> Response:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Speech job was not found.")

    if chunk_index < 0 or chunk_index >= len(job.chunks):
        raise HTTPException(status_code=404, detail="Speech chunk was not found.")

    chunk = job.chunks[chunk_index]
    if chunk.status != "ready" or chunk.audio is None:
        raise HTTPException(status_code=409, detail="Speech chunk is not ready.")

    return Response(content=chunk.audio, media_type="audio/wav")


@app.post("/v1/audio/speech")
async def create_speech(request: SpeechRequest) -> Response:
    if request.response_format != "wav":
        raise HTTPException(status_code=400, detail="Only wav response_format is supported.")

    audio = await service.synthesize(request.input)
    return Response(content=audio, media_type="audio/wav")
