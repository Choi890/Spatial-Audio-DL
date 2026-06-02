from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

from backend.audio_engine import analyze_audio, enhance_demucs_stems, read_stem_quality


class AudioEngineRegressionTests(unittest.TestCase):
    def test_stereo_pan_and_demucs_model_are_stable(self) -> None:
        sample_rate = 22050
        duration = 1.25
        time = np.linspace(0.0, duration, int(sample_rate * duration), endpoint=False)
        tone = np.sin(2 * np.pi * 440 * time).astype(np.float32)
        stereo = np.stack([tone * 0.24, tone * 0.86], axis=1)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            audio_path = root / "right_weighted.wav"
            output_dir = root / "outputs"
            output_dir.mkdir()
            sf.write(audio_path, stereo, sample_rate)

            result = analyze_audio(
                audio_path,
                job_id="rightpan",
                output_dir=output_dir,
                request_demucs=False,
                demucs_model="htdemucs_6s",
                cache_key="fixture",
            )

        separator = result["models"]["deepSeparator"]
        image = result["stereoImage"]
        self.assertEqual(separator["model"], "htdemucs_ft")
        self.assertEqual(separator["qualityProfile"], "spatial-q2")
        self.assertEqual(separator["postprocess"], "softmask-v1")
        self.assertIn("shifts", separator["settings"])
        self.assertGreater(image["pan"], 0.2)
        self.assertGreater(image["width"], 0.05)
        self.assertGreaterEqual(image["correlation"], 0.95)
        self.assertGreater(result["mix"]["spectralBalance"]["lowMid"], 0.4)

    def test_demucs_stem_enhancement_writes_quality_metadata(self) -> None:
        sample_rate = 22050
        duration = 0.4
        time = np.linspace(0.0, duration, int(sample_rate * duration), endpoint=False)
        stems = {
            "vocals": np.sin(2 * np.pi * 440 * time) * 0.28,
            "other": np.sin(2 * np.pi * 880 * time) * 0.22,
            "drums": (np.sin(2 * np.pi * 120 * time) * (np.sin(2 * np.pi * 8 * time) > 0.92)) * 0.7,
            "bass": np.sin(2 * np.pi * 80 * time) * 0.34,
        }

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            paths = []
            for stem_id, mono in stems.items():
                data = np.stack([mono, mono * 0.98], axis=1).astype(np.float32)
                path = root / f"{stem_id}.wav"
                sf.write(path, data, sample_rate, subtype="FLOAT")
                paths.append(path)

            quality = enhance_demucs_stems(paths, root)
            cached = read_stem_quality(root)

            self.assertEqual(set(quality), {"vocals", "other", "drums", "bass"})
            self.assertEqual(set(cached), set(quality))
            for stem_id, metrics in quality.items():
                self.assertGreater(metrics["separation"], 0.0, stem_id)
                self.assertGreater(metrics["spatialWeight"], 0.6, stem_id)
                data, _ = sf.read(root / f"{stem_id}.wav", always_2d=True, dtype="float32")
                self.assertTrue(np.all(np.isfinite(data)))


if __name__ == "__main__":
    unittest.main()
