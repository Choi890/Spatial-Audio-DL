from __future__ import annotations

import importlib.util
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


ANALYSIS_SR = 22050
MAX_BODY_BYTES = 420 * 1024 * 1024
TARGET_TIMELINE_POINTS = 900


@dataclass(frozen=True)
class Instrument:
    id: str
    label: str
    family: str
    x: float
    y: float
    z: float
    freq: float
    q: float
    color: str


INSTRUMENTS: tuple[Instrument, ...] = (
    Instrument("violins1", "제1바이올린", "strings", -3.7, 0.2, -1.35, 2300, 0.82, "#78a95d"),
    Instrument("violins2", "제2바이올린", "strings", -2.15, 0.1, -1.75, 1600, 0.78, "#71a7c7"),
    Instrument("violas", "비올라", "strings", -0.55, 0.05, -1.95, 820, 0.92, "#9a9a62"),
    Instrument("cellos", "첼로", "strings", 1.35, 0.0, -1.7, 360, 0.95, "#d4a84d"),
    Instrument("basses", "더블베이스", "strings", 3.2, 0.0, -1.35, 115, 0.9, "#a07058"),
    Instrument("flute", "플루트", "woodwinds", -1.3, 0.15, -3.05, 3600, 0.7, "#a9c9a2"),
    Instrument("oboe", "오보에", "woodwinds", -0.35, 0.12, -3.1, 1900, 0.8, "#d5bc75"),
    Instrument("clarinet", "클라리넷", "woodwinds", 0.55, 0.08, -3.1, 1050, 0.82, "#77a36c"),
    Instrument("bassoon", "바순", "woodwinds", 1.35, 0.05, -3.0, 420, 0.9, "#a67c52"),
    Instrument("horn", "호른", "brass", -1.75, 0.35, -4.25, 520, 0.86, "#cfaa62"),
    Instrument("trumpet", "트럼펫", "brass", 0.55, 0.45, -4.35, 2100, 0.75, "#e68355"),
    Instrument("trombone", "트롬본", "brass", 1.65, 0.4, -4.45, 760, 0.82, "#c46b50"),
    Instrument("timpani", "팀파니", "percussion", -2.85, 0.15, -5.05, 105, 0.92, "#955251"),
    Instrument("percussion", "퍼커션", "percussion", 2.85, 0.55, -5.1, 4300, 0.72, "#d1795c"),
    Instrument("harp", "하프", "plucked", -3.15, 0.25, -3.45, 3100, 0.62, "#f2b38f"),
    Instrument("piano", "피아노", "keyboard", -2.35, 0.2, -3.7, 1250, 0.72, "#d6c4a0"),
)


INSTRUMENT_BY_ID = {instrument.id: instrument for instrument in INSTRUMENTS}


def load_audio(input_path: Path) -> tuple[np.ndarray, int]:
    try:
        data, sample_rate = sf.read(str(input_path), always_2d=True, dtype="float32")
        return np.nan_to_num(data), int(sample_rate)
    except Exception:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise
        converted = input_path.with_suffix(".decoded.wav")
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(input_path),
            "-vn",
            "-acodec",
            "pcm_f32le",
            str(converted),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=240)
        data, sample_rate = sf.read(str(converted), always_2d=True, dtype="float32")
        return np.nan_to_num(data), int(sample_rate)


def resample_linear(samples: np.ndarray, source_sr: int, target_sr: int) -> np.ndarray:
    if source_sr == target_sr or len(samples) == 0:
        return samples.astype(np.float32, copy=False)
    duration = len(samples) / float(source_sr)
    target_count = max(1, int(round(duration * target_sr)))
    old_x = np.linspace(0.0, duration, len(samples), endpoint=False, dtype=np.float64)
    new_x = np.linspace(0.0, duration, target_count, endpoint=False, dtype=np.float64)
    return np.interp(new_x, old_x, samples).astype(np.float32)


def stft_magnitude(samples: np.ndarray, n_fft: int, hop_length: int) -> np.ndarray:
    samples = np.asarray(samples, dtype=np.float32)
    if len(samples) == 0:
        return np.zeros((n_fft // 2 + 1, 1), dtype=np.float32)
    pad = n_fft // 2
    padded = np.pad(samples, (pad, pad), mode="constant")
    frame_count = max(1, 1 + (len(padded) - n_fft) // hop_length)
    shape = (frame_count, n_fft)
    strides = (padded.strides[0] * hop_length, padded.strides[0])
    frames = np.lib.stride_tricks.as_strided(padded, shape=shape, strides=strides).copy()
    window = np.hanning(n_fft).astype(np.float32)
    spectrum = np.fft.rfft(frames * window[None, :], axis=1)
    return np.abs(spectrum).T.astype(np.float32)


def frame_rms(samples: np.ndarray, n_fft: int, hop_length: int, frame_count: int) -> np.ndarray:
    samples = np.asarray(samples, dtype=np.float32)
    pad = n_fft // 2
    padded = np.pad(samples, (pad, pad), mode="constant")
    values = np.zeros(frame_count, dtype=np.float32)
    for index in range(frame_count):
        start = index * hop_length
        frame = padded[start : start + n_fft]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))
        values[index] = float(np.sqrt(np.mean(frame * frame) + 1e-12))
    return values


def spectral_flux(magnitude: np.ndarray) -> np.ndarray:
    log_mag = np.log1p(magnitude)
    diff = np.diff(log_mag, axis=1, prepend=log_mag[:, :1])
    flux = np.mean(np.maximum(diff, 0), axis=0)
    return normalize_curve(flux)


def spectral_centroid(magnitude: np.ndarray, freqs: np.ndarray) -> np.ndarray:
    denom = np.sum(magnitude, axis=0) + 1e-9
    return (np.sum(magnitude * freqs[:, None], axis=0) / denom).astype(np.float32)


def spectral_rolloff(power: np.ndarray, freqs: np.ndarray, roll_percent: float) -> np.ndarray:
    cumulative = np.cumsum(power, axis=0)
    threshold = cumulative[-1, :] * roll_percent
    indices = np.argmax(cumulative >= threshold[None, :], axis=0)
    return freqs[np.clip(indices, 0, len(freqs) - 1)].astype(np.float32)


def spectral_flatness(magnitude: np.ndarray) -> np.ndarray:
    safe = np.maximum(magnitude, 1e-9)
    geometric = np.exp(np.mean(np.log(safe), axis=0))
    arithmetic = np.mean(safe, axis=0) + 1e-9
    return np.clip(geometric / arithmetic, 0, 1).astype(np.float32)


def zero_crossing_rate(samples: np.ndarray, n_fft: int, hop_length: int, frame_count: int) -> np.ndarray:
    pad = n_fft // 2
    padded = np.pad(samples, (pad, pad), mode="constant")
    values = np.zeros(frame_count, dtype=np.float32)
    for index in range(frame_count):
        frame = padded[index * hop_length : index * hop_length + n_fft]
        if len(frame) < 2:
            continue
        signs = np.signbit(frame)
        values[index] = float(np.mean(signs[1:] != signs[:-1]))
    return values


def chromagram_from_magnitude(power: np.ndarray, freqs: np.ndarray) -> np.ndarray:
    chroma = np.zeros((12, power.shape[1]), dtype=np.float32)
    valid = freqs > 27.5
    valid_freqs = freqs[valid]
    if valid_freqs.size == 0:
        return chroma
    midi = np.rint(12 * np.log2(valid_freqs / 440.0) + 69).astype(int)
    pitch_classes = np.mod(midi, 12)
    for pitch_class in range(12):
        mask = pitch_classes == pitch_class
        if np.any(mask):
            chroma[pitch_class] = np.sum(power[valid][mask], axis=0)
    denom = np.max(chroma, axis=0, keepdims=True) + 1e-9
    return np.clip(chroma / denom, 0, 1)


def estimate_tempo(onset_env: np.ndarray, sample_rate: int, hop_length: int) -> float:
    onset = normalize_curve(onset_env)
    if onset.size < 8 or np.max(onset) <= 0:
        return 0.0
    onset = onset - np.mean(onset)
    corr = np.correlate(onset, onset, mode="full")[len(onset) - 1 :]
    min_bpm, max_bpm = 50, 190
    min_lag = max(1, int(round((60 * sample_rate) / (max_bpm * hop_length))))
    max_lag = min(len(corr) - 1, int(round((60 * sample_rate) / (min_bpm * hop_length))))
    if max_lag <= min_lag:
        return 0.0
    lag = int(np.argmax(corr[min_lag : max_lag + 1]) + min_lag)
    return round(float(60 * sample_rate / (lag * hop_length)), 1)


def mel_filterbank(
    *,
    sample_rate: int,
    n_fft: int,
    n_mels: int,
    fmin: float,
    fmax: float,
) -> tuple[np.ndarray, np.ndarray]:
    def hz_to_mel(freq: np.ndarray | float) -> np.ndarray | float:
        return 2595.0 * np.log10(1.0 + np.asarray(freq) / 700.0)

    def mel_to_hz(mel: np.ndarray | float) -> np.ndarray | float:
        return 700.0 * (10 ** (np.asarray(mel) / 2595.0) - 1.0)

    mel_points = np.linspace(hz_to_mel(fmin), hz_to_mel(fmax), n_mels + 2)
    hz_points = mel_to_hz(mel_points).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)
    filters = np.zeros((n_mels, len(freqs)), dtype=np.float32)
    for index in range(n_mels):
        left, center, right = hz_points[index], hz_points[index + 1], hz_points[index + 2]
        left_slope = (freqs - left) / max(center - left, 1e-9)
        right_slope = (right - freqs) / max(right - center, 1e-9)
        filters[index] = np.maximum(0, np.minimum(left_slope, right_slope))
        total = np.sum(filters[index])
        if total > 0:
            filters[index] /= total
    return filters, hz_points[1:-1]


def analyze_audio(
    input_path: Path,
    *,
    job_id: str,
    output_dir: Path,
    request_demucs: bool = False,
) -> dict[str, Any]:
    y, source_sr = load_audio(input_path)
    if y.ndim == 1:
        channels = 1
        mono = y.astype(np.float32, copy=False)
    else:
        channels = int(y.shape[1])
        mono = np.mean(y, axis=1).astype(np.float32, copy=False)

    if source_sr != ANALYSIS_SR:
        mono_analysis = resample_linear(mono, source_sr, ANALYSIS_SR)
    else:
        mono_analysis = mono

    mono_analysis = np.nan_to_num(mono_analysis.astype(np.float32, copy=False))
    duration = float(len(mono) / max(1, source_sr))
    hop_length = choose_hop_length(len(mono_analysis))
    n_fft = 4096

    magnitude = stft_magnitude(mono_analysis, n_fft=n_fft, hop_length=hop_length)
    power = magnitude**2
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / ANALYSIS_SR).astype(np.float32)
    times = (np.arange(magnitude.shape[1], dtype=np.float32) * hop_length / ANALYSIS_SR).astype(np.float32)

    rms = frame_rms(mono_analysis, n_fft=n_fft, hop_length=hop_length, frame_count=magnitude.shape[1])
    onset_env = spectral_flux(magnitude)
    centroid = spectral_centroid(magnitude, freqs)
    rolloff = spectral_rolloff(power, freqs, roll_percent=0.85)
    flatness = spectral_flatness(magnitude)
    zcr = zero_crossing_rate(mono_analysis, n_fft=n_fft, hop_length=hop_length, frame_count=magnitude.shape[1])
    chroma = chromagram_from_magnitude(power, freqs)

    tempo = estimate_tempo(onset_env, ANALYSIS_SR, hop_length)

    nmf_result = run_nmf_instrument_model(mono_analysis, hop_length, n_fft)
    curves = refine_instrument_curves(
        nmf_result["curves"],
        rms=rms,
        onset_env=onset_env,
        centroid=centroid,
        flatness=flatness,
    )

    active_ids = select_active_instruments(curves)
    waveform = make_waveform_preview(mono, 720)
    mix = analyze_mix(mono, source_sr, rms, centroid, rolloff, flatness, zcr)
    remaster = build_remaster_profile(mix, active_ids)
    key = estimate_key(chroma)
    sections = build_sections(times, rms, centroid, onset_env, curves, duration)
    demucs = inspect_demucs(request_demucs, input_path, output_dir, job_id)

    return {
        "jobId": job_id,
        "file": {
            "name": input_path.name,
            "sampleRate": int(source_sr),
            "channels": channels,
            "duration": duration,
        },
        "models": {
            "primary": "NMF Instrument Activity v2",
            "features": "NumPy STFT/chroma/onset/spectral features",
            "deepSeparator": demucs,
        "notes": [
            "NMF is kept as a fast fallback analysis path.",
            "Demucs stems are preferred for spatial rendering when available.",
        ],
        },
        "timeline": {
            "times": compress_series(times.tolist(), 4),
            "rms": compress_series(normalize_curve(rms).tolist(), 4),
            "onset": compress_series(normalize_curve(onset_env).tolist(), 4),
            "centroid": compress_series(normalize_curve(centroid).tolist(), 4),
        },
        "waveform": waveform,
        "tempo": {"bpm": round(tempo, 1), "confidence": estimate_tempo_confidence(onset_env)},
        "key": key,
        "mix": mix,
        "remaster": remaster,
        "instruments": [
            build_instrument_payload(instrument, curves[instrument.id], active_ids)
            for instrument in INSTRUMENTS
        ],
        "activeIds": active_ids,
        "sections": sections,
        "recommendations": build_recommendations(active_ids, mix, demucs, remaster),
    }


def choose_hop_length(sample_count: int) -> int:
    if sample_count <= 0:
        return 512
    raw = int(math.ceil(sample_count / TARGET_TIMELINE_POINTS))
    return int(np.clip(round_to_powerish(raw), 512, 8192))


def round_to_powerish(value: int) -> int:
    choices = np.array([512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192])
    return int(choices[np.argmin(np.abs(choices - value))])


def run_nmf_instrument_model(samples: np.ndarray, hop_length: int, n_fft: int) -> dict[str, Any]:
    magnitude = stft_magnitude(samples, n_fft=n_fft, hop_length=hop_length)
    filterbank, mel_freqs = mel_filterbank(
        sample_rate=ANALYSIS_SR,
        n_fft=n_fft,
        n_mels=176,
        fmin=30,
        fmax=min(11000, ANALYSIS_SR // 2),
    )
    mel = (filterbank @ magnitude).astype(np.float32)

    scale = np.percentile(mel, 96) + 1e-7
    x = np.log1p((mel / scale) * 14.0)
    x = np.maximum(x.T, 1e-7)
    component_count = int(np.clip(x.shape[0] // 28, 14, 28))
    component_count = min(component_count, x.shape[0] - 1, x.shape[1] - 1)
    if component_count < 4:
        component_count = 4

    activations, spectra = numpy_nmf(x, component_count, max_iter=160)

    curves = {instrument.id: np.zeros(activations.shape[0], dtype=np.float32) for instrument in INSTRUMENTS}
    component_payloads: list[dict[str, Any]] = []

    for component_index in range(component_count):
        spectrum = spectra[component_index]
        activation = activations[:, component_index]
        scores = classify_component(spectrum, activation, mel_freqs)
        activation = normalize_curve(activation)
        activation = fast_attack_release(activation, release=0.42)

        for instrument_id, score in scores.items():
            curves[instrument_id] += activation * float(score)

        top = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:3]
        component_payloads.append(
            {
                "index": component_index,
                "top": [{"id": key, "score": round(float(score), 4)} for key, score in top],
            }
        )

    global_peak = np.percentile(np.concatenate([curve for curve in curves.values()]), 97) + 1e-8
    for instrument_id, curve in curves.items():
        curves[instrument_id] = normalize_activity_curve(curve, instrument_id, scale=float(global_peak))

    return {"curves": curves, "components": component_payloads}


def numpy_nmf(x: np.ndarray, component_count: int, max_iter: int = 140) -> tuple[np.ndarray, np.ndarray]:
    matrix = np.maximum(np.asarray(x, dtype=np.float32), 1e-7)
    frames, bins = matrix.shape
    rng = np.random.default_rng(13)
    activations = rng.random((frames, component_count), dtype=np.float32) * 0.12 + 0.08
    spectra = rng.random((component_count, bins), dtype=np.float32) * 0.12 + 0.08
    eps = np.float32(1e-7)

    for iteration in range(max_iter):
        numerator_h = activations.T @ matrix
        denominator_h = (activations.T @ activations @ spectra) + eps
        spectra *= numerator_h / denominator_h

        numerator_w = matrix @ spectra.T
        denominator_w = (activations @ spectra @ spectra.T) + eps
        activations *= numerator_w / denominator_w

        if iteration % 12 == 0:
            norms = np.maximum(np.linalg.norm(spectra, axis=1, keepdims=True), eps)
            spectra /= norms
            activations *= norms.T

    return np.nan_to_num(activations).astype(np.float32), np.nan_to_num(spectra).astype(np.float32)


def classify_component(spectrum: np.ndarray, activation: np.ndarray, freqs: np.ndarray) -> dict[str, float]:
    spectrum = np.maximum(np.asarray(spectrum, dtype=np.float32), 0)
    activation = np.maximum(np.asarray(activation, dtype=np.float32), 0)
    total = float(np.sum(spectrum) + 1e-9)
    centroid = float(np.sum(freqs * spectrum) / total)
    spread = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * spectrum) / total))
    p95 = float(np.percentile(activation, 95) + 1e-7)
    activation_norm = np.clip(activation / p95, 0, 2)
    diff = np.diff(activation_norm, prepend=activation_norm[0])
    attack = float(np.mean(np.maximum(diff, 0)) * 6.0)
    sparseness = float(np.mean(activation_norm > 0.48))
    sustain = clamp01(1.0 - attack * 0.72 + sparseness * 0.18)

    low = band_ratio(spectrum, freqs, 35, 180)
    bass = band_ratio(spectrum, freqs, 80, 320)
    low_mid = band_ratio(spectrum, freqs, 220, 700)
    mid = band_ratio(spectrum, freqs, 650, 1800)
    presence = band_ratio(spectrum, freqs, 1800, 4300)
    string_air = band_ratio(spectrum, freqs, 2600, 7200)
    air = band_ratio(spectrum, freqs, 6500, 10500)
    broad = clamp01((low + bass + low_mid + mid + presence + air * 0.6) * 1.42)
    tonal = clamp01(1.0 - (spread / max(centroid + 250, 1)) * 0.62)
    percussive = clamp01(attack * 0.95 + (1.0 - sparseness) * 0.05)

    string_sustain = clamp01((presence * 1.15 + string_air * 0.85 + mid * 0.45) * tonal * (0.56 + sustain * 0.75))
    string_staccato = clamp01((presence * 1.05 + string_air * 0.92 + mid * 0.36) * tonal * (0.45 + percussive * 0.9))
    piano_body = clamp01((bass * 0.55 + low_mid * 0.8 + mid * 0.72 + presence * 0.42) * broad)
    piano_score = clamp01((piano_body * (0.54 + percussive * 0.8) * (0.58 + tonal * 0.48)) - air * 0.12)
    harp_score = clamp01((presence * 0.7 + air * 0.9 + string_air * 0.46) * percussive * tonal * (1.0 - low_mid * 0.38))
    woodwind_core = clamp01((mid * 0.8 + presence * 0.52 + string_air * 0.22) * tonal * (0.7 + sustain * 0.5))
    brass_core = clamp01((low_mid * 0.55 + mid * 0.88 + presence * 0.72) * (0.52 + percussive * 0.35) * (1.0 - air * 0.24))
    percussion_core = clamp01((presence * 0.35 + air * 0.82 + string_air * 0.45) * (0.45 + percussive * 1.2) * (1.0 - tonal * 0.2))

    scores = {
        "basses": bell(centroid, 90, 0.75) * (low * 1.2 + bass * 0.9) * (0.6 + sustain),
        "cellos": bell(centroid, 360, 0.72) * (bass * 0.5 + low_mid * 1.1 + mid * 0.25) * (0.62 + sustain),
        "violas": bell(centroid, 820, 0.62) * (low_mid * 0.65 + mid * 1.1 + presence * 0.26) * (0.58 + string_sustain),
        "violins2": bell(centroid, 1450, 0.6) * (mid * 0.58 + presence * 1.0 + string_air * 0.42) * (0.54 + string_sustain + string_staccato * 0.6),
        "violins1": bell(centroid, 2450, 0.68) * (presence * 1.02 + string_air * 0.72 + mid * 0.22) * (0.48 + string_sustain + string_staccato * 0.72),
        "flute": bell(centroid, 3600, 0.58) * woodwind_core * (0.65 + air * 0.35),
        "oboe": bell(centroid, 1800, 0.46) * woodwind_core * (0.8 + presence * 0.28),
        "clarinet": bell(centroid, 950, 0.55) * woodwind_core * (0.8 + mid * 0.25),
        "bassoon": bell(centroid, 430, 0.5) * woodwind_core * (0.8 + low_mid * 0.45),
        "horn": bell(centroid, 620, 0.58) * brass_core * (0.85 + sustain * 0.25),
        "trumpet": bell(centroid, 2150, 0.55) * brass_core * (0.8 + presence * 0.35),
        "trombone": bell(centroid, 780, 0.54) * brass_core * (0.82 + low_mid * 0.28),
        "timpani": bell(centroid, 115, 0.64) * (low + bass * 0.7) * (0.55 + percussive),
        "percussion": percussion_core,
        "harp": harp_score,
        "piano": piano_score * bell(centroid, 1150, 0.95),
    }

    string_max = max(scores["violins1"], scores["violins2"], scores["violas"], scores["cellos"])
    if string_staccato > 0.46 and string_max > 0.08:
        scores["harp"] *= 0.28
        scores["piano"] *= 0.62
        scores["violins1"] *= 1.35
        scores["violins2"] *= 1.28
        scores["violas"] *= 1.14

    if piano_score > 0.22 and broad > 0.52 and low_mid + bass > 0.15:
        scores["piano"] *= 1.42
        scores["harp"] *= 0.68
        if string_staccato < 0.5 and string_sustain < 0.58:
            for key in ("violins1", "violins2", "violas", "cellos"):
                scores[key] *= 0.72

    if harp_score > 0.2 and low_mid < 0.12 and bass < 0.06:
        scores["harp"] *= 1.35
        scores["piano"] *= 0.58

    string_raw = max(scores["violins1"], scores["violins2"], scores["violas"], scores["cellos"])
    wind_raw = max(scores["flute"], scores["oboe"], scores["clarinet"], scores["bassoon"])
    brass_raw = max(scores["horn"], scores["trumpet"], scores["trombone"])
    if (string_sustain > 0.32 or string_staccato > 0.44) and string_raw >= max(wind_raw, brass_raw) * 0.62:
        for key in ("flute", "oboe", "clarinet", "bassoon"):
            scores[key] *= 0.28
        for key in ("horn", "trumpet", "trombone"):
            scores[key] *= 0.32
    if piano_score > 0.3 and piano_body > 0.28:
        for key in ("horn", "trumpet", "trombone", "oboe", "clarinet"):
            scores[key] *= 0.58

    positive = {key: max(0.0, float(value)) for key, value in scores.items()}
    max_score = max(positive.values()) if positive else 0.0
    if max_score <= 0:
        return {key: 0.0 for key in positive}
    filtered = {
        key: value if value >= max_score * 0.24 and value >= 0.018 else 0.0
        for key, value in positive.items()
    }
    if not any(value > 0 for value in filtered.values()):
        best_key = max(positive, key=positive.get)
        filtered[best_key] = positive[best_key]
    total_score = sum(filtered.values()) + 1e-9
    return {key: clamp01(value / total_score) for key, value in filtered.items()}


def band_ratio(spectrum: np.ndarray, freqs: np.ndarray, low: float, high: float) -> float:
    mask = (freqs >= low) & (freqs < high)
    if not np.any(mask):
        return 0.0
    return float(np.sum(spectrum[mask]) / (np.sum(spectrum) + 1e-9))


def bell(value: float, center: float, width: float) -> float:
    if value <= 0 or center <= 0:
        return 0.0
    return float(math.exp(-((math.log(value / center) ** 2) / (2 * width * width))))


def refine_instrument_curves(
    curves: dict[str, np.ndarray],
    *,
    rms: np.ndarray,
    onset_env: np.ndarray,
    centroid: np.ndarray,
    flatness: np.ndarray,
) -> dict[str, np.ndarray]:
    rms_n = normalize_curve(rms)
    onset_n = normalize_curve(onset_env)
    centroid_n = normalize_curve(centroid)
    flatness_n = normalize_curve(flatness)
    length = len(rms_n)

    refined: dict[str, np.ndarray] = {}
    for instrument in INSTRUMENTS:
        curve = resize_curve(curves[instrument.id], length)
        if instrument.family == "strings":
            bow_gate = clamp_curve(0.58 + centroid_n * 0.32 - flatness_n * 0.24 + onset_n * 0.18)
            curve = curve * bow_gate
        elif instrument.family == "woodwinds":
            wind_gate = clamp_curve(0.62 + centroid_n * 0.22 - onset_n * 0.2 - flatness_n * 0.16)
            curve = curve * wind_gate
        elif instrument.family == "brass":
            brass_gate = clamp_curve(0.54 + centroid_n * 0.18 + onset_n * 0.16 - flatness_n * 0.08)
            curve = curve * brass_gate
        elif instrument.id == "piano":
            piano_gate = clamp_curve(0.48 + onset_n * 0.42 + rms_n * 0.28 - flatness_n * 0.16)
            curve = curve * piano_gate
        elif instrument.id == "harp":
            harp_gate = clamp_curve(0.42 + onset_n * 0.52 + centroid_n * 0.24 - rms_n * 0.08)
            curve = curve * harp_gate
        elif instrument.family == "percussion":
            curve = curve * clamp_curve(0.35 + onset_n * 0.88 + flatness_n * 0.32)

        refined[instrument.id] = normalize_activity_curve(
            curve * clamp_curve(rms_n * 1.15 + 0.08),
            instrument.id,
            scale=1.0,
        )

    suppress_false_harp_from_strings(refined)
    suppress_false_strings_from_piano(refined)
    suppress_false_winds_from_strings(refined)
    suppress_false_brass_from_strings(refined)
    suppress_false_percussion_from_piano(refined)
    return refined


def suppress_false_harp_from_strings(curves: dict[str, np.ndarray]) -> None:
    string_curve = np.maximum.reduce([curves["violins1"], curves["violins2"], curves["violas"], curves["cellos"]])
    strong_string = np.clip((string_curve - 0.34) / 0.48, 0, 1)
    curves["harp"] *= 1.0 - strong_string * 0.74
    curves["piano"] *= 1.0 - strong_string * 0.34


def suppress_false_strings_from_piano(curves: dict[str, np.ndarray]) -> None:
    piano_curve = curves["piano"]
    piano_protect = np.clip((piano_curve - 0.28) / 0.45, 0, 1)
    for instrument_id in ("violins1", "violins2", "violas", "cellos"):
        curve = curves[instrument_id]
        protect = np.clip(piano_protect * (1.0 - np.clip((curve - piano_curve * 0.82) / 0.34, 0, 1)), 0, 1)
        curves[instrument_id] *= 1.0 - protect * 0.66


def suppress_false_winds_from_strings(curves: dict[str, np.ndarray]) -> None:
    string_curve = np.maximum.reduce([curves["violins1"], curves["violins2"], curves["violas"]])
    protect = np.clip((string_curve - 0.42) / 0.4, 0, 1)
    for instrument_id in ("flute", "oboe", "clarinet"):
        curves[instrument_id] *= 1.0 - protect * 0.42


def suppress_false_brass_from_strings(curves: dict[str, np.ndarray]) -> None:
    string_curve = np.maximum.reduce([curves["violins1"], curves["violins2"], curves["violas"], curves["cellos"]])
    for instrument_id in ("horn", "trumpet", "trombone", "bassoon"):
        curve = curves[instrument_id]
        protect = np.clip((string_curve - curve * 0.55 - 0.22) / 0.42, 0, 1)
        curves[instrument_id] *= 1.0 - protect * 0.72


def suppress_false_percussion_from_piano(curves: dict[str, np.ndarray]) -> None:
    piano_curve = curves["piano"]
    for instrument_id in ("percussion", "timpani"):
        curve = curves[instrument_id]
        protect = np.clip((piano_curve - curve * 0.62 - 0.18) / 0.38, 0, 1)
        curves[instrument_id] *= 1.0 - protect * 0.55


def normalize_activity_curve(curve: np.ndarray, instrument_id: str, scale: float | None = None) -> np.ndarray:
    curve = np.nan_to_num(np.maximum(curve.astype(np.float32), 0))
    if len(curve) > 5:
        sigma = 0.42 if instrument_id in {"piano", "harp", "percussion", "timpani"} else 0.72
        curve = smooth_curve(curve, sigma=sigma)
    peak = float(scale if scale is not None else np.percentile(curve, 97) + 1e-8)
    curve = np.clip(curve / peak, 0, 1.35)
    curve = fast_attack_release(curve, release=0.34 if instrument_id in {"piano", "harp"} else 0.48)
    return np.clip(curve, 0, 1).astype(np.float32)


def smooth_curve(curve: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0 or len(curve) < 3:
        return curve
    radius = max(1, int(math.ceil(sigma * 4)))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-0.5 * (x / float(sigma)) ** 2)
    kernel /= np.sum(kernel) + 1e-9
    padded = np.pad(curve, (radius, radius), mode="edge")
    return np.convolve(padded, kernel, mode="valid").astype(np.float32)


def fast_attack_release(curve: np.ndarray, release: float = 0.45) -> np.ndarray:
    if len(curve) == 0:
        return curve
    out = np.zeros_like(curve, dtype=np.float32)
    out[0] = curve[0]
    for index in range(1, len(curve)):
        target = float(curve[index])
        if target >= out[index - 1]:
            out[index] = target
        else:
            out[index] = out[index - 1] * release + target * (1.0 - release)
    return out


def select_active_instruments(curves: dict[str, np.ndarray]) -> list[str]:
    active: list[str] = []
    for instrument in INSTRUMENTS:
        curve = curves[instrument.id]
        p90 = float(np.percentile(curve, 90))
        p75 = float(np.percentile(curve, 75))
        peak = float(np.max(curve))
        mean = float(np.mean(curve))
        if instrument.family == "strings":
            threshold = 0.24
        elif instrument.family in {"woodwinds", "brass"}:
            threshold = 0.22
        else:
            threshold = 0.2
        transient_allowed = instrument.id in {"piano", "harp", "percussion", "timpani"}
        sustained_active = p90 >= threshold or mean >= 0.12
        transient_active = transient_allowed and peak >= 0.4 and p75 >= 0.08
        tonal_peak_active = (not transient_allowed) and peak >= 0.55 and p75 >= 0.16
        if sustained_active or transient_active or tonal_peak_active:
            active.append(instrument.id)
    return active


def build_instrument_payload(instrument: Instrument, curve: np.ndarray, active_ids: list[str]) -> dict[str, Any]:
    display_curve = make_display_curve(curve, active=instrument.id in active_ids)
    return {
        "id": instrument.id,
        "label": instrument.label,
        "family": instrument.family,
        "active": instrument.id in active_ids,
        "confidence": round(float(np.percentile(curve, 92)), 4),
        "peak": round(float(np.max(curve)), 4),
        "mean": round(float(np.mean(curve)), 4),
        "position": {"x": instrument.x, "y": instrument.y, "z": instrument.z},
        "filter": {"freq": instrument.freq, "q": instrument.q},
        "color": instrument.color,
        "curve": compress_series(curve.tolist(), 4),
        "displayCurve": compress_series(display_curve.tolist(), 4),
    }


def make_display_curve(curve: np.ndarray, *, active: bool) -> np.ndarray:
    curve = np.asarray(curve, dtype=np.float32)
    if curve.size == 0:
        return curve
    peak = float(np.max(curve))
    if peak < (0.045 if active else 0.075):
        return np.zeros_like(curve, dtype=np.float32)
    scale = max(float(np.percentile(curve, 94)), peak * 0.55, 1e-7)
    visual = np.clip(curve / scale, 0, 1)
    visual = np.where(visual < 0.025, 0, visual)
    visual = np.power(visual, 0.72)
    visual = fast_attack_release(visual.astype(np.float32), release=0.5)
    return np.clip(visual, 0, 1).astype(np.float32)


def analyze_mix(
    mono: np.ndarray,
    sample_rate: int,
    rms: np.ndarray,
    centroid: np.ndarray,
    rolloff: np.ndarray,
    flatness: np.ndarray,
    zcr: np.ndarray,
) -> dict[str, Any]:
    peak = float(np.max(np.abs(mono)) + 1e-9)
    rms_value = float(np.sqrt(np.mean(np.square(mono)) + 1e-12))
    crest = db(peak) - db(rms_value)
    clipping = float(np.mean(np.abs(mono) > 0.995) * 100)
    return {
        "peakDb": round(db(peak), 2),
        "rmsDb": round(db(rms_value), 2),
        "approxLufs": round(db(rms_value) - 1.5, 2),
        "crestDb": round(crest, 2),
        "clippingPercent": round(clipping, 4),
        "centroidHz": round(float(np.mean(centroid)), 1),
        "rolloffHz": round(float(np.mean(rolloff)), 1),
        "flatness": round(float(np.mean(flatness)), 4),
        "zcr": round(float(np.mean(zcr)), 4),
        "sampleRate": int(sample_rate),
    }


def build_remaster_profile(mix: dict[str, Any], active_ids: list[str]) -> dict[str, Any]:
    target_lufs = -16.0
    requested_gain = clamp_value(target_lufs - float(mix["approxLufs"]), -4.5, 7.5)
    peak_limited_gain = min(requested_gain, -1.2 - float(mix["peakDb"]))
    input_gain = clamp_value(peak_limited_gain, -5.5, 6.0)
    centroid = float(mix["centroidHz"])
    flatness = float(mix["flatness"])
    crest = float(mix["crestDb"])
    clipping = float(mix["clippingPercent"])

    low_shelf = clamp_value((1200 - centroid) / 1200 * 1.5, -1.5, 1.6)
    low_mid = -1.1 if centroid < 950 and flatness < 0.13 else clamp_value((flatness - 0.18) * -2.8, -1.2, 0.8)
    presence = clamp_value((1800 - centroid) / 1500 * 1.9, -2.0, 2.1)
    air = clamp_value((2600 - centroid) / 2600 * 1.4 - max(0.0, flatness - 0.18) * 3.0, -2.4, 1.8)
    deharsh = clamp_value(max(0.0, centroid - 2800) / 1600 * -1.8 - max(0.0, flatness - 0.16) * 2.2, -3.2, 0)

    compression_ratio = clamp_value(1.35 + max(0.0, crest - 10.5) * 0.11 + max(0.0, clipping) * 0.4, 1.25, 3.1)
    threshold = clamp_value(-18.0 - max(0.0, crest - 10.0) * 0.8, -30.0, -14.0)
    output_gain = -0.9 if clipping > 0 else -0.55

    if "piano" in active_ids:
        low_mid = min(low_mid, -0.25)
        presence = max(presence, 0.35)
    if any(item in active_ids for item in ("violins1", "violins2", "violas")):
        deharsh = min(deharsh, -0.45)
        air = min(air, 1.1)

    return {
        "enabled": True,
        "targetLufs": target_lufs,
        "inputGainDb": round(input_gain, 2),
        "lowShelfDb": round(low_shelf, 2),
        "lowMidDb": round(low_mid, 2),
        "presenceDb": round(presence, 2),
        "airDb": round(air, 2),
        "deharshDb": round(deharsh, 2),
        "compressor": {
            "thresholdDb": round(threshold, 2),
            "ratio": round(compression_ratio, 2),
            "attack": 0.008,
            "release": 0.16,
        },
        "outputGainDb": round(output_gain, 2),
        "summary": "피크 헤드룸, 중심 주파수, 평탄도, 크레스트를 기반으로 과하지 않은 자동 보정을 적용합니다.",
        "rows": [
            {"label": "Loudness", "value": f"{round(input_gain, 2)} dB input"},
            {"label": "Tone", "value": f"low {round(low_shelf, 2)} / presence {round(presence, 2)} / air {round(air, 2)} dB"},
            {"label": "De-harsh", "value": f"{round(deharsh, 2)} dB"},
            {"label": "Glue", "value": f"{round(compression_ratio, 2)}:1 @ {round(threshold, 2)} dB"},
        ],
    }


def estimate_key(chroma: np.ndarray) -> dict[str, Any]:
    if chroma.size == 0:
        return {"label": "--", "confidence": 0}
    profile = np.mean(chroma, axis=1)
    if float(np.sum(profile)) <= 0:
        return {"label": "--", "confidence": 0}
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    profile = (profile - profile.mean()) / (profile.std() + 1e-9)
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    scores = []
    for index in range(12):
        scores.append((float(np.dot(profile, np.roll(major, index))), f"{names[index]} major"))
        scores.append((float(np.dot(profile, np.roll(minor, index))), f"{names[index]} minor"))
    scores.sort(reverse=True)
    confidence = clamp01((scores[0][0] - scores[1][0]) / (abs(scores[0][0]) + 1e-9))
    return {"label": scores[0][1], "confidence": round(confidence, 3)}


def build_sections(
    times: np.ndarray,
    rms: np.ndarray,
    centroid: np.ndarray,
    onset_env: np.ndarray,
    curves: dict[str, np.ndarray],
    duration: float,
) -> list[dict[str, Any]]:
    count = 8
    sections: list[dict[str, Any]] = []
    length = len(times)
    if length == 0:
        return sections

    for index in range(count):
        start_ratio = index / count
        end_ratio = (index + 1) / count
        lo = int(start_ratio * length)
        hi = max(lo + 1, int(end_ratio * length))
        window = slice(lo, min(hi, length))
        local_scores = {
            instrument_id: float(np.mean(curve[window])) for instrument_id, curve in curves.items()
        }
        leaders = sorted(local_scores.items(), key=lambda item: item[1], reverse=True)[:4]
        sections.append(
            {
                "index": index + 1,
                "start": round(duration * start_ratio, 3),
                "end": round(duration * end_ratio, 3),
                "energy": round(float(np.mean(normalize_curve(rms)[window])), 4),
                "brightness": round(float(np.mean(normalize_curve(centroid)[window])), 4),
                "density": round(float(np.mean(normalize_curve(onset_env)[window])), 4),
                "leaders": [{"id": key, "value": round(value, 4)} for key, value in leaders if value > 0.06],
            }
        )
    return sections


def inspect_demucs(requested: bool, input_path: Path, output_dir: Path, job_id: str) -> dict[str, Any]:
    module_found = importlib.util.find_spec("demucs") is not None
    command_found = shutil.which("demucs") is not None
    available = module_found or command_found
    payload: dict[str, Any] = {
        "name": "Demucs / Hybrid Transformer Demucs",
        "available": available,
        "requested": requested,
        "status": "ready" if available else "not-installed",
        "stems": [],
    }
    if not available or not requested:
        return payload

    stem_root = output_dir / job_id / "demucs"
    stem_root.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "demucs.separate",
        "-n",
        "htdemucs",
        "--float32",
        "--out",
        str(stem_root),
        str(input_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=900)
        stems = sorted(stem_root.rglob("*.wav"))
        payload["status"] = "completed"
        payload["stems"] = [str(path.relative_to(output_dir)).replace("\\", "/") for path in stems]
    except Exception as exc:  # Demucs failures should not break the analysis app.
        payload["status"] = "failed"
        payload["reason"] = str(exc)
    return payload


def build_recommendations(
    active_ids: list[str],
    mix: dict[str, Any],
    demucs: dict[str, Any],
    remaster: dict[str, Any],
) -> list[str]:
    items: list[str] = []
    if "piano" in active_ids:
        items.append("피아노가 감지되어 빠른 어택과 넓은 대역을 보존하는 짧은 릴리즈 게인을 적용합니다.")
    if any(item in active_ids for item in ("violins1", "violins2", "violas", "cellos")):
        items.append("현악군은 스타카토와 지속 보잉을 분리해 하프/피아노 오탐을 억제합니다.")
    if mix["peakDb"] > -0.5:
        items.append("원본 피크가 높아 공간 렌더링에서 자동 헤드룸을 유지하는 편이 좋습니다.")
    if abs(float(remaster["inputGainDb"])) > 0.6 or abs(float(remaster["presenceDb"])) > 0.8:
        items.append("자동 리마스터링은 라우드니스와 톤 밸런스를 소폭 보정하도록 설정되었습니다.")
    if not demucs["available"]:
        items.append("Demucs를 설치하면 실제 딥러닝 stem 분리 결과를 공간 렌더링에 사용할 수 있습니다.")
    return items[:4]


def make_waveform_preview(samples: np.ndarray, points: int) -> list[float]:
    samples = np.asarray(samples, dtype=np.float32)
    if samples.size == 0:
        return []
    frame = max(1, samples.size // points)
    usable = samples[: frame * points]
    if usable.size < frame:
        return [0.0]
    view = usable.reshape(points, frame)
    peaks = np.max(np.abs(view), axis=1)
    return compress_series(normalize_curve(peaks).tolist(), 4)


def resize_curve(curve: np.ndarray, length: int) -> np.ndarray:
    curve = np.asarray(curve, dtype=np.float32)
    if len(curve) == length:
        return curve
    if len(curve) == 0:
        return np.zeros(length, dtype=np.float32)
    x_old = np.linspace(0, 1, len(curve))
    x_new = np.linspace(0, 1, length)
    return np.interp(x_new, x_old, curve).astype(np.float32)


def normalize_curve(curve: np.ndarray | list[float]) -> np.ndarray:
    arr = np.asarray(curve, dtype=np.float32)
    if arr.size == 0:
        return arr
    arr = np.nan_to_num(np.maximum(arr, 0))
    peak = float(np.percentile(arr, 97) + 1e-9)
    return np.clip(arr / peak, 0, 1).astype(np.float32)


def clamp_curve(curve: np.ndarray) -> np.ndarray:
    return np.clip(np.nan_to_num(curve), 0, 1).astype(np.float32)


def compress_series(values: list[float], digits: int = 4) -> list[float]:
    return [round(float(value), digits) for value in values]


def estimate_tempo_confidence(onset_env: np.ndarray) -> float:
    onset = normalize_curve(onset_env)
    if onset.size < 4:
        return 0.0
    return round(clamp01(float(np.std(onset) * 1.6 + np.mean(onset > 0.52) * 0.45)), 3)


def db(value: float) -> float:
    return 20.0 * math.log10(max(float(value), 1e-12))


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def clamp_value(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, float(value)))


def write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), samples, sample_rate)
