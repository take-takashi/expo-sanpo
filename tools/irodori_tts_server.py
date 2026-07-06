from __future__ import annotations

import asyncio
import os
import sys
import tempfile
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


@app.post("/v1/audio/speech")
async def create_speech(request: SpeechRequest) -> Response:
    if request.response_format != "wav":
        raise HTTPException(status_code=400, detail="Only wav response_format is supported.")

    audio = await service.synthesize(request.input)
    return Response(content=audio, media_type="audio/wav")
