const fs = require("node:fs");
const { test, expect } = require("@playwright/test");

test("loads the studio shell without console errors", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Spatial Audio Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spatial" })).toHaveClass(/is-active/);
  await expect(page.locator("#perf-toggle")).toBeVisible();
  await expect(page.getByText("Demucs model")).toHaveCount(0);
  await expect(page.getByText("Room IR")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Front Stage" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Concert Hall" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Field" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Intimate" })).toHaveCount(0);
  await expect(page.locator("#concert-hall-toggle")).toHaveCount(0);
  await expect(page.locator("#waveform-canvas")).toBeVisible();
  await expect(page.locator("#spectrum-scene")).toBeVisible();
  await expect(page.locator("#spectrum-canvas")).toBeVisible();

  expect(errors()).toEqual([]);
});

test("toggles theme, rendering mode, and performance panel", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto("/");

  await page.locator("#perf-toggle").click();
  await expect(page.locator("#perf-panel")).toBeVisible();
  await expect(page.locator("#perf-fps")).toBeVisible();
  await page.locator("#perf-close").click();
  await expect(page.locator("#perf-panel")).toBeHidden();

  await expect(page.locator("#width-slider")).toHaveCount(0);
  await expect(page.locator("#depth-slider")).toHaveCount(0);
  await expect(page.locator("#room-slider")).toHaveCount(0);
  await expect(page.locator("#gain-slider")).toHaveCount(0);
  await expect(page.locator("#remaster-toggle")).toHaveCount(0);
  await expect(page.locator("#remaster-value")).toHaveCount(0);
  await expect(page.locator("#spatial-wet-slider")).toHaveCount(0);
  await expect(page.locator("#spatial-radius-slider")).toHaveCount(0);
  await expect(page.locator("#spatial-reflection-slider")).toHaveCount(0);
  await expect(page.locator("#spatial-wet-value")).toBeVisible();
  await expect(page.locator("#spatial-radius-value")).toBeVisible();
  await expect(page.locator("#spatial-reflection-value")).toBeVisible();

  await page.getByRole("button", { name: "Original" }).click();
  await page.getByRole("button", { name: "Spatial" }).click();

  const beforeTheme = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", beforeTheme || "");

  expect(errors()).toEqual([]);
});

test("renders mocked analysis after file selection without moving the top cards", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await page.route("**/api/analyze?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createAnalysisFixture())
    });
  });

  await page.goto("/");
  const uploadBefore = await page.locator("#drop-zone").boundingBox();
  const transportBefore = await page.locator(".transport-panel").boundingBox();

  const filePath = testInfo.outputPath("tone.wav");
  fs.writeFileSync(filePath, createToneWav());
  await page.locator("#audio-file").setInputFiles(filePath);

  await expect(page.locator("#track-name")).toHaveText("tone.wav");
  await expect(page.locator("#active-count")).toHaveText("3 active");
  await expect(page.locator("#model-stack .model-item")).toHaveCount(6);
  await expect(page.locator("#instrument-list .instrument-row")).toHaveCount(4);
  await expect(page.locator("#spectrum-canvas")).toBeVisible();

  const uploadAfter = await page.locator("#drop-zone").boundingBox();
  const transportAfter = await page.locator(".transport-panel").boundingBox();
  expect(Math.abs(uploadAfter.y - uploadBefore.y)).toBeLessThan(2);
  expect(Math.abs(transportAfter.y - transportBefore.y)).toBeLessThan(2);

  expect(errors()).toEqual([]);
});

test("keeps analysis visible when browser audio decoding fails", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await page.route("**/api/analyze?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createAnalysisFixture())
    });
  });

  await page.goto("/");
  const filePath = testInfo.outputPath("unsupported.aiff");
  fs.writeFileSync(filePath, Buffer.from("not a browser-decodable audio file"));
  await page.locator("#audio-file").setInputFiles(filePath);

  await expect(page.locator("#status-text")).toHaveText("분석 완료 · 브라우저 디코딩 불가");
  await expect(page.locator("#track-name")).toHaveText("tone.wav");
  await expect(page.locator("#active-count")).toHaveText("3 active");
  await expect(page.locator("#play-button")).toBeDisabled();
  await expect(page.locator("#stop-button")).toBeDisabled();
  await expect(page.locator("#seek-slider")).toBeDisabled();

  expect(errors()).toEqual([]);
});

test("renders Demucs stems with inferred stage positions", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await page.route("**/api/analyze?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createAnalysisFixture({ demucsCompleted: true, stereoRight: true }))
    });
  });
  await page.route("**/outputs/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: createToneWav()
    });
  });

  await page.goto("/");
  const filePath = testInfo.outputPath("stem-tone.wav");
  fs.writeFileSync(filePath, createToneWav());
  await page.locator("#audio-file").setInputFiles(filePath);

  await expect(page.locator("#active-count")).toHaveText("4 stems");
  await expect(page.locator("#instrument-list .instrument-row")).toHaveCount(4);
  await expect(page.locator(".stage-node[data-id='vocals']")).toBeVisible();
  await expect(page.locator(".stage-node[data-id='other']")).toBeVisible();
  await expect(page.locator("#spectrum-scene")).toBeVisible();

  const leadStyle = await page.locator(".stage-node[data-id='vocals']").getAttribute("style");
  const leadLeft = Number((leadStyle || "").match(/left:\s*([\d.]+)%/)?.[1]);
  expect(Number.isFinite(leadLeft)).toBe(true);
  expect(leadLeft).toBeGreaterThan(48);
  expect(leadLeft).toBeLessThan(52);
  const leadTop = Number((leadStyle || "").match(/top:\s*([\d.]+)%/)?.[1]);
  expect(Number.isFinite(leadTop)).toBe(true);
  expect(leadTop).toBeGreaterThan(28);
  expect(leadTop).toBeLessThan(32);
  const musicStyle = await page.locator(".stage-node[data-id='other']").getAttribute("style");
  const musicLeft = Number((musicStyle || "").match(/left:\s*([\d.]+)%/)?.[1]);
  expect(Number.isFinite(musicLeft)).toBe(true);
  expect(musicLeft).toBeGreaterThan(27);
  expect(musicLeft).toBeLessThan(31);
  const hitStyle = await page.locator(".stage-node[data-id='drums']").getAttribute("style");
  const hitLeft = Number((hitStyle || "").match(/left:\s*([\d.]+)%/)?.[1]);
  expect(Number.isFinite(hitLeft)).toBe(true);
  expect(hitLeft).toBeGreaterThan(69);
  expect(hitLeft).toBeLessThan(73);
  const lowStyle = await page.locator(".stage-node[data-id='bass']").getAttribute("style");
  const lowTop = Number((lowStyle || "").match(/top:\s*([\d.]+)%/)?.[1]);
  expect(Number.isFinite(lowTop)).toBe(true);
  expect(lowTop).toBeGreaterThan(73);
  expect(lowTop).toBeLessThan(77);

  await page.locator("#play-button").click();
  await page.waitForTimeout(250);
  await expect(page.locator(".stage-node[data-id='other']")).toHaveAttribute("style", musicStyle || "");
  const spectrumPixels = await page.locator("#spectrum-canvas").evaluate((canvas) => {
    const context = canvas.getContext("2d");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let alpha = 0;
    for (let index = 3; index < image.data.length; index += 64) {
      alpha += image.data[index];
    }
    return alpha;
  });
  expect(spectrumPixels).toBeGreaterThan(0);

  expect(errors()).toEqual([]);
});

test("keeps Original playback raw while stem displays stay idle", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await page.route("**/api/analyze?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createAnalysisFixture({ demucsCompleted: true }))
    });
  });
  await page.route("**/outputs/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: createToneWav()
    });
  });

  await page.goto("/");
  const filePath = testInfo.outputPath("original-stem-tone.wav");
  fs.writeFileSync(filePath, createToneWav());
  await page.locator("#audio-file").setInputFiles(filePath);

  await page.getByRole("button", { name: "Original" }).click();
  await expect(page.locator("#spatial-engine-mode")).toHaveText("Dry bypass");
  await expect(page.locator("#spatial-engine-status")).toHaveText("Original only");

  await page.locator("#play-button").click();
  await page.waitForTimeout(500);
  let levels = await page.evaluate(() => ({
    row: Number.parseFloat(document.querySelector(".instrument-row[data-id='other']")?.style.getPropertyValue("--level") || "0"),
    field: Number.parseFloat(document.querySelector(".stage-node[data-id='other']")?.style.getPropertyValue("--level") || "0")
  }));
  expect(levels.row).toBeLessThanOrEqual(0.01);
  expect(levels.field).toBeLessThanOrEqual(0.01);

  await page.getByRole("button", { name: "Spatial" }).click();
  await page.waitForFunction(() => {
    const row = document.querySelector(".instrument-row[data-id='other']");
    const node = document.querySelector(".stage-node[data-id='other']");
    const rowLevel = Number.parseFloat(row?.style.getPropertyValue("--level") || "0");
    const nodeLevel = Number.parseFloat(node?.style.getPropertyValue("--level") || "0");
    return rowLevel > 0.02 && nodeLevel > 0.02;
  }, null, { timeout: 2500 });

  levels = await page.evaluate(() => ({
    row: Number.parseFloat(document.querySelector(".instrument-row[data-id='other']")?.style.getPropertyValue("--level") || "0"),
    field: Number.parseFloat(document.querySelector(".stage-node[data-id='other']")?.style.getPropertyValue("--level") || "0")
  }));
  expect(levels.row).toBeGreaterThan(0.02);
  expect(levels.field).toBeGreaterThan(0.02);

  await page.getByRole("button", { name: "Original" }).click();
  await expect(page.locator("#spatial-engine-status")).toHaveText("Original only");
  await page.waitForFunction(() => {
    const row = document.querySelector(".instrument-row[data-id='other']");
    const node = document.querySelector(".stage-node[data-id='other']");
    const rowLevel = Number.parseFloat(row?.style.getPropertyValue("--level") || "0");
    const nodeLevel = Number.parseFloat(node?.style.getPropertyValue("--level") || "0");
    return rowLevel <= 0.01 && nodeLevel <= 0.01;
  }, null, { timeout: 2500 });

  expect(errors()).toEqual([]);
});

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => errors;
}

function createToneWav(sampleRate = 44100, durationSeconds = 1.25) {
  const frameCount = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const dataSize = frameCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < frameCount; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.min(1, index / 800) * Math.min(1, (frameCount - index) / 800);
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.35 * envelope;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * bytesPerSample);
  }
  return buffer;
}

function createAnalysisFixture(options = {}) {
  const curve = Array.from({ length: 72 }, (_, index) => 0.18 + Math.sin(index / 8) * 0.08);
  const waveform = Array.from({ length: 120 }, (_, index) => Math.abs(Math.sin(index / 9)) * 0.85 + 0.05);
  const stereoImage = createStereoImageFixture(options.stereoRight);
  const instrumentBase = {
    active: true,
    confidence: 0.76,
    peak: 0.88,
    mean: 0.32,
    curve,
    displayCurve: curve,
    q: 0.8
  };
  return {
    jobId: "test-job",
    cacheKey: "test-cache",
    file: {
      name: "tone.wav",
      sampleRate: 44100,
      channels: options.stereoRight ? 2 : 1,
      duration: 1.25
    },
    models: {
      primary: "Playwright fixture",
      features: "fixture",
      deepSeparator: {
        name: "Demucs / Hybrid Transformer Demucs fine-tuned",
        model: "htdemucs_ft",
        qualityProfile: "spatial-q2",
        postprocess: "softmask-v1",
        settings: {
          profile: "spatial-q2",
          postprocess: "softmask-v1",
          device: "cuda",
          shifts: 2,
          overlap: 0.36,
          segment: 7,
          jobs: 1
        },
        available: true,
        requested: true,
        status: options.demucsCompleted ? "completed" : "ready",
        cached: Boolean(options.demucsCompleted),
        stems: options.demucsCompleted
          ? [
              "_cache/demucs/test/vocals.wav",
              "_cache/demucs/test/other.wav",
              "_cache/demucs/test/drums.wav",
              "_cache/demucs/test/bass.wav"
            ]
          : [],
        stemQuality: options.demucsCompleted
          ? {
              vocals: { separation: 0.78, spatialWeight: 0.98 },
              other: { separation: 0.74, spatialWeight: 0.96 },
              drums: { separation: 0.82, spatialWeight: 1.02 },
              bass: { separation: 0.8, spatialWeight: 1 }
            }
          : {}
      },
      notes: []
    },
    timeline: {
      times: [0, 0.5, 1.0, 1.25],
      rms: [0.1, 0.7, 0.5, 0.1],
      onset: [0.05, 0.8, 0.4, 0.05],
      centroid: [0.4, 0.58, 0.5, 0.38]
    },
    waveform,
    tempo: { bpm: 92, confidence: 0.76 },
    key: { label: "C major", confidence: 0.64 },
    mix: {
      rmsDb: -18.6,
      approxLufs: -19.4,
      peakDb: -3.2,
      crestDb: 15.4,
      centroidHz: 1280,
      rolloffHz: 5200,
      flatness: 0.18,
      zcr: 0.08
    },
    stereoImage,
    instruments: [
      {
        ...instrumentBase,
        id: "violins1",
        label: "1st Violins",
        family: "strings",
        position: { x: -2.6, y: 0.1, z: -1.6 },
        freq: 2300,
        color: "#78a95d",
        stereo: stereoImage.instruments.violins1 || createMonoStereoFixture()
      },
      {
        ...instrumentBase,
        id: "piano",
        label: "Piano",
        family: "keyboard",
        position: { x: -1.2, y: 0.1, z: -2.8 },
        freq: 1250,
        color: "#d6c4a0",
        stereo: stereoImage.instruments.piano || createMonoStereoFixture()
      },
      {
        ...instrumentBase,
        id: "flute",
        label: "Flute",
        family: "woodwinds",
        position: { x: 0.8, y: 0.2, z: -3.1 },
        freq: 3600,
        color: "#a9c9a2",
        stereo: stereoImage.instruments.flute || createMonoStereoFixture()
      },
      {
        ...instrumentBase,
        id: "basses",
        label: "Double Basses",
        family: "strings",
        active: false,
        position: { x: 2.5, y: 0, z: -1.4 },
        freq: 115,
        color: "#a07058",
        stereo: stereoImage.instruments.basses || createMonoStereoFixture()
      }
    ],
    activeIds: ["violins1", "piano", "flute"],
    sections: [
      { start: 0, end: 0.62, energy: 0.58, brightness: 0.46, density: 0.34 },
      { start: 0.62, end: 1.25, energy: 0.72, brightness: 0.55, density: 0.48 }
    ],
    recommendations: [
      "Playwright fixture recommendation"
    ]
  };
}

function createStereoImageFixture(stereoRight = false) {
  if (!stereoRight) {
    return {
      status: "mono",
      pan: 0,
      width: 0,
      correlation: 1,
      confidence: 0,
      instruments: {}
    };
  }
  const ids = ["violins1", "piano", "flute", "basses"];
  const instruments = Object.fromEntries(ids.map((id) => [id, {
    pan: 0.9,
    width: 0.42,
    confidence: 0.95,
    energy: 0.82,
    panCurve: Array.from({ length: 72 }, () => 0.9)
  }]));
  return {
    status: "stereo",
    pan: 0.72,
    width: 0.42,
    correlation: 0.54,
    confidence: 0.9,
    instruments
  };
}

function createMonoStereoFixture() {
  return {
    pan: 0,
    width: 0,
    confidence: 0,
    energy: 0,
    panCurve: []
  };
}
