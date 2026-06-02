const {
  $,
  apiPath,
  clamp,
  cssColor,
  dbToGain,
  escapeHtml,
  formatBytes,
  formatNumber,
  formatTime,
  mapRange,
  setStyleProperty,
  setText,
  toggleClass
} = window.SpatialAudioUtils;

const {
  LIVE_SIGNATURES,
  METER_FRAME_INTERVAL,
  SHORT_NAMES,
  STEM_ORDER,
  STEM_PROFILES
} = window.SpatialAudioConfig;

const SPECTRUM_BAR_COUNT = 24;
const LIVE_ANALYSER_FFT_SIZE = 2048;
const STEM_METER_FFT_SIZE = 512;
const VISUAL_FRAME_INTERVAL = 1 / 60;
const HIDDEN_VISUAL_FRAME_INTERVAL = 1 / 60;
const METER_STYLE_EPSILON = 0.012;
const STEM_BAR_NORMAL_CEILING = 0.88;
const STEM_BAR_RESPONSE_CURVE = 3.0;
const STEM_BAR_PEAK_GATE = 0.9997;
const STEM_BAR_PEAK_EXPONENT = 6;
const DEMUCS_MODEL = "htdemucs_ft";
const SPATIAL_SPACE_MULTIPLIER = 5.5;  //값이 커질수록 “머리 밖으로 펼쳐지는 느낌”이 강해지지만, 너무 크면 인위적인 공간감, 위상감, 지연감이 생길 수 있다.
const SPATIAL_WIDTH_MULTIPLIER = 7;  //좌우 폭을 키우는 핵심 값
const SPATIAL_ENVELOPMENT_SCALE = 5.1;  //소리가 몸 주변을 감싸는 느낌
const SPATIAL_DISTANCE_ENVELOPMENT = 10;  //값이 커질수록 소리가 귀 바로 옆이 아니라 더 먼 공간에서 펼쳐지는 느낌
const SPATIAL_SIDE_ENERGY_SCALE = 4.5;  //측면 에너지를 조절하는 값 
const SPATIAL_FIRST_WET_SCALE = 1; //첫 번째 반사음의 wet 값을 조절하는 값. 1보다 크면 첫 번째 반사음이 더 강해져서 공간감이 증가하지만, 너무 크면 부자연스러움
const SPATIAL_NATURAL_DELAY_SCALE = 1;  
const SPATIAL_NATURAL_MOTION_SCALE = 0.16;   
const SPATIAL_NATURAL_PAN_SCALE = 1.3;
const SPATIAL_NATURAL_CUE_SCALE = 1;
const SPATIAL_FRONT_HEMISPHERE_AZIMUTH_LIMIT = 96;
const SPATIAL_MAX_RENDER_AZIMUTH = 158;
const SPATIAL_ENGINE_DEFAULTS = {
  wet: 0.72,
  radius: 3,
  reflections: 0.56
};
const SPATIAL_CENTER_STAGE_DIRECTIONS = [
  { id: "stageAnchor", azimuth: 0, elevation: 10, distance: 4.8, gain: 0.01, delay: 0.0065 },
  { id: "stageEarlyLeft", azimuth: -68, elevation: 14, distance: 6.45, gain: 0.054, delay: 0.0112 },
  { id: "stageEarlyRight", azimuth: 68, elevation: 14, distance: 6.45, gain: 0.054, delay: 0.0116 },
  { id: "stageWallLeft", azimuth: -106, elevation: 17, distance: 8.3, gain: 0.054, delay: 0.0168 },
  { id: "stageWallRight", azimuth: 106, elevation: 17, distance: 8.3, gain: 0.054, delay: 0.0172 },
  { id: "stageOuterLeft", azimuth: -132, elevation: 18, distance: 9.0, gain: 0.016, delay: 0.0215 },
  { id: "stageOuterRight", azimuth: 132, elevation: 18, distance: 9.0, gain: 0.016, delay: 0.0219 },
  { id: "stageCeiling", azimuth: 10, elevation: 62, distance: 7.9, gain: 0.018, delay: 0.022 }
];
const SPATIAL_FIELD_DIRECTIONS = [
  { id: "front", azimuth: 0, elevation: 15, distance: 4.9, gain: 0.12, delay: 0.007 },
  { id: "frontLeft", azimuth: -76, elevation: 20, distance: 6.8, gain: 0.18, delay: 0.0096 },
  { id: "frontRight", azimuth: 76, elevation: 20, distance: 6.8, gain: 0.18, delay: 0.0099 },
  { id: "left", azimuth: -118, elevation: 12, distance: 8.0, gain: 0.205, delay: 0.0132 },
  { id: "right", azimuth: 118, elevation: 12, distance: 8.0, gain: 0.205, delay: 0.0135 },
  { id: "rearLeft", azimuth: -138, elevation: 18, distance: 7.2, gain: 0.008, delay: 0.019 },
  { id: "rearRight", azimuth: 138, elevation: 18, distance: 7.2, gain: 0.008, delay: 0.0193 },
  { id: "rear", azimuth: 180, elevation: 8, distance: 7.2, gain: 0.004, delay: 0.022 },
  { id: "heightFront", azimuth: -22, elevation: 68, distance: 6.6, gain: 0.09, delay: 0.016 },
  { id: "heightRear", azimuth: 168, elevation: 64, distance: 7.1, gain: 0.004, delay: 0.0225 }
];
const SPATIAL_FIELD_HRTF_TAPS = new Set(["frontLeft", "frontRight", "left", "right", "rearLeft", "rearRight", "rear", "heightFront", "heightRear"]);
const RUNTIME_QUALITY_PROFILE = {
  label: "Full",
  meterInterval: VISUAL_FRAME_INTERVAL,
  stemDisplayInterval: VISUAL_FRAME_INTERVAL,
  fieldDisplayInterval: VISUAL_FRAME_INTERVAL,
  spectrumInterval: VISUAL_FRAME_INTERVAL,
  seekInterval: VISUAL_FRAME_INTERVAL,
  waveformInterval: VISUAL_FRAME_INTERVAL
};

const STEM_POSITION_GROUPS = {
  vocals: [
    ["piano", 0.92],
    ["violins1", 0.82],
    ["violins2", 0.58],
    ["flute", 0.58],
    ["oboe", 0.5],
    ["trumpet", 0.38],
    ["harp", 0.34]
  ],
  other: [
    ["violins1", 0.78],
    ["violins2", 0.76],
    ["violas", 0.72],
    ["cellos", 0.66],
    ["flute", 0.54],
    ["oboe", 0.56],
    ["clarinet", 0.56],
    ["bassoon", 0.44],
    ["horn", 0.46],
    ["trumpet", 0.38],
    ["trombone", 0.36],
    ["harp", 0.42],
    ["piano", 0.52]
  ],
  drums: [
    ["percussion", 1],
    ["timpani", 0.86],
    ["harp", 0.3],
    ["piano", 0.24]
  ],
  bass: [
    ["basses", 1],
    ["cellos", 0.74],
    ["bassoon", 0.42],
    ["timpani", 0.34],
    ["trombone", 0.24]
  ]
};

const STEM_POSITION_BOUNDS = {
  x: [-3.85, 3.85],
  y: [-0.2, 0.68],
  z: [-5.35, -1.15]
};

const STEM_POSITION_ANCHORS = {
  vocals: {
    x: 0,
    y: 0.24,
    z: -2.35,
    lateralMix: 0.08,
    verticalMix: 0.34,
    depthMix: 0.46,
    maxAbsX: 0.16
  }
};

const STEM_STAGE_LAYOUT = {
  vocals: { left: 50, top: 30 },
  other: { left: 29, top: 53 },
  drums: { left: 71, top: 53 },
  bass: { left: 50, top: 75 }
};

const refs = {
  fileInput: $("#audio-file"),
  dropZone: $("#drop-zone"),
  resetButton: $("#reset-button"),
  themeToggle: $("#theme-toggle"),
  themeToggleText: $("#theme-toggle-text"),
  perfToggle: $("#perf-toggle"),
  perfPanel: $("#perf-panel"),
  perfClose: $("#perf-close"),
  statusText: $("#status-text"),
  toast: $("#toast"),
  trackKicker: $("#track-kicker"),
  trackName: $("#track-name"),
  trackSubtitle: $("#track-subtitle"),
  playButton: $("#play-button"),
  stopButton: $("#stop-button"),
  seekSlider: $("#seek-slider"),
  currentTime: $("#current-time"),
  totalTime: $("#total-time"),
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  spatialEngineMode: $("#spatial-engine-mode"),
  spatialEngineStatus: $("#spatial-engine-status"),
  spatialWetValue: $("#spatial-wet-value"),
  spatialRadiusValue: $("#spatial-radius-value"),
  spatialReflectionValue: $("#spatial-reflection-value"),
  sliders: {},
  sliderValues: {},
  metrics: {
    duration: $("#duration-value"),
    sampleRate: $("#sample-rate-value"),
    tempo: $("#tempo-value"),
    tempoNote: $("#tempo-note"),
    key: $("#key-value"),
    keyNote: $("#key-note"),
    loudness: $("#loudness-value"),
    loudnessNote: $("#loudness-note"),
    peak: $("#peak-value"),
    crest: $("#crest-value"),
    centroid: $("#centroid-value"),
    rolloff: $("#rolloff-value")
  },
  activeCount: $("#active-count"),
  frameTime: $("#frame-time"),
  stageMap: $("#stage-map"),
  spectrumCanvas: $("#spectrum-canvas"),
  spectrumStatus: $("#spectrum-status"),
  instrumentList: $("#instrument-list"),
  waveformCanvas: $("#waveform-canvas"),
  waveformTag: $("#waveform-tag"),
  modelTag: $("#model-tag"),
  modelStack: $("#model-stack"),
  sectionList: $("#section-list")
};

refs.perf = {
  fps: $("#perf-fps"),
  frame: $("#perf-frame"),
  meter: $("#perf-meter"),
  waveform: $("#perf-waveform"),
  nodes: $("#perf-nodes"),
  heap: $("#perf-heap")
};

const state = {
  file: null,
  analysis: null,
  audioContext: null,
  audioBuffer: null,
  stemBuffers: null,
  graph: null,
  displayObjects: null,
  mode: "spatial",
  playing: false,
  startedAt: 0,
  offset: 0,
  animationId: 0,
  retiredGraphs: [],
  meterLevels: {},
  metersZeroed: false,
  fieldLevels: {},
  fieldNodeGroups: {},
  fieldDriftSeeds: {},
  spectrumLevels: Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0),
  spectrumPeaks: Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0),
  spectrumContext: null,
  spectrumRanges: null,
  spectrumRangeKey: "",
  spectrumCache: {
    width: 0,
    height: 0,
    dpr: 1,
    backgroundKey: "",
    backgroundCanvas: null,
    gradientKey: "",
    gradient: null
  },
  stemPositionCache: {},
  stemDisplayPositions: {},
  meterRows: {},
  waveformContext: null,
  waveformCache: {
    width: 0,
    height: 0,
    dpr: 1,
    backgroundKey: "",
    backgroundCanvas: null,
    barsKey: "",
    bars: [],
    gradientKey: "",
    gradient: null
  },
  resizeFrame: 0,
  perf: {
    enabled: false,
    fps: 0,
    droppedFrames: 0,
    lastFrameAt: 0,
    lastPanelAt: 0,
    frameMs: [],
    meterMs: [],
    spectrumMs: [],
    waveformMs: []
  },
  lastWaveformDrawTime: -1,
  lastMeterFrameTime: -1,
  lastStemDisplayFrameTime: -1,
  lastFieldDisplayFrameTime: -1,
  lastSpectrumFrameTime: -1,
  lastSeekFrameTime: -1,
  lastVisualFrameAt: 0,
  lastLiveAnalysisFrame: null,
  liveOutputLevel: 0,
  liveScores: {},
  hrtfImpulseCache: new Map(),
  spatialSettings: { ...SPATIAL_ENGINE_DEFAULTS },
  spatialAnalysisSummary: {
    openness: 0,
    dynamics: 0,
    density: 0
  }
};

init();

function init() {
  applyStoredTheme();
  syncFieldModeState();

  refs.fileInput.addEventListener("change", () => {
    const file = refs.fileInput.files && refs.fileInput.files[0];
    if (file) analyzeFile(file);
  });
  refs.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.dropZone.classList.add("is-dragging");
  });
  refs.dropZone.addEventListener("dragleave", () => refs.dropZone.classList.remove("is-dragging"));
  refs.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) analyzeFile(file);
  });

  refs.resetButton.addEventListener("click", resetApp);
  refs.themeToggle.addEventListener("click", toggleTheme);
  refs.perfToggle.addEventListener("click", () => setPerfPanelEnabled(!state.perf.enabled));
  refs.perfClose.addEventListener("click", () => setPerfPanelEnabled(false));
  refs.playButton.addEventListener("click", togglePlayback);
  refs.stopButton.addEventListener("click", stopPlayback);
  refs.seekSlider.addEventListener("input", seekToSlider);

  refs.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.mode;
      if (!nextMode || nextMode === state.mode) return;
      state.mode = nextMode;
      const time = getPlaybackTime();
      refs.modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      syncFieldModeState();
      if (state.mode === "original") {
        setRealtimeMetersToZero(time);
      }
      if (!state.playing) {
        if (state.mode === "original") {
          setRealtimeMetersToZero(state.offset);
        } else {
          updateRealtimeDisplay(state.offset);
          updateSoundFieldDisplay(state.offset, readSoundFieldScores(state.offset));
        }
        updateSpectrumDisplay(state.offset, { zero: true });
      }
      if (state.playing) {
        crossfadePlaybackMode(time).catch((error) => {
          console.error(error);
          stopPlayback({ keepOffset: true, silent: true });
          state.offset = time;
          startPlayback();
        });
      }
    });
  });

  drawEmptyWaveform();
  drawSpectrumGraph(state.spectrumLevels, { zero: true, force: true });
  updateSpatialControlUi();
}

function syncFieldModeState() {
  refs.stageMap.dataset.mode = state.mode;
  document.body.dataset.playbackMode = state.mode;
  updateSpatialControlUi();
}

function updateSpatialControlUi() {
  const settings = state.spatialSettings;
  setText(refs.spatialWetValue, `${Math.round(settings.wet * 100)}%`);
  setText(refs.spatialRadiusValue, `${Math.round(settings.radius * 100)}%`);
  setText(refs.spatialReflectionValue, `${Math.round(settings.reflections * 100)}%`);
  if (refs.spatialEngineMode) {
    setText(refs.spatialEngineMode, state.mode === "spatial" ? getSpatialRendererModeLabel() : "Dry bypass");
  }
  if (refs.spatialEngineStatus) {
    setText(refs.spatialEngineStatus, state.mode === "spatial"
      ? getSpatialRendererStatusText()
      : "Original only");
  }
}

function getSpatialRendererModeLabel() {
  return "Original overlay renderer";
}

function getSpatialRendererStatusText() {
  return "Spatial-first field";
}

function updateSpatialSettingsFromAnalysis(analysis) {
  const mix = analysis?.mix || {};
  const stereo = analysis?.stereoImage || {};
  const sections = Array.isArray(analysis?.sections) ? analysis.sections : [];
  const activeCount = Array.isArray(analysis?.activeIds) ? analysis.activeIds.length : 0;
  const sectionEnergy = sections.length
    ? sections.reduce((sum, section) => sum + (Number(section.energy) || 0), 0) / sections.length
    : clamp(((Number(mix.rmsDb) || -24) + 42) / 30, 0, 1);
  const density = sections.length
    ? sections.reduce((sum, section) => sum + (Number(section.density) || 0), 0) / sections.length
    : clamp(activeCount / 10, 0, 1);
  const brightness = clamp(((Number(mix.centroidHz) || 1200) - 420) / 5200, 0, 1);
  const dynamics = clamp(((Number(mix.crestDb) || 12) - 7) / 15, 0, 1);
  const stereoWidth = clamp(Number(stereo.width) || 0, 0, 1);
  const openness = clamp(brightness * 0.38 + stereoWidth * 0.34 + dynamics * 0.16 + sectionEnergy * 0.12, 0, 1);
  const lowWeight = clamp(1 - brightness * 0.64 + Math.max(0, 5 - activeCount) * 0.035, 0, 1);

  state.spatialAnalysisSummary = { openness, dynamics, density };
  state.spatialSettings = {
    wet: clamp(0.5 + openness * 0.24 + dynamics * 0.07 - lowWeight * 0.003, 0.48, 0.78),
    radius: clamp(1 + openness * 0.08 + stereoWidth * 0.05 + density * 0.025, 0.98, 1.08),
    reflections: clamp(0.2 + density * 0.14 + sectionEnergy * 0.07 + brightness * 0.04, 0.18, 0.56)
  };
  updateSpatialControlUi();
}

function resetLiveAnalysisCache() {
  state.lastLiveAnalysisFrame = null;
  state.liveOutputLevel = 0;
}

function getRuntimeQualityProfile() {
  return RUNTIME_QUALITY_PROFILE;
}

function resetRuntimeQualityState() {
  state.perf.lastFrameAt = 0;
}

async function analyzeFile(file) {
  stopPlayback();
  state.file = file;
  state.analysis = null;
  state.audioBuffer = null;
  state.stemBuffers = null;
  state.displayObjects = null;
  state.liveScores = {};
  state.meterLevels = {};
  state.metersZeroed = false;
  state.fieldLevels = {};
  state.fieldNodeGroups = {};
  state.fieldDriftSeeds = {};
  resetSpectrumState();
  state.stemPositionCache = {};
  state.stemDisplayPositions = {};
  state.meterRows = {};
  resetWaveformCache();
  state.lastWaveformDrawTime = -1;
  state.lastMeterFrameTime = -1;
  state.lastStemDisplayFrameTime = -1;
  state.lastFieldDisplayFrameTime = -1;
  state.lastSpectrumFrameTime = -1;
  state.lastSeekFrameTime = -1;
  state.lastVisualFrameAt = 0;
  resetLiveAnalysisCache();
  setBusy(true, "Demucs stem 분리 및 원본 분석 중");
  refs.trackKicker.textContent = "ANALYZING";
  refs.trackName.textContent = file.name;
  refs.trackSubtitle.textContent = `${formatBytes(file.size)} · 로컬 AI 분석 준비 중`;
  refs.playButton.disabled = true;
  refs.stopButton.disabled = true;
  refs.seekSlider.disabled = true;

  try {
    const context = await ensureAudioContext();
    resetRuntimeQualityState();
    const decodePromise = decodeBrowserAudioFile(file, context);
    const analyzePromise = postAudioForAnalysis(file);
    const [decodeResult, analysisResult] = await Promise.allSettled([
      decodePromise,
      analyzePromise
    ]);

    if (analysisResult.status === "rejected") {
      throw analysisResult.reason;
    }

    const analysis = analysisResult.value;
    const audioBuffer = decodeResult.status === "fulfilled" ? decodeResult.value : null;
    const browserDecodeError = decodeResult.status === "rejected" ? decodeResult.reason : null;

    state.audioBuffer = audioBuffer;
    state.analysis = analysis;
    updateSpatialSettingsFromAnalysis(analysis);
    const separator = analysis.models.deepSeparator;
    if (separator.status === "completed" && audioBuffer) {
      setBusy(true, separator.cached ? "캐시된 stem 디코딩 중" : "분리된 stem 디코딩 중");
      state.stemBuffers = await loadStemBuffers(context, analysis);
    }
    setBusy(true, "재설계용 원본 출력 경로 준비 중");
    state.offset = 0;
    renderAnalysis(analysis);
    refs.playButton.disabled = !audioBuffer;
    refs.stopButton.disabled = !audioBuffer;
    refs.seekSlider.disabled = !audioBuffer;
    document.body.classList.add("has-analysis");
    if (browserDecodeError) {
      setBusy(false, "분석 완료 · 브라우저 디코딩 불가");
      showToast(getBrowserDecodeMessage(file, browserDecodeError));
      return;
    }
    setBusy(false, state.stemBuffers
      ? (separator.cached ? "캐시 기반 분석 준비 완료" : "Demucs 분석 준비 완료")
      : "원본 분석 완료");
    showToast(state.stemBuffers
      ? (separator.cached ? "캐시된 stem 분석 준비가 완료됐습니다." : "Demucs stem 분석 준비가 완료됐습니다.")
      : "원본 기준선 분석이 완료됐습니다.");
  } catch (error) {
    console.error(error);
    setBusy(false, getAnalysisFailureStatus(error));
    showToast(error.message || "분석 중 오류가 발생했습니다.");
  }
}

async function decodeBrowserAudioFile(file, context) {
  try {
    const buffer = await file.arrayBuffer();
    return await context.decodeAudioData(buffer.slice(0));
  } catch (error) {
    const wrapped = new Error(error && error.message ? error.message : "Unable to decode audio data");
    wrapped.cause = error;
    throw wrapped;
  }
}

function getBrowserDecodeMessage(file, error) {
  const type = file.type || "알 수 없는 형식";
  const name = file.name || "audio";
  const detail = error && error.message ? ` (${error.message})` : "";
  return `백엔드 분석은 완료됐지만 브라우저가 ${name} 파일을 재생용으로 디코딩하지 못했습니다. 형식: ${type}${detail}`;
}

function getAnalysisFailureStatus(error) {
  const message = String(error && error.message ? error.message : "");
  if (/Failed to fetch|NetworkError|Network request failed|Load failed/i.test(message)) {
    return "서버 연결 실패";
  }
  if (/No audio body|too large|Analysis failed|분석 요청 실패/i.test(message)) {
    return "분석 실패";
  }
  return "분석 실패";
}

async function postAudioForAnalysis(file) {
  const params = new URLSearchParams({
    filename: file.name,
    demucs: "true",
    demucs_model: DEMUCS_MODEL
  });
  let response;
  try {
    response = await fetch(apiPath(`/api/analyze?${params.toString()}`), {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });
  } catch (error) {
    const wrapped = new Error("백엔드 서버에 연결할 수 없습니다. start.ps1을 실행한 뒤 http://127.0.0.1:8766/에서 다시 시도하세요.");
    wrapped.cause = error;
    throw wrapped;
  }
  if (!response.ok) {
    let message = `분석 요청 실패 (${response.status})`;
    try {
      const payload = await response.json();
      if (payload.detail) message = payload.detail;
    } catch (parseError) {
      // Keep the generic status message.
    }
    throw new Error(message);
  }
  return response.json();
}

async function loadStemBuffers(context, analysis) {
  const stems = getDemucsStemItems(analysis);
  if (!stems.length) return null;
  const loaded = {};
  const settled = await Promise.allSettled(stems.map(async (stem) => {
    const response = await fetch(apiPath(`/outputs/${stem.path}`));
    if (!response.ok) throw new Error(`${stem.label} stem 로드 실패 (${response.status})`);
    const data = await response.arrayBuffer();
    loaded[stem.id] = {
      ...stem,
      buffer: await context.decodeAudioData(data.slice(0))
    };
  }));
  const failed = settled.filter((item) => item.status === "rejected");
  if (failed.length && !Object.keys(loaded).length) {
    throw new Error("Demucs stem 파일을 브라우저에서 디코딩하지 못했습니다.");
  }
  return Object.keys(loaded).length ? loaded : null;
}

function getDemucsStemItems(analysis) {
  const separator = analysis && analysis.models && analysis.models.deepSeparator;
  if (!separator || separator.status !== "completed" || !Array.isArray(separator.stems)) return [];
  const stemQuality = separator.stemQuality || {};
  const seen = new Set();
  const stems = separator.stems.map((path) => {
    const filename = path.split("/").pop() || "";
    const id = filename.replace(/\.[^.]+$/, "").toLowerCase();
    const profile = STEM_PROFILES[id];
    if (!profile || seen.has(id)) return null;
    seen.add(id);
    const quality = stemQuality[id] || {};
    return {
      ...profile,
      path,
      kind: "stem",
      active: true,
      family: "stem",
      quality,
      separation: clamp(Number(quality.separation) || 0.72, 0, 1),
      spatialWeight: getStemQualitySpatialWeight(quality),
      displayCurve: [],
      curve: []
    };
  }).filter(Boolean);
  return stems.sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id));
}

function getStemQualitySpatialWeight(quality = {}) {
  const explicit = Number(quality.spatialWeight);
  if (Number.isFinite(explicit)) return clamp(explicit, 0.62, 1.08);
  const separation = Number(quality.separation);
  if (Number.isFinite(separation)) return clamp(0.72 + separation * 0.36, 0.62, 1.08);
  return 1;
}

async function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive"
    });
    configureSpatialListener(state.audioContext);
  }
  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
  return state.audioContext;
}

function configureSpatialListener(context) {
  const listener = context?.listener;
  if (!listener) return;
  setAudioParamValue(listener.positionX, 0, context.currentTime);
  setAudioParamValue(listener.positionY, 0, context.currentTime);
  setAudioParamValue(listener.positionZ, 0, context.currentTime);
  setAudioParamValue(listener.forwardX, 0, context.currentTime);
  setAudioParamValue(listener.forwardY, 0, context.currentTime);
  setAudioParamValue(listener.forwardZ, -1, context.currentTime);
  setAudioParamValue(listener.upX, 0, context.currentTime);
  setAudioParamValue(listener.upY, 1, context.currentTime);
  setAudioParamValue(listener.upZ, 0, context.currentTime);
  if (typeof listener.setPosition === "function") {
    listener.setPosition(0, 0, 0);
  }
  if (typeof listener.setOrientation === "function") {
    listener.setOrientation(0, 0, -1, 0, 1, 0);
  }
}

function setAudioParamValue(param, value, time = 0) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

function renderAnalysis(analysis) {
  const file = analysis.file;
  refs.trackKicker.textContent = "READY";
  refs.trackName.textContent = file.name;
  refs.trackSubtitle.textContent = `${formatTime(file.duration)} · ${file.channels}ch · ${formatBytes(state.file.size)} · 원본 기준선`;
  refs.totalTime.textContent = formatTime(file.duration);

  refs.metrics.duration.textContent = formatTime(file.duration);
  refs.metrics.sampleRate.textContent = `${formatNumber(file.sampleRate)} Hz`;
  refs.metrics.tempo.textContent = analysis.tempo.bpm ? analysis.tempo.bpm : "--";
  refs.metrics.tempoNote.textContent = `${Math.round(analysis.tempo.confidence * 100)}% confidence`;
  refs.metrics.key.textContent = analysis.key.label;
  refs.metrics.keyNote.textContent = `${Math.round(analysis.key.confidence * 100)}% confidence`;
  refs.metrics.loudness.textContent = `${analysis.mix.rmsDb.toFixed(1)} dBFS`;
  refs.metrics.loudnessNote.textContent = `${analysis.mix.approxLufs.toFixed(1)} LUFS approx`;
  refs.metrics.peak.textContent = `${analysis.mix.peakDb.toFixed(1)} dBFS`;
  refs.metrics.crest.textContent = `crest ${analysis.mix.crestDb.toFixed(1)} dB`;
  refs.metrics.centroid.textContent = `${Math.round(analysis.mix.centroidHz)} Hz`;
  refs.metrics.rolloff.textContent = `rolloff ${Math.round(analysis.mix.rolloffHz)} Hz`;

  refs.waveformTag.textContent = `${analysis.waveform.length} points`;
  setDisplayObjects(analysis);

  renderStage(analysis);
  renderInstrumentList(analysis);
  renderSpectrumGraph();
  renderModelStack(analysis);
  renderSections(analysis);
  drawWaveform(0);
  updateRealtimeDisplay(0);
  updateSpectrumDisplay(0, { zero: true });
}

function renderStage(analysis) {
  const objects = getDisplayObjects(analysis);
  syncFieldModeState();
  refs.activeCount.textContent = state.stemBuffers ? `${objects.length} stems` : `${analysis.activeIds.length} active`;
  refs.stageMap.innerHTML = `
    <div class="field-grid" aria-hidden="true"></div>
    <div class="field-depth depth-near" aria-hidden="true"></div>
    <div class="field-depth depth-far" aria-hidden="true"></div>
    <div class="field-node-layer">
      ${createStageNodes(objects).map((node) => `
        <span class="stage-node ${node.object.active ? "" : "is-inactive"}"
          data-id="${node.object.id}"
          data-label="${escapeHtml(node.object.label)}"
          data-family="${node.object.family}"
          data-index="${node.index}"
          data-total="${objects.length}"
          style="left:${node.left.toFixed(3)}%; top:${node.top.toFixed(3)}%; --node-color:${node.color}; --level:0">
          <strong>${escapeHtml(node.short)}</strong>
          <span>${escapeHtml(node.label)}</span>
        </span>
      `).join("")}
    </div>
  `;
  cacheFieldNodes();
}

function createStageNodes(objects) {
  if (!objects.length) return [];
  return objects.map((object, index) => {
    const point = getObjectStagePoint(object, index, objects.length, state.offset, { immediate: true });
    return {
      object,
      index,
      left: point.left,
      top: point.top,
      short: object.short || SHORT_NAMES[object.id] || object.label,
      label: object.label,
      color: object.color
    };
  });
}

function getObjectStagePoint(object, index = 0, total = 1, time = 0, options = {}) {
  if (object.kind === "stem" && STEM_STAGE_LAYOUT[object.id]) {
    return STEM_STAGE_LAYOUT[object.id];
  }
  const position = getObjectRenderPosition(object, time, options);
  if (position && Number.isFinite(position.x) && Number.isFinite(position.z)) {
    return {
      left: clamp(50 + position.x * 10.7, 14, 86),
      top: clamp(72 + position.z * 8.0 - (position.y || 0) * 8.5 + index * 0.38, 16, 84)
    };
  }
  const angle = total > 1 ? (index / Math.max(1, total - 1)) * Math.PI : Math.PI * 0.5;
  return {
    left: clamp(18 + Math.cos(Math.PI - angle) * 32 + index * 0.4, 14, 86),
    top: clamp(34 + Math.sin(angle) * 36, 16, 84)
  };
}

function getObjectRenderPosition(object, time = 0, options = {}) {
  if (!object) return null;
  if (object.kind === "stem") {
    if (options.dynamic || options.immediate) {
      return getStemRenderPosition(object, time, options);
    }
    return state.stemDisplayPositions[object.id] || object.position || getStemFallbackPosition(object.id);
  }
  return getInstrumentStagePosition(object, time);
}

function getStemRenderPosition(stem, time = 0, options = {}) {
  const inference = inferStemPosition(stem.id, time, options);
  const current = state.stemDisplayPositions[stem.id] || stem.position || inference.position;
  const ratio = options.immediate || !state.playing ? 1 : 0.22;
  const next = {
    x: current.x + (inference.position.x - current.x) * ratio,
    y: current.y + (inference.position.y - current.y) * ratio,
    z: current.z + (inference.position.z - current.z) * ratio
  };
  state.stemDisplayPositions[stem.id] = next;
  stem.position = next;
  stem.inferredPosition = inference.position;
  stem.positionConfidence = inference.confidence;
  stem.positionContributors = inference.contributors;
  return next;
}

function inferStemPosition(stemId, time = null, options = {}) {
  const fallback = getStemFallbackPosition(stemId);
  if (!state.analysis || !Array.isArray(state.analysis.instruments)) {
    return { position: fallback, confidence: 0, contributors: [] };
  }
  const finiteTime = Number.isFinite(time);
  const bucket = finiteTime ? Math.max(0, Math.round(time * 6)) : "static";
  const cacheKey = options.immediate ? "" : `${stemId}:${bucket}`;
  if (cacheKey && state.stemPositionCache[cacheKey]) return state.stemPositionCache[cacheKey];

  const groups = STEM_POSITION_GROUPS[stemId] || [];
  const instruments = getAnalysisInstrumentLookup();
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let totalBaseWeight = 0;
  const contributors = [];

  groups.forEach(([instrumentId, baseWeight]) => {
    const instrument = instruments[instrumentId];
    if (!instrument || !instrument.position) return;
    const instrumentPosition = getInstrumentStagePosition(instrument, finiteTime ? time : null);
    const activity = getInstrumentPositionActivity(instrument, finiteTime ? time : null);
    const roster = instrument.active ? 1 : 0.42;
    totalBaseWeight += baseWeight * roster;
    const confidence = clamp(
      (Number(instrument.confidence) || 0) * 0.52 +
      (Number(instrument.peak) || 0) * 0.3 +
      (Number(instrument.mean) || 0) * 0.18,
      0,
      1
    );
    const evidence = finiteTime
      ? clamp(activity * 0.82 + confidence * 0.18, 0, 1)
      : clamp(activity * 0.34 + confidence * 0.66, 0, 1);
    const weight = baseWeight * roster * evidence;
    if (weight <= 0.012) return;
    sumWeight += weight;
    sumX += instrumentPosition.x * weight;
    sumY += instrumentPosition.y * weight;
    sumZ += instrumentPosition.z * weight;
    contributors.push({
      id: instrument.id,
      label: instrument.label,
      weight
    });
  });

  if (sumWeight <= 0.035) {
    const result = { position: fallback, confidence: 0, contributors: [] };
    if (cacheKey) state.stemPositionCache[cacheKey] = result;
    return result;
  }

  contributors.sort((a, b) => b.weight - a.weight);
  const centroid = {
    x: clamp(sumX / sumWeight, STEM_POSITION_BOUNDS.x[0], STEM_POSITION_BOUNDS.x[1]),
    y: clamp(sumY / sumWeight, STEM_POSITION_BOUNDS.y[0], STEM_POSITION_BOUNDS.y[1]),
    z: clamp(sumZ / sumWeight, STEM_POSITION_BOUNDS.z[0], STEM_POSITION_BOUNDS.z[1])
  };
  const confidence = clamp(sumWeight / Math.max(totalBaseWeight * 0.55, 0.001), 0, 1);
  const mix = clamp(0.42 + confidence * 0.5, 0.38, 0.9);
  const position = applyStemPositionAnchor(stemId, {
    x: clamp(fallback.x * (1 - mix) + centroid.x * mix, STEM_POSITION_BOUNDS.x[0], STEM_POSITION_BOUNDS.x[1]),
    y: clamp(fallback.y * (1 - mix) + centroid.y * mix, STEM_POSITION_BOUNDS.y[0], STEM_POSITION_BOUNDS.y[1]),
    z: clamp(fallback.z * (1 - mix) + centroid.z * mix, STEM_POSITION_BOUNDS.z[0], STEM_POSITION_BOUNDS.z[1])
  });
  const result = {
    position,
    confidence,
    contributors: contributors.slice(0, 3)
  };
  if (cacheKey) state.stemPositionCache[cacheKey] = result;
  return result;
}

function applyStemPositionAnchor(stemId, position) {
  const anchor = STEM_POSITION_ANCHORS[stemId];
  if (!anchor) return position;
  return {
    x: clamp(
      anchor.x + (position.x - anchor.x) * anchor.lateralMix,
      anchor.x - anchor.maxAbsX,
      anchor.x + anchor.maxAbsX
    ),
    y: clamp(
      anchor.y * (1 - anchor.verticalMix) + position.y * anchor.verticalMix,
      STEM_POSITION_BOUNDS.y[0],
      STEM_POSITION_BOUNDS.y[1]
    ),
    z: clamp(
      anchor.z * (1 - anchor.depthMix) + position.z * anchor.depthMix,
      STEM_POSITION_BOUNDS.z[0],
      STEM_POSITION_BOUNDS.z[1]
    )
  };
}

function getInstrumentStagePosition(instrument, time = null) {
  const position = instrument.position || { x: 0, y: 0, z: -2.8 };
  return {
    x: position.x,
    y: position.y || 0,
    z: position.z || -2.8
  };
}

function getAnalysisInstrumentLookup() {
  if (!state.analysis || !Array.isArray(state.analysis.instruments)) return {};
  const key = state.analysis.jobId || state.analysis.cacheKey || state.analysis.file?.name || "analysis";
  if (state.stemPositionCache.instrumentKey === key && state.stemPositionCache.instrumentLookup) {
    return state.stemPositionCache.instrumentLookup;
  }
  const lookup = {};
  state.analysis.instruments.forEach((instrument) => {
    lookup[instrument.id] = instrument;
  });
  state.stemPositionCache.instrumentKey = key;
  state.stemPositionCache.instrumentLookup = lookup;
  return lookup;
}

function getInstrumentPositionActivity(instrument, time = null) {
  const curveLevel = Number.isFinite(time)
    ? getInstrumentLevelFromCurve(instrument.curve || instrument.displayCurve || [], time)
    : 0;
  if (Number.isFinite(time)) {
    return clamp(curveLevel * 0.88 + (Number(instrument.confidence) || 0) * 0.08 + (Number(instrument.mean) || 0) * 0.04, 0, 1);
  }
  return clamp(
    (Number(instrument.confidence) || 0) * 0.48 +
    (Number(instrument.peak) || 0) * 0.34 +
    (Number(instrument.mean) || 0) * 0.18,
    0,
    1
  );
}

function getStemFallbackPosition(stemId) {
  const profile = STEM_PROFILES[stemId];
  const fallback = profile && profile.position ? profile.position : { x: 0, y: 0, z: -2.8 };
  return {
    x: fallback.x,
    y: fallback.y,
    z: fallback.z
  };
}

function cacheFieldNodes() {
  const groups = {};
  refs.stageMap.querySelectorAll(".stage-node").forEach((node) => {
    const id = node.dataset.id;
    if (!id) return;
    if (!groups[id]) groups[id] = [];
    groups[id].push(node);
  });
  state.fieldNodeGroups = groups;
}

function renderSpectrumGraph() {
  resetSpectrumState();
  updateSpectrumDisplay(0, { zero: true, force: true });
}

function resetSpectrumState() {
  state.spectrumLevels = Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0);
  state.spectrumPeaks = Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0);
  state.spectrumRanges = null;
  state.spectrumRangeKey = "";
  state.spectrumCache.backgroundKey = "";
  state.spectrumCache.backgroundCanvas = null;
  state.spectrumCache.gradientKey = "";
  state.spectrumCache.gradient = null;
}

function renderInstrumentList(analysis) {
  const objects = getDisplayObjects(analysis);
  state.meterLevels = Object.fromEntries(objects.map((object) => [object.id, 0]));
  state.fieldLevels = Object.fromEntries(objects.map((object) => [object.id, 0]));
  refs.instrumentList.innerHTML = objects.map((object) => `
    <div class="instrument-row ${object.active ? "" : "is-inactive"}" data-id="${object.id}" style="--bar-color:${object.color}; --level:0">
      <div class="stem-copy">
        <strong title="${object.label}">${object.label}</strong>
        <span>${escapeHtml(object.description || getFallbackObjectDescription(object))}</span>
      </div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <em>0%</em>
    </div>
  `).join("");
  cacheMeterRows();
}

function cacheMeterRows() {
  const rows = {};
  refs.instrumentList.querySelectorAll(".instrument-row").forEach((row) => {
    const id = row.dataset.id;
    if (!id) return;
    rows[id] = {
      row,
      value: row.querySelector("em"),
      cache: {
        level: -1,
        percent: -1,
        sounding: null,
        live: null,
        inactive: null
      }
    };
  });
  state.meterRows = rows;
}

function getFallbackObjectDescription(object) {
  if (object.family === "keyboard") return "넓은 대역과 어택을 추적합니다.";
  if (object.family === "percussion") return "타격과 순간 에너지를 추적합니다.";
  if (object.family === "brass" || object.family === "woodwinds") return "중고역 존재감과 거리감을 추적합니다.";
  if (object.family === "strings") return "지속음과 선율 움직임을 추적합니다.";
  return "실시간 에너지 변화를 추적합니다.";
}

function setDisplayObjects(analysis) {
  state.displayObjects = buildDisplayObjects(analysis);
}

function buildDisplayObjects(analysis) {
  if (!analysis) return [];
  if (state.stemBuffers) {
    return Object.values(state.stemBuffers)
      .sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id))
      .map((stem) => {
        const enriched = { ...stem };
        const inference = inferStemPosition(stem.id, state.offset || 0, { immediate: true });
        enriched.position = getStemRenderPosition(enriched, state.offset || 0, { immediate: true });
        enriched.inferredPosition = inference.position;
        enriched.positionConfidence = inference.confidence;
        enriched.positionContributors = inference.contributors;
        return enriched;
      });
  }
  return analysis.instruments.map((instrument) => ({
    ...instrument,
    kind: "instrument",
    short: SHORT_NAMES[instrument.id] || instrument.label
  }));
}

function getDisplayObjects(analysis) {
  if (analysis === state.analysis && Array.isArray(state.displayObjects)) {
    return state.displayObjects;
  }
  return buildDisplayObjects(analysis);
}

function renderModelStack(analysis) {
  const separator = analysis.models.deepSeparator;
  const demucsSettings = separator.settings || {};
  const demucsProfile = separator.qualityProfile || "spatial-q2";
  refs.modelTag.textContent = "Reference HRTF";
  refs.modelStack.innerHTML = `
    <div class="model-item">
      <strong>Demucs stem separator</strong>
      <span>${getDemucsStatusText(separator)}</span>
    </div>
    <div class="model-item">
      <strong>Spatial overlay renderer</strong>
      <span>Original dry signal stays at unity gain; Spatial adds only mix-derived HRTF, early-field, and side expansion layers.</span>
    </div>
    <div class="model-item">
      <strong>Reference HRTF field</strong>
      <span>${escapeHtml(getBinauralRendererSummary())}</span>
    </div>
    <div class="model-item">
      <strong>Model quality pass</strong>
      <span>${escapeHtml(demucsProfile)} uses ${demucsSettings.device || "auto"} inference, ${demucsSettings.shifts || 1} shift averaging, overlap cleanup, and stem confidence weights.</span>
    </div>
    <div class="model-item">
      <strong>Realtime analysis</strong>
      <span>${analysis.models.primary} and Demucs stem analysers drive the UI meters only; audio output stays full-mix based.</span>
    </div>
    ${analysis.recommendations.map((item) => `
      <div class="model-item"><strong>Engine note</strong><span>${escapeHtml(item)}</span></div>
    `).join("")}
  `;
}

function getBinauralRendererSummary() {
  return "The dry mix is left intact while native HRTF taps, synthetic FIR fallback, side expansion, and short early-field reflections supply the spatial overlay.";
}

function getDemucsStatusText(separator) {
  const settings = separator.settings || {};
  const quality = separator.qualityProfile ? ` · ${separator.qualityProfile}` : "";
  const shifts = Number.isFinite(Number(settings.shifts)) ? ` · shifts ${settings.shifts}` : "";
  if (separator.status === "completed" && separator.cached) return `cache hit · ${separator.stems.length} stem files${quality}${shifts}`;
  if (separator.status === "completed") return `stem 분리 완료 · ${separator.stems.length} files${quality}${shifts}`;
  if (separator.status === "failed") return `실행 실패 · ${separator.reason || "unknown error"}`;
  if (separator.available && separator.requested) return "설치되어 있으며 분석 요청 시 자동으로 stem 분리를 실행합니다.";
  if (separator.available) return "설치됨 · 이 프로젝트에서는 기본적으로 stem 분리를 요청합니다.";
  return "현재 환경에는 설치되어 있지 않습니다. 기본 공간 분석 fallback으로 동작합니다.";
}

function renderSections(analysis) {
  refs.sectionList.innerHTML = analysis.sections.map((section) => `
    <article class="section-card">
      <strong>${formatTime(section.start)} - ${formatTime(section.end)}</strong>
      <small>energy ${Math.round(section.energy * 100)} · brightness ${Math.round(section.brightness * 100)} · density ${Math.round(section.density * 100)}</small>
      <ul>
        <li>분석 에너지 ${Math.round(clamp(section.energy * 0.62 + section.density * 0.38, 0, 1) * 100)}%</li>
      </ul>
    </article>
  `).join("");
}

async function togglePlayback() {
  if (state.playing) {
    const time = getPlaybackTime();
    stopPlayback({ keepOffset: true });
    state.offset = time;
    return;
  }
  await startPlayback();
}

async function startPlayback() {
  if (!state.audioBuffer || !state.analysis) return;
  const context = await ensureAudioContext();
  stopPlayback({ keepOffset: true, silent: true });
  resetRuntimeQualityState();
  resetLiveAnalysisCache();
  state.perf.lastFrameAt = 0;
  state.lastVisualFrameAt = 0;
  state.lastStemDisplayFrameTime = -1;
  state.lastFieldDisplayFrameTime = -1;
  state.lastSpectrumFrameTime = -1;
  state.lastSeekFrameTime = -1;

  const graph = createPlaybackGraph(context, state.audioBuffer, state.analysis, state.mode);
  state.graph = graph;
  const safeOffset = clamp(state.offset, 0, Math.max(0, state.audioBuffer.duration - 0.02));
  state.startedAt = context.currentTime - safeOffset;
  state.playing = true;
  refs.playButton.textContent = "Ⅱ";
  startGraphSources(graph, safeOffset, () => {
    if (state.playing && getPlaybackTime() >= state.audioBuffer.duration - 0.05) {
      stopPlayback();
    }
  });
  tick();
}

async function crossfadePlaybackMode(time) {
  if (!state.audioBuffer || !state.analysis || !state.playing) return;
  const context = await ensureAudioContext();
  const oldGraph = state.graph;
  const newGraph = createPlaybackGraph(context, state.audioBuffer, state.analysis, state.mode);
  const safeOffset = clamp(time, 0, Math.max(0, state.audioBuffer.duration - 0.02));
  const now = context.currentTime;
  const scheduleLead = getModeSwitchScheduleLead(context);
  const startAt = now + scheduleLead;
  const sourceOffset = clamp(safeOffset + scheduleLead, 0, Math.max(0, state.audioBuffer.duration - 0.02));
  const fadeSeconds = state.mode === "spatial" ? 0.38 : 0.34;
  const targetGain = getGraphTargetGain(newGraph);
  const incomingStartGain = 0;

  if (newGraph.master) {
    newGraph.master.gain.cancelScheduledValues(now);
    newGraph.master.gain.setValueAtTime(0, now);
    newGraph.crossfadeUntil = startAt + fadeSeconds;
    scheduleGraphGainCurve(newGraph, incomingStartGain, targetGain, startAt, fadeSeconds, "in", "linear");
  }
  if (oldGraph?.mode === "original" && newGraph.mode === "spatial") {
    scheduleSpatialWetLayerIntro(newGraph, now, startAt, fadeSeconds + 0.18);
  }

  state.graph = newGraph;
  state.offset = safeOffset;
  state.startedAt = now - safeOffset;
  startGraphSources(newGraph, sourceOffset, () => {
    if (state.playing && state.graph === newGraph && getPlaybackTime() >= state.audioBuffer.duration - 0.05) {
      stopPlayback();
    }
  }, startAt);

  if (oldGraph && oldGraph.master) {
    scheduleGraphGainCurve(oldGraph, getGraphCurrentGain(oldGraph, startAt), 0, startAt, fadeSeconds, "out", "linear");
    retireGraphAfterFade(oldGraph, scheduleLead + fadeSeconds);
  } else if (oldGraph) {
    retireGraphAfterFade(oldGraph, 0);
  }
}

function getModeSwitchScheduleLead(context) {
  const latency = context && Number.isFinite(context.baseLatency) ? context.baseLatency : 0.012;
  return clamp(latency * 2.5, 0.035, 0.08);
}

function scheduleSpatialWetLayerIntro(graph, now, startAt, seconds) {
  const wetGain = graph?.spatialLayer?.wetMaster?.gain;
  const target = graph?.spatialLayer?.baseWetGain;
  if (!wetGain || !Number.isFinite(target)) return;
  wetGain.cancelScheduledValues(now);
  wetGain.setValueAtTime(0, now);
  wetGain.setValueAtTime(0, startAt);
  wetGain.linearRampToValueAtTime(target, startAt + Math.max(0.12, seconds));
}

function startGraphSources(graph, offset, onEnded, startAt = 0) {
  const sources = graph.sources || [graph.source];
  sources.forEach((source) => {
    if (!source) return;
    const when = Number.isFinite(startAt) && startAt > 0 ? startAt : 0;
    if (source.buffer) {
      const sourceOffset = clamp(offset, 0, Math.max(0, source.buffer.duration - 0.02));
      source.start(when, sourceOffset);
      return;
    }
    source.start(when);
  });
  if (sources[0]) {
    sources[0].onended = onEnded;
  }
}

function scheduleGraphGainCurve(graph, fromGain, toGain, now, seconds, direction, curveType = "equalPower") {
  if (!graph || !graph.master) return;
  const gain = graph.master.gain;
  const duration = Math.max(0.04, seconds);
  const from = Number.isFinite(fromGain) ? fromGain : gain.value;
  const to = Number.isFinite(toGain) ? toGain : gain.value;
  const curve = curveType === "linear"
    ? buildLinearGainCurve(from, to)
    : buildEqualPowerGainCurve(from, to, direction);

  gain.cancelScheduledValues(now);
  gain.setValueAtTime(curve[0], now);
  try {
    gain.setValueCurveAtTime(curve, now, duration);
  } catch (curveError) {
    gain.linearRampToValueAtTime(to, now + duration);
  }
  gain.setTargetAtTime(to, now + duration + 0.006, 0.012);
  graph.gainAutomation = {
    direction,
    from,
    to,
    startTime: now,
    endTime: now + duration,
    curveType
  };
}

function buildLinearGainCurve(from, to) {
  const points = 64;
  const curve = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    const ratio = index / (points - 1);
    curve[index] = from + (to - from) * ratio;
  }
  curve[0] = from;
  curve[points - 1] = to;
  return curve;
}

function buildEqualPowerGainCurve(from, to, direction) {
  const points = 64;
  const curve = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    const ratio = index / (points - 1);
    if (direction === "out") {
      curve[index] = to + (from - to) * Math.cos(ratio * Math.PI * 0.5);
    } else {
      curve[index] = from + (to - from) * Math.sin(ratio * Math.PI * 0.5);
    }
  }
  curve[0] = from;
  curve[points - 1] = to;
  return curve;
}

function getGraphCurrentGain(graph, time) {
  if (!graph || !graph.master) return getGraphTargetGain(graph);
  const automation = graph.gainAutomation;
  if (!automation) return graph.master.gain.value;
  if (time <= automation.startTime) return automation.from;
  if (time >= automation.endTime) return automation.to;
  const ratio = clamp((time - automation.startTime) / Math.max(0.001, automation.endTime - automation.startTime), 0, 1);
  if (automation.curveType === "linear") {
    return automation.from + (automation.to - automation.from) * ratio;
  }
  if (automation.direction === "out") {
    return automation.to + (automation.from - automation.to) * Math.cos(ratio * Math.PI * 0.5);
  }
  return automation.from + (automation.to - automation.from) * Math.sin(ratio * Math.PI * 0.5);
}

function getGraphTargetGain(graph) {
  const scale = graph && Number.isFinite(graph.outputGainScale) ? graph.outputGainScale : 1;
  return scale;
}

function retireGraphAfterFade(graph, seconds) {
  if (!graph) return;
  const sources = graph.sources || [graph.source];
  sources.forEach((source) => {
    source.onended = null;
  });
  const timer = window.setTimeout(() => {
    disposeGraph(graph);
    state.retiredGraphs = state.retiredGraphs.filter((item) => item.graph !== graph);
  }, Math.max(0, seconds * 1000 + 80));
  state.retiredGraphs.push({ graph, timer });
}

function disposeGraph(graph) {
  if (!graph || graph.disposed) return;
  graph.disposed = true;
  const sources = graph.sources || [graph.source];
  sources.forEach((source) => {
    if (!source) return;
    try {
      source.onended = null;
      source.stop();
    } catch (stopError) {
      // Source may already be stopped.
    }
    try {
      source.disconnect();
    } catch (disconnectError) {
      // Source may already be disconnected.
    }
  });
  disconnectGraph(graph);
  graph.previousLiveScores = {};
  graph.livePowerData = null;
  graph.frequencyData = null;
  graph.timeData = null;
  graph.stemAnalysisMeters = null;
  graph.spatialLayer = null;
}

function stopPlayback(options = {}) {
  const { keepOffset = false, silent = false } = options;
  state.retiredGraphs.forEach((item) => {
    window.clearTimeout(item.timer);
    disposeGraph(item.graph);
  });
  state.retiredGraphs = [];
  if (state.graph) {
    disposeGraph(state.graph);
    state.graph = null;
  }
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }
  state.lastMeterFrameTime = -1;
  state.lastStemDisplayFrameTime = -1;
  state.lastFieldDisplayFrameTime = -1;
  state.lastSpectrumFrameTime = -1;
  state.lastSeekFrameTime = -1;
  state.lastVisualFrameAt = 0;
  resetLiveAnalysisCache();
  if (!keepOffset) {
    state.offset = 0;
    Object.keys(state.meterLevels).forEach((id) => {
      state.meterLevels[id] = 0;
    });
    Object.keys(state.fieldLevels).forEach((id) => {
      state.fieldLevels[id] = 0;
    });
  }
  state.playing = false;
  refs.playButton.textContent = "▶";
  if (!silent) {
    drawWaveform(state.offset);
    if (state.mode === "original") {
      setRealtimeMetersToZero(state.offset);
      updateSpectrumDisplay(state.offset, { zero: true });
    } else {
      updateRealtimeDisplay(state.offset);
      updateSpectrumDisplay(state.offset, { zero: true });
    }
    updateSeek(state.offset, { force: true });
  }
}

function createPlaybackGraph(context, buffer, analysis, mode) {
  if (mode === "spatial") {
    return createSpatialPlaybackGraph(context, buffer, analysis);
  }
  return createOriginalPlaybackGraph(context, buffer, analysis);
}

function createPassthroughOutputChain(context) {
  const input = context.createGain();
  const master = context.createGain();
  const outputGainScale = 1;
  master.gain.value = outputGainScale;
  input.connect(master);
  master.connect(context.destination);

  const liveMeter = createLiveInstrumentMeter(context, master);
  return {
    mode: "spatial",
    outputGainScale,
    input,
    master,
    liveMeter,
    nodes: [input, master, ...liveMeter.nodes]
  };
}

function createOriginalPlaybackGraph(context, buffer, analysis) {
  const source = context.createBufferSource();
  const master = context.createGain();
  source.buffer = buffer;
  master.gain.value = 1;
  source.connect(master).connect(context.destination);
  const liveMeter = createLiveInstrumentMeter(context, master);

  return {
    mode: "original",
    source,
    sources: [source],
    master,
    outputGainScale: 1,
    analyser: liveMeter.analyser,
    frequencyData: liveMeter.frequencyData,
    timeData: liveMeter.timeData,
    previousLiveScores: {},
    nodes: [master, ...liveMeter.nodes]
  };
}

function createSpatialPlaybackGraph(context, buffer, analysis) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const output = createPassthroughOutputChain(context);

  const spatialLayer = createSpatialWetLayer(context, {
    mixSource: source,
    output: output.input,
    analysis
  });
  const outputGainScale = 1;
  output.outputGainScale = outputGainScale;
  output.master.gain.value = outputGainScale;

  return {
    mode: "spatial",
    source,
    sources: [source, ...spatialLayer.sources],
    master: output.master,
    outputGainScale,
    analyser: output.liveMeter.analyser,
    frequencyData: output.liveMeter.frequencyData,
    timeData: output.liveMeter.timeData,
    stemAnalysisMeters: spatialLayer.stemAnalysisMeters,
    previousLiveScores: {},
    spatialLayer,
    nodes: [...spatialLayer.nodes, ...output.nodes]
  };
}

function createSpatialWetLayer(context, options) {
  const { mixSource, output, analysis } = options;
  const settings = state.spatialSettings;
  const measuredBrir = hasMeasuredBrirLibrary();
  const wetMaster = context.createGain();
  const centerStageBus = context.createGain();
  const reflectionBus = context.createGain();
  const lateralBus = context.createGain();
  const fullBandAnchorBus = context.createGain();
  const originalAnchorSend = context.createGain();
  const stemItems = getSpatialStemItems(analysis);
  const usesOriginalAnchor = true;

  const spaceLift = 1 + (SPATIAL_SPACE_MULTIPLIER - 1);
  const nearFieldLift = 1 + (spaceLift - 1) * 0.16;
  const wideFieldLift = (1 + (spaceLift - 1) * 0.18) * (0.94 + SPATIAL_SIDE_ENERGY_SCALE * 0.06);

  const baseWetGain = getSpatialWetGain(settings) * SPATIAL_FIRST_WET_SCALE * (measuredBrir ? 1.02 : 0.96) * nearFieldLift;
  wetMaster.gain.value = baseWetGain;
  fullBandAnchorBus.gain.value = 1;
  originalAnchorSend.gain.value = 1;
  centerStageBus.gain.value = getSpatialCenterStageGain(settings) * (measuredBrir ? 0.13 : 0.1) * nearFieldLift;
  reflectionBus.gain.value = getSpatialReflectionGain(settings) * (measuredBrir ? 0.16 : 0.14) * wideFieldLift;
  lateralBus.gain.value = getSpatialLateralGain(settings, analysis) * wideFieldLift * 0.86;

  centerStageBus.connect(wetMaster);
  reflectionBus.connect(wetMaster);
  lateralBus.connect(wetMaster);
  mixSource.connect(originalAnchorSend).connect(fullBandAnchorBus);
  fullBandAnchorBus.connect(output);
  wetMaster.connect(output);

  const nodes = [
    wetMaster,
    centerStageBus,
    reflectionBus,
    lateralBus,
    fullBandAnchorBus,
    originalAnchorSend
  ];
  const sources = [];
  const stemAnalysisMeters = { byId: {}, nodes: [] };

  if (stemItems.length) {
    stemItems.forEach((stem) => {
      const stemSource = context.createBufferSource();
      stemSource.buffer = stem.buffer;
      sources.push(stemSource);
      const meter = createStemMeterTap(context, stemSource);
      nodes.push(...meter.nodes);
      stemAnalysisMeters.byId[stem.id] = meter;
    });
  }

  const spatialSource = mixSource;
  const centerStage = createCenterStagePresenceLayer(context, spatialSource, centerStageBus, { measuredBrir });
  const field = createDiffuseFieldLayer(context, spatialSource, reflectionBus, { measuredBrir });
  const lateral = createLateralSideExpansionLayer(context, spatialSource, lateralBus, { analysis, channelCount: 2 });
  nodes.push(...centerStage.nodes, ...field.nodes, ...lateral.nodes);

  return {
    sources,
    wetMaster,
    baseWetGain,
    centerStageBus,
    reflectionBus,
    lateralBus,
    fullBandAnchorBus,
    originalAnchorSend,
    usesOriginalAnchor,
    stemAnalysisMeters,
    centerStage,
    field,
    lateral,
    nodes
  };
}

function getSpatialStemItems(analysis) {
  if (!state.stemBuffers) return [];
  return Object.values(state.stemBuffers)
    .filter((stem) => stem && stem.buffer)
    .sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id));
}

function createLateralSideExpansionLayer(context, source, output, options = {}) {
  const channelCount = source?.buffer?.numberOfChannels || options.channelCount || 2;
  if (!source || channelCount < 2) {
    return createEmptySpatialLayer();
  }

  const splitter = context.createChannelSplitter(2);
  const leftSide = context.createGain();
  const rightSide = context.createGain();
  const sideSum = context.createGain();
  const allpassA = context.createBiquadFilter();
  const allpassB = context.createBiquadFilter();
  const leftOut = context.createGain();
  const rightOut = context.createGain();
  const merger = context.createChannelMerger(2);
  const stereoWidth = clamp(Number(options.analysis?.stereoImage?.width) || 0.36, 0, 1);
  const sideLift = clamp(
    (0.72 + (1 - stereoWidth) * 0.34 + state.spatialSettings.radius * 0.18) * SPATIAL_SIDE_ENERGY_SCALE,
    0.84,
    1.38
  );

  leftSide.gain.value = 0.5;
  rightSide.gain.value = -0.5;
  sideSum.gain.value = 1;
  allpassA.type = "allpass";
  allpassA.frequency.value = 680;
  allpassA.Q.value = 0.72;
  allpassB.type = "allpass";
  allpassB.frequency.value = 2450;
  allpassB.Q.value = 0.54;
  leftOut.gain.value = 0.72 * sideLift;
  rightOut.gain.value = -0.72 * sideLift;

  source.connect(splitter);
  splitter.connect(leftSide, 0);
  splitter.connect(rightSide, 1);
  leftSide.connect(sideSum);
  rightSide.connect(sideSum);
  sideSum
    .connect(allpassA)
    .connect(allpassB);
  allpassB.connect(leftOut).connect(merger, 0, 0);
  allpassB.connect(rightOut).connect(merger, 0, 1);
  merger.connect(output);

  return {
    send: sideSum,
    taps: [],
    sources: [],
    nodes: [
      splitter,
      leftSide,
      rightSide,
      sideSum,
      allpassA,
      allpassB,
      leftOut,
      rightOut,
      merger
    ]
  };
}

function createStemMeterTap(context, input) {
  const analyser = context.createAnalyser();
  analyser.fftSize = STEM_METER_FFT_SIZE;
  analyser.minDecibels = -92;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.16;
  const silentTap = context.createGain();
  silentTap.gain.value = 0;
  input.connect(analyser);
  analyser.connect(silentTap).connect(context.destination);
  return {
    analyser,
    timeData: new Float32Array(analyser.fftSize),
    nodes: [analyser, silentTap]
  };
}

function createCenterStagePresenceLayer(context, source, output, options = {}) {
  const splitter = context.createChannelSplitter(2);
  const leftMid = context.createGain();
  const rightMid = context.createGain();
  const mid = context.createGain();
  const send = context.createGain();
  const nodes = [splitter, leftMid, rightMid, mid, send];
  const taps = [];
  const channelCount = source.buffer && source.buffer.numberOfChannels ? source.buffer.numberOfChannels : 2;

  leftMid.gain.value = channelCount > 1 ? 0.5 : 1;
  rightMid.gain.value = channelCount > 1 ? 0.5 : 0;
  mid.gain.value = 1;
  send.gain.value = options.measuredBrir ? 0.029 : 0.023;

  source.connect(splitter);
  splitter.connect(leftMid, 0);
  if (channelCount > 1) {
    splitter.connect(rightMid, 1);
  }
  leftMid.connect(mid);
  rightMid.connect(mid);
  mid.connect(send);

  SPATIAL_CENTER_STAGE_DIRECTIONS.forEach((direction) => {
    const tap = createPannedDelayTap(context, send, output, direction, {
      maxDelay: 0.06,
      delayScale: getFarFieldDelayScale(options, "center"),
      gainScale: getCenterStageTapGainScale(direction, options),
      panScale: 1.3 * SPATIAL_NATURAL_PAN_SCALE
    });
    taps.push({ direction, ...tap, baseGain: direction.gain });
    nodes.push(...tap.nodes);
  });

  return { send, taps, nodes };
}

function createDiffuseFieldLayer(context, source, output, options = {}) {
  const send = context.createGain();
  const nodes = [send];
  const taps = [];
  const directions = SPATIAL_FIELD_DIRECTIONS;

  send.gain.value = options.measuredBrir ? 0.036 : 0.05;
  source.connect(send);

  directions.forEach((direction, index) => {
    const gainScale = getSurroundTapGainScale(direction, options, "field");
    const delayScale = getFarFieldDelayScale(options, "field");
    if (!shouldUseHrtfTap(direction, "field")) {
      const tap = createPannedDelayTap(context, send, output, direction, {
        maxDelay: 0.055,
        delayScale,
        gainScale: gainScale * 0.44,
        panScale: 1.26 * SPATIAL_NATURAL_PAN_SCALE
      });
      taps.push({ direction, ...tap, baseGain: direction.gain });
      nodes.push(...tap.nodes);
      return;
    }

    const delay = context.createDelay(0.06);
    const gain = context.createGain();
    const position = getInterpolatedHrtfPosition(direction);
    const renderer = createReferenceHrtfRenderer(context, position, {
      role: "reflection",
      seed: index + 17,
      forceSynthetic: false
    });
    delay.delayTime.value = direction.delay * delayScale;
    gain.gain.value = direction.gain * gainScale * 0.72;
    send.connect(delay).connect(gain).connect(renderer.node).connect(output);
    taps.push({ direction, delay, gain, renderer: renderer.node, rendererMode: renderer.mode, baseGain: direction.gain });
    nodes.push(delay, gain, renderer.node);
  });

  return { send, taps, nodes };
}

function getInterpolatedHrtfPosition(position, options = {}) {
  const radius = state.spatialSettings.radius;
  const expansive = options.expansive ? 1 : 0;
  const stage = options.stage ? 1 : 0;
  const widthLift = (1 + (SPATIAL_SPACE_MULTIPLIER - 1) * 0.28) * SPATIAL_WIDTH_MULTIPLIER;
  const heightLift = 1 + (SPATIAL_SPACE_MULTIPLIER - 1) * 0.24;
  const distanceLift = 1 + (SPATIAL_SPACE_MULTIPLIER - 1) * 0.42;
  const azimuthInput = (position.azimuth || 0) *
    (1 + radius * (0.2 + expansive * 0.12 + stage * 0.03) * widthLift);
  const azimuth = softLimit(azimuthInput, SPATIAL_MAX_RENDER_AZIMUTH);
  const elevation = clamp((position.elevation || 0) * (0.98 + radius * (0.18 + expansive * 0.09 + stage * 0.03) * heightLift), -68, 84);
  const distance = clamp(
    (position.distance || 1.25) *
      (1.16 + radius * (0.62 + expansive * 0.34 + stage * 0.1) * distanceLift) *
      SPATIAL_DISTANCE_ENVELOPMENT,
    0.92,
    expansive ? 24 : 20
  );
  return { azimuth, elevation, distance };
}

function softLimit(value, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 0;
  return limit * Math.tanh(value / limit);
}

function createBinauralRendererImpulse(context, position, options = {}) {
  return createSyntheticHrtfImpulse(context, position, options);
}

function createReferenceHrtfRenderer(context, position, options = {}) {
  if (typeof context.createPanner === "function" && options.forceSynthetic !== true) {
    const panner = context.createPanner();
    configureReferenceHrtfPanner(context, panner, position, options);
    return { node: panner, mode: "native-hrtf" };
  }

  const convolver = context.createConvolver();
  convolver.normalize = false;
  convolver.buffer = createBinauralRendererImpulse(context, position, options);
  return { node: convolver, mode: "synthetic-fir" };
}

function configureReferenceHrtfPanner(context, panner, position, options = {}) {
  const cartesian = sphericalToListenerCoordinates(position);
  panner.panningModel = "HRTF";
  panner.distanceModel = "linear";
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = Number.isFinite(options.rolloffFactor) ? options.rolloffFactor : 0;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 1;
  setAudioParamValue(panner.positionX, cartesian.x, context.currentTime);
  setAudioParamValue(panner.positionY, cartesian.y, context.currentTime);
  setAudioParamValue(panner.positionZ, cartesian.z, context.currentTime);
  setAudioParamValue(panner.orientationX, -cartesian.x, context.currentTime);
  setAudioParamValue(panner.orientationY, -cartesian.y, context.currentTime);
  setAudioParamValue(panner.orientationZ, -cartesian.z, context.currentTime);
  if (typeof panner.setPosition === "function") {
    panner.setPosition(cartesian.x, cartesian.y, cartesian.z);
  }
  if (typeof panner.setOrientation === "function") {
    panner.setOrientation(-cartesian.x, -cartesian.y, -cartesian.z);
  }
}

function sphericalToListenerCoordinates(position = {}) {
  const azimuth = clamp(position.azimuth || 0, -178, 178) * Math.PI / 180;
  const elevation = clamp(position.elevation || 0, -88, 88) * Math.PI / 180;
  const distance = Math.max(0.1, Number(position.distance) || 1);
  const horizontal = Math.cos(elevation) * distance;
  return {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation) * distance,
    z: -Math.cos(azimuth) * horizontal
  };
}

function hasMeasuredBrirLibrary() {
  return false;
}

function getSurroundTapGainScale(direction, options = {}, layer = "field") {
  const azimuth = Math.abs(normalizeDegrees(direction.azimuth || 0));
  const elevation = Math.abs(Number(direction.elevation) || 0);
  const side = clamp(1 - Math.abs(azimuth - 105) / 72, 0, 1);
  const rear = clamp((azimuth - SPATIAL_FRONT_HEMISPHERE_AZIMUTH_LIMIT) / 70, 0, 1);
  const height = clamp((elevation - 38) / 42, 0, 1);
  const measuredBase = options.measuredBrir ? 0.98 : 1.04;
  const spaceLift = 1 + (SPATIAL_SPACE_MULTIPLIER - 1);
  const sideWidthLift = SPATIAL_WIDTH_MULTIPLIER - 1;
  const surroundLift = 1
    + side * (0.5 + (spaceLift - 1) * 0.23 + sideWidthLift * 0.5) * SPATIAL_SIDE_ENERGY_SCALE
    + rear * (0.12 + (spaceLift - 1) * 0.04 + sideWidthLift * 0.025) * SPATIAL_SIDE_ENERGY_SCALE
    + height * (0.23 + (spaceLift - 1) * 0.13) * (0.92 + SPATIAL_SIDE_ENERGY_SCALE * 0.08);
  return measuredBase * surroundLift;
}

function shouldUseHrtfTap(direction, layer) {
  const id = direction?.id;
  if (!id) return false;
  if (layer === "field") return SPATIAL_FIELD_HRTF_TAPS.has(id);
  return true;
}

function createPannedDelayTap(context, input, output, direction, options = {}) {
  const delay = context.createDelay(options.maxDelay || 0.18);
  const gain = context.createGain();
  const panner = createDirectionalPanner(context, direction, options);
  delay.delayTime.value = direction.delay * (options.delayScale || 1);
  gain.gain.value = direction.gain * (options.gainScale || 1);
  input.connect(delay).connect(gain).connect(panner).connect(output);
  return {
    delay,
    gain,
    panner,
    nodes: [delay, gain, panner]
  };
}

function createDirectionalPanner(context, direction, options = {}) {
  if (typeof context.createStereoPanner === "function") {
    const panner = context.createStereoPanner();
    panner.pan.value = getDirectionPan(direction, options.panScale || 1);
    return panner;
  }
  const fallback = context.createGain();
  fallback.gain.value = 1;
  return fallback;
}

function getDirectionPan(direction, panScale = 1) {
  const azimuth = (direction.azimuth || 0) * Math.PI / 180;
  const side = Math.sin(azimuth);
  const widthLift = (1 + (SPATIAL_SPACE_MULTIPLIER - 1) * 0.14) * SPATIAL_WIDTH_MULTIPLIER;
  return clamp(side * 1.02 * widthLift * panScale * SPATIAL_NATURAL_PAN_SCALE, -1, 1);
}

function getCenterStageTapGainScale(direction, options = {}) {
  const side = Math.abs(Math.sin((direction.azimuth || 0) * Math.PI / 180));
  const center = Math.abs(direction.azimuth || 0) < 8 ? 1 : 0;
  const measuredBase = options.measuredBrir ? 0.84 : 0.9;
  return measuredBase * (center ? 0.82 : (0.94 + side * 0.24));
}

function getFarFieldDelayScale(options = {}, layer = "field") {
  const spaceLift = 1 + (SPATIAL_SPACE_MULTIPLIER - 1);
  const naturalScale = SPATIAL_NATURAL_DELAY_SCALE;
  if (layer === "center") return (options.measuredBrir ? 0.39 : 0.35) * (1 + (spaceLift - 1) * 0.008) * naturalScale;
  return (options.measuredBrir ? 0.41 : 0.37) * (1 + (spaceLift - 1) * 0.01) * naturalScale;
}

function createEmptySpatialLayer() {
  return { send: null, taps: [], sources: [], nodes: [] };
}

function createSyntheticHrtfImpulse(context, position, options = {}) {
  const cacheKey = getHrtfImpulseCacheKey(context, position, options);
  const cached = state.hrtfImpulseCache.get(cacheKey);
  if (cached) return cached;

  const sampleRate = context.sampleRate;
  const role = options.role || "direct";
  const renderRole = role === "objectRoom" || role === "centerStage" || role === "horizon"
    ? "reflection"
    : (role === "object" ? "direct" : role);
  const lengthSeconds = renderRole === "body" ? 0.018 : (renderRole === "orbit" ? 0.034 : (renderRole === "reflection" ? 0.024 : 0.0145));
  const length = Math.max(96, Math.round(sampleRate * lengthSeconds));
  const buffer = context.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const cue = getBinauralCue(position);
  const baseDelay = renderRole === "body"
    ? 0.0011 + cue.rear * 0.00062 + cue.low * 0.00036
    : (renderRole === "orbit"
      ? 0.0024 + cue.rear * 0.0011
      : (renderRole === "reflection" ? 0.0018 + cue.rear * 0.0007 : 0.00018 + cue.rear * 0.00024));
  const leftStart = Math.round((baseDelay + cue.leftDelay) * sampleRate);
  const rightStart = Math.round((baseDelay + cue.rightDelay) * sampleRate);
  const rawDistanceGain = 1 / Math.sqrt(Math.max(0.72, position.distance || 1));
  const distanceGain = renderRole === "direct" ? rawDistanceGain : Math.max(rawDistanceGain, 0.48);
  const roleGain = renderRole === "body" ? 0.44 : (renderRole === "orbit" ? 0.32 : (renderRole === "reflection" ? 0.38 : 0.82));
  const seed = options.seed || 1;

  addFirTap(left, leftStart, cue.leftGain * distanceGain * roleGain);
  addFirTap(right, rightStart, cue.rightGain * distanceGain * roleGain);

  const pinnaBase = Math.round((
    0.00155 +
    Math.abs(cue.side) * 0.00125 +
    cue.height * 0.00115 +
    cue.rear * 0.0018
  ) * sampleRate);
  const rearShade = cue.rear > 0.36 ? -1 : 1;
  const tapCount = renderRole === "orbit" ? 7 : (renderRole === "body" ? 4 : 5);
  for (let tap = 1; tap <= tapCount; tap += 1) {
    const offset = pinnaBase + tap * Math.round((0.00058 + tap * 0.00018 + cue.rear * 0.00012) * sampleRate);
    const sign = tap % 2 ? 1 : -1;
    const spread = 1 + Math.abs(cue.side) * 0.2 + cue.height * 0.2 + cue.rear * 0.26;
    const amp = roleGain * distanceGain * (0.12 / (tap + 0.45)) * sign * rearShade;
    addFirTap(left, leftStart + offset, amp * (cue.leftGain * 0.68 + spread * 0.12));
    addFirTap(right, rightStart + offset + Math.round(cue.side * sampleRate * 0.00022), amp * (cue.rightGain * 0.68 - spread * 0.09));
  }

  const shoulderDelay = Math.round((0.0048 + cue.rear * 0.0038 + cue.height * 0.0014) * sampleRate);
  const shoulderAmp = roleGain * distanceGain * (
    renderRole === "body"
      ? 0.075 + cue.rear * 0.025 + cue.low * 0.024
      : 0.035 + cue.rear * 0.028 + cue.height * 0.016
  );
  addFirTap(left, rightStart + shoulderDelay, shoulderAmp * cue.crossLeft);
  addFirTap(right, leftStart + shoulderDelay + 1, shoulderAmp * cue.crossRight);

  if (renderRole === "body") {
    const wrapDelay = Math.round((0.0085 + cue.rear * 0.004 + Math.abs(cue.side) * 0.0018) * sampleRate);
    const wrapAmp = roleGain * distanceGain * 0.055;
    addFirTap(left, leftStart + wrapDelay, wrapAmp * (0.72 + cue.rear * 0.36));
    addFirTap(right, rightStart + wrapDelay + 1, wrapAmp * (0.72 + cue.rear * 0.36));
  }

  const airTap = Math.round((0.0068 + Math.abs(cue.side) * 0.0018 + cue.height * 0.0012 + cue.rear * 0.0022) * sampleRate);
  addFirTap(left, leftStart + airTap, deterministicSigned(seed, 0) * 0.018 * roleGain * (1 + cue.height * 0.5));
  addFirTap(right, rightStart + airTap + 2, deterministicSigned(seed, 1) * 0.018 * roleGain * (1 + cue.height * 0.5));
  normalizeImpulsePair(left, right, renderRole === "body" ? 0.46 : (renderRole === "orbit" ? 0.42 : (renderRole === "reflection" ? 0.56 : 0.82)));
  cacheAudioBuffer(state.hrtfImpulseCache, cacheKey, buffer, 140);
  return buffer;
}

function getHrtfImpulseCacheKey(context, position, options = {}) {
  const role = options.role || "direct";
  const seed = options.seed || 1;
  const radius = Math.round(state.spatialSettings.radius * 100);
  const azimuth = Math.round((position.azimuth || 0) * 2) / 2;
  const elevation = Math.round((position.elevation || 0) * 2) / 2;
  const distance = Math.round((position.distance || 1) * 20) / 20;
  return `${context.sampleRate}:${role}:${seed}:${radius}:${azimuth}:${elevation}:${distance}`;
}

function getBinauralCue(position) {
  const azimuthDegrees = clamp(position.azimuth || 0, -SPATIAL_MAX_RENDER_AZIMUTH, SPATIAL_MAX_RENDER_AZIMUTH);
  const azimuth = azimuthDegrees * Math.PI / 180;
  const elevation = clamp(position.elevation || 0, -70, 75) * Math.PI / 180;
  const side = Math.sin(azimuth);
  const frontBack = Math.cos(azimuth);
  const rear = clamp((Math.abs(azimuthDegrees) - SPATIAL_FRONT_HEMISPHERE_AZIMUTH_LIMIT) / 56, 0, 1);
  const front = Math.max(0, frontBack);
  const height = Math.max(0, Math.sin(elevation));
  const low = Math.max(0, -Math.sin(elevation));
  const radius = state.spatialSettings.radius;
  const spaceCue = Math.min(
    1.36,
    (1 + (SPATIAL_SPACE_MULTIPLIER - 1) * 0.08) * SPATIAL_WIDTH_MULTIPLIER
  );
  const maxItd = 0.00068 * (0.94 + radius * 0.12) * spaceCue;
  const itd = side * maxItd;
  const shadow = Math.min(0.52, Math.abs(side) * (0.24 + radius * 0.18) + rear * 0.05);
  const heightLift = height * 0.08;
  const rearDull = rear * 0.025;
  const leftGain = side > 0
    ? 1 - shadow - rearDull
    : 1 + shadow * 0.26 + heightLift;
  const rightGain = side < 0
    ? 1 - shadow - rearDull
    : 1 + shadow * 0.26 + heightLift;
  const norm = Math.max(leftGain, rightGain, 1);
  return {
    side,
    front,
    rear,
    height,
    low,
    leftDelay: Math.max(0, itd) + rear * 0.00018 + low * 0.00004 + front * height * 0.00006,
    rightDelay: Math.max(0, -itd) + rear * 0.00018 + low * 0.00004 + front * height * 0.00006,
    leftGain: leftGain / norm,
    rightGain: rightGain / norm,
    crossLeft: clamp(0.27 + front * 0.12 + rear * 0.46 + height * 0.16, 0.2, 0.86),
    crossRight: clamp(0.27 + front * 0.12 + rear * 0.46 + height * 0.16, 0.2, 0.86)
  };
}

function cacheAudioBuffer(cache, key, buffer, limit) {
  if (!cache || !key || !buffer) return;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, buffer);
  while (cache.size > limit) {
    const firstKey = cache.keys().next().value;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
}

function addFirTap(channel, index, value) {
  if (index < 0 || index >= channel.length || !Number.isFinite(value)) return;
  channel[index] += value;
}

function deterministicSigned(index, seed = 0) {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function normalizeDegrees(value) {
  const normalized = ((Number(value) || 0) + 180) % 360 - 180;
  return normalized === -180 && value > 0 ? 180 : normalized;
}

function normalizeImpulsePair(left, right, targetPeak) {
  let peak = 0;
  for (let index = 0; index < left.length; index += 1) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  if (peak <= 0 || peak <= targetPeak) return;
  const scale = targetPeak / peak;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= scale;
    right[index] *= scale;
  }
}

function getSpatialWetGain(settings = state.spatialSettings) {
  return clamp(settings.wet, 0, 0.84);
}

function getSpatialCenterStageGain(settings = state.spatialSettings) {
  return clamp(0.075 + settings.radius * 0.055 + settings.reflections * 0.035, 0.1, 0.2);
}

function getSpatialReflectionGain(settings = state.spatialSettings) {
  return clamp((0.08 + settings.reflections * 0.28) * 1.02, 0.06, 0.3);
}

function getSpatialLateralGain(settings = state.spatialSettings, analysis = state.analysis) {
  const stereoWidth = clamp(Number(analysis?.stereoImage?.width) || 0.36, 0, 1);
  const narrowLift = (1 - stereoWidth) * 0.12;
  return clamp((0.24 + settings.radius * 0.11 + settings.wet * 0.07 + narrowLift) * 1.36, 0.36, 0.72);
}

function createLiveInstrumentMeter(context, input) {
  const analyser = context.createAnalyser();
  analyser.fftSize = LIVE_ANALYSER_FFT_SIZE;
  analyser.minDecibels = -96;
  analyser.maxDecibels = -12;
  analyser.smoothingTimeConstant = 0.28;
  const silentTap = context.createGain();
  silentTap.gain.value = 0;
  input.connect(analyser);
  analyser.connect(silentTap).connect(context.destination);
  return {
    analyser,
    frequencyData: new Float32Array(analyser.frequencyBinCount),
    timeData: new Float32Array(analyser.fftSize),
    nodes: [analyser, silentTap]
  };
}

function disconnectGraph(graph) {
  if (!graph.nodes) return;
  graph.nodes.forEach((node) => {
    if (!node) return;
    try {
      node.disconnect();
    } catch (disconnectError) {
      // Some nodes may already be disconnected.
    }
  });
  graph.nodes = [];
}

function tick() {
  if (!state.playing) return;
  const frameStart = performance.now();
  const frameInterval = (document.hidden ? HIDDEN_VISUAL_FRAME_INTERVAL : VISUAL_FRAME_INTERVAL) * 1000;
  if (state.lastVisualFrameAt && frameStart - state.lastVisualFrameAt < frameInterval) {
    state.animationId = requestAnimationFrame(tick);
    return;
  }
  state.lastVisualFrameAt = frameStart;
  trackFrameTiming(frameStart);
  const quality = getRuntimeQualityProfile();
  const time = getPlaybackTime();
  if (time >= state.audioBuffer.duration) {
    stopPlayback();
    return;
  }
  maybeUpdateSpectrumDisplay(time, { zero: !state.playing });
  if (
    state.lastMeterFrameTime < 0 ||
    time < state.lastMeterFrameTime ||
    time - state.lastMeterFrameTime >= quality.meterInterval
  ) {
    const meterStart = performance.now();
    refreshRealtimeMetersForMode(time);
    trackPerfSample("meterMs", performance.now() - meterStart);
    state.lastMeterFrameTime = time;
  }
  maybeUpdateSeek(time);
  if (!document.hidden && (time < state.lastWaveformDrawTime || time - state.lastWaveformDrawTime > quality.waveformInterval)) {
    const waveformStart = performance.now();
    drawWaveform(time);
    trackPerfSample("waveformMs", performance.now() - waveformStart);
    state.lastWaveformDrawTime = time;
  }
  trackPerfSample("frameMs", performance.now() - frameStart);
  updatePerfPanel(frameStart);
  state.animationId = requestAnimationFrame(tick);
}

function refreshRealtimeMetersForMode(time, options = {}) {
  if (!state.analysis) return;
  if (state.mode === "original") {
    setRealtimeMetersToZero(time);
    return;
  }
  if (!state.playing) {
    updateRealtimeDisplay(time);
    updateSoundFieldDisplay(time, readSoundFieldScores(time));
    return;
  }
  const liveScores = readLiveInstrumentScores(time);
  if (shouldUpdateStemDisplay(time, options)) {
    updateRealtimeDisplay(time, liveScores, { updateField: false });
    state.lastStemDisplayFrameTime = time;
  }
  if (shouldUpdateFieldDisplay(time, options)) {
    updateSoundFieldDisplay(time, readSoundFieldScores(time, liveScores));
    state.lastFieldDisplayFrameTime = time;
  }
}

function shouldUpdateStemDisplay(time, options = {}) {
  if (document.hidden && !options.forceDisplay) return false;
  const quality = getRuntimeQualityProfile();
  const interval = Number.isFinite(quality.stemDisplayInterval) ? quality.stemDisplayInterval : quality.meterInterval;
  return options.forceDisplay ||
    state.lastStemDisplayFrameTime < 0 ||
    time < state.lastStemDisplayFrameTime ||
    time - state.lastStemDisplayFrameTime >= interval;
}

function shouldUpdateFieldDisplay(time, options = {}) {
  if (document.hidden && !options.forceDisplay) return false;
  const quality = getRuntimeQualityProfile();
  const interval = Number.isFinite(quality.fieldDisplayInterval) ? quality.fieldDisplayInterval : quality.meterInterval;
  return options.forceDisplay ||
    state.lastFieldDisplayFrameTime < 0 ||
    time < state.lastFieldDisplayFrameTime ||
    time - state.lastFieldDisplayFrameTime >= interval;
}

function readMainAnalyserFrame(time = 0, options = {}) {
  const graph = state.graph;
  if (!graph || !graph.analyser || !graph.frequencyData || !graph.timeData || !state.audioContext) {
    return null;
  }
  const needsFrequency = options.frequency !== false;
  const needsTime = options.time !== false;
  const frameTime = Number.isFinite(time) ? time : getPlaybackTime();
  const maxAge = Number.isFinite(options.maxAge) ? options.maxAge : 0.024;
  const previous = state.lastLiveAnalysisFrame;
  const canReuse =
    !options.force &&
    previous &&
    previous.graph === graph &&
    Math.abs(frameTime - previous.time) <= maxAge;
  if (
    canReuse &&
    (!needsFrequency || previous.hasFrequency) &&
    (!needsTime || previous.hasTime)
  ) {
    return previous;
  }
  const frame = canReuse ? previous : {
    graph,
    time: frameTime,
    frequencyData: graph.frequencyData,
    timeData: graph.timeData,
    sampleRate: state.audioContext.sampleRate,
    fftSize: graph.analyser.fftSize,
    outputLevel: state.liveOutputLevel,
    quality: null,
    hasFrequency: false,
    hasTime: false
  };
  frame.time = frameTime;
  if (needsFrequency && !frame.hasFrequency) {
    graph.analyser.getFloatFrequencyData(graph.frequencyData);
    frame.hasFrequency = true;
  }
  if (needsTime && !frame.hasTime) {
    graph.analyser.getFloatTimeDomainData(graph.timeData);
    frame.outputLevel = getMeterSignalLevel(graph.timeData);
    frame.hasTime = true;
  }
  state.lastLiveAnalysisFrame = frame;
  state.liveOutputLevel = frame.outputLevel;
  return frame;
}

function readLiveInstrumentScores(time = 0) {
  const graph = state.graph;
  if (!graph || !state.audioContext) return null;
  if (graph.stemAnalysisMeters && graph.stemAnalysisMeters.byId && Object.keys(graph.stemAnalysisMeters.byId).length) {
    const stemScores = readStemAnalysisMeterScores(graph.stemAnalysisMeters, graph.previousLiveScores || {});
    readMainAnalyserFrame(time, { frequency: false });
    graph.previousLiveScores = stemScores;
    state.liveScores = stemScores;
    return stemScores;
  }
  if (!graph.analyser) return null;
  const frame = readMainAnalyserFrame(time);
  if (!frame) return null;
  if (!graph.livePowerData || graph.livePowerData.length !== frame.frequencyData.length) {
    graph.livePowerData = new Float32Array(frame.frequencyData.length);
  }
  const scores = classifyLiveInstruments(
    frame.frequencyData,
    frame.timeData,
    frame.sampleRate,
    frame.fftSize,
    graph.previousLiveScores || {},
    graph.livePowerData
  );
  const guardedScores = applyLiveInstrumentRoster(scores);
  graph.previousLiveScores = guardedScores;
  state.liveScores = guardedScores;
  return guardedScores;
}

function readStemAnalysisMeterScores(stemMeters, previousScores) {
  const scores = {};
  Object.entries(stemMeters.byId).forEach(([id, meter]) => {
    meter.analyser.getFloatTimeDomainData(meter.timeData);
    const raw = getStemMeterSignalLevel(meter.timeData);
    const shaped = shapeStemMeterLevel(raw);
    const previous = previousScores[id] || 0;
    scores[id] = shaped >= previous
      ? previous * 0.12 + shaped * 0.88
      : previous * 0.54 + shaped * 0.46;
  });
  return scores;
}

function getMeterSignalLevel(timeData) {
  let rms = 0;
  let peak = 0;
  for (let index = 0; index < timeData.length; index += 1) {
    const sample = timeData[index];
    rms += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  rms = Math.sqrt(rms / Math.max(1, timeData.length));
  const rmsDb = 20 * Math.log10(rms + 1e-7);
  const peakDb = 20 * Math.log10(peak + 1e-7);
  return clamp((rmsDb + 58) / 34 + Math.max(0, peakDb + 36) / 90, 0, 1);
}

function getStemMeterSignalLevel(timeData) {
  let rms = 0;
  let peak = 0;
  for (let index = 0; index < timeData.length; index += 1) {
    const sample = timeData[index];
    rms += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  rms = Math.sqrt(rms / Math.max(1, timeData.length));
  const rmsDb = 20 * Math.log10(rms + 1e-7);
  const peakDb = 20 * Math.log10(peak + 1e-7);
  const rmsScore = clamp((rmsDb + 58) / 44, 0, 1);
  const peakScore = clamp((peakDb + 30) / 54, 0, 1);
  return clamp(rmsScore * 0.82 + peakScore * 0.18, 0, 1);
}

function applyLiveInstrumentRoster(scores) {
  const activeIds = state.analysis && state.analysis.activeIds ? new Set(state.analysis.activeIds) : null;
  if (!activeIds || !activeIds.size) return scores;
  return Object.fromEntries(Object.entries(scores).map(([id, score]) => [
    id,
    activeIds.has(id) ? score : score * 0.04
  ]));
}

function classifyLiveInstruments(frequencyData, timeData, sampleRate, fftSize, previousScores, powerBuffer = null) {
  const features = extractLiveAudioFeatures(frequencyData, timeData, sampleRate, fftSize, powerBuffer);
  if (features.signalLevel <= 0.025) {
    return Object.fromEntries(Object.keys(LIVE_SIGNATURES).map((id) => [id, 0]));
  }

  const rawScores = {};
  Object.entries(LIVE_SIGNATURES).forEach(([id, signature]) => {
    const signatureEnergy = signature.bands.reduce((sum, [min, max, weight]) => (
      sum + getLiveBandEnergy(features, min, max) * weight
    ), 0);
    rawScores[id] = signatureEnergy * getLiveGate(signature.gate, features);
  });

  protectLiveStringStaccato(rawScores, features);
  protectLivePiano(rawScores, features);

  const maxScore = Math.max(...Object.values(rawScores), 1e-8);
  const normalized = {};
  Object.entries(rawScores).forEach(([id, score]) => {
    const relative = score / maxScore;
    const previous = previousScores[id] || 0;
    const threshold = id === "piano" || id === "harp" || id === "percussion" ? 0.13 : 0.16;
    const gated = relative < threshold ? 0 : Math.pow(relative, 0.72) * features.signalLevel;
    normalized[id] = gated >= previous
      ? previous * 0.2 + gated * 0.8
      : previous * 0.62 + gated * 0.38;
  });
  return normalized;
}

function extractLiveAudioFeatures(frequencyData, timeData, sampleRate, fftSize, powerBuffer = null) {
  const nyquist = sampleRate / 2;
  const binHz = nyquist / frequencyData.length;
  const power = powerBuffer && powerBuffer.length === frequencyData.length
    ? powerBuffer
    : new Float32Array(frequencyData.length);
  let total = 0;
  let centroidSum = 0;
  let logSum = 0;
  for (let index = 0; index < frequencyData.length; index += 1) {
    const db = Number.isFinite(frequencyData[index]) ? frequencyData[index] : -120;
    const amp = 10 ** (db / 20);
    const value = amp * amp;
    power[index] = value;
    total += value;
    centroidSum += value * index * binHz;
    logSum += Math.log(value + 1e-12);
  }

  let rms = 0;
  let peak = 0;
  let diff = 0;
  let crossings = 0;
  for (let index = 0; index < timeData.length; index += 1) {
    const sample = timeData[index];
    const abs = Math.abs(sample);
    rms += sample * sample;
    peak = Math.max(peak, abs);
    if (index > 0) {
      diff += Math.abs(sample - timeData[index - 1]);
      if ((sample >= 0) !== (timeData[index - 1] >= 0)) crossings += 1;
    }
  }
  rms = Math.sqrt(rms / Math.max(1, timeData.length));
  const crest = peak / Math.max(rms, 1e-7);
  const transient = clamp((diff / Math.max(1, timeData.length - 1)) * 18 + Math.max(0, crest - 2.6) * 0.09, 0, 1);
  const signalLevel = clamp((20 * Math.log10(rms + 1e-7) + 58) / 38, 0, 1);
  const centroid = total > 0 ? centroidSum / total : 0;
  const flatness = total > 0 ? Math.exp(logSum / frequencyData.length) / (total / frequencyData.length + 1e-12) : 1;
  const tonal = clamp(1 - flatness * 2.6, 0, 1);

  return {
    power,
    total: total + 1e-12,
    binHz,
    centroid,
    flatness,
    tonal,
    transient,
    signalLevel,
    zcr: crossings / Math.max(1, timeData.length - 1),
    bass: 0,
    lowMid: 0,
    mid: 0,
    presence: 0,
    air: 0
  };
}

function getLiveBandEnergy(features, minHz, maxHz) {
  const start = Math.max(0, Math.floor(minHz / features.binHz));
  const end = Math.min(features.power.length - 1, Math.ceil(maxHz / features.binHz));
  let sum = 0;
  for (let index = start; index <= end; index += 1) {
    sum += features.power[index];
  }
  return sum / features.total;
}

function getLiveGate(type, features) {
  const bass = getCachedLiveBand(features, "bass", 60, 250);
  const lowMid = getCachedLiveBand(features, "lowMid", 250, 700);
  const mid = getCachedLiveBand(features, "mid", 700, 1800);
  const presence = getCachedLiveBand(features, "presence", 1800, 5200);
  const air = getCachedLiveBand(features, "air", 5200, 11000);
  const tonal = features.tonal;
  const transient = features.transient;
  const sustain = clamp(1 - transient * 0.72 + tonal * 0.28, 0, 1);

  if (type === "stringHigh") return clamp((presence * 2.2 + air * 0.85 + mid * 0.55) * (0.58 + tonal * 0.6 + transient * 0.22), 0, 1.6);
  if (type === "stringMid") return clamp((mid * 1.9 + presence * 0.92 + lowMid * 0.45) * (0.62 + tonal * 0.62), 0, 1.6);
  if (type === "stringLow") return clamp((lowMid * 1.7 + mid * 0.82 + bass * 0.52) * (0.62 + tonal * 0.58), 0, 1.6);
  if (type === "woodwindHigh") return clamp((presence * 1.4 + air * 0.72 + mid * 0.48) * (0.78 + sustain * 0.42) * (1 - transient * 0.28), 0, 1.4);
  if (type === "woodwindMid") return clamp((mid * 1.35 + presence * 0.86 + lowMid * 0.28) * (0.78 + sustain * 0.42) * (1 - transient * 0.24), 0, 1.4);
  if (type === "woodwindLow") return clamp((lowMid * 1.45 + mid * 0.72 + bass * 0.32) * (0.75 + sustain * 0.42), 0, 1.4);
  if (type === "brassBright") return clamp((presence * 1.45 + mid * 0.95 + air * 0.22) * (0.62 + transient * 0.3 + tonal * 0.32), 0, 1.5);
  if (type === "brassWarm") return clamp((lowMid * 1.18 + mid * 1.05 + presence * 0.38) * (0.7 + sustain * 0.28), 0, 1.4);
  if (type === "impactLow") return clamp((bass * 2.1 + lowMid * 0.55) * (0.52 + transient * 1.15), 0, 1.7);
  if (type === "impactHigh") return clamp((presence * 0.62 + air * 1.65) * (0.46 + transient * 1.25) * (1 - tonal * 0.24), 0, 1.7);
  if (type === "pluck") return clamp((presence * 1.05 + air * 0.95 + mid * 0.44) * (0.42 + transient * 1.05) * tonal * (1 - lowMid * 0.35), 0, 1.5);
  if (type === "piano") return clamp((bass * 0.75 + lowMid * 1.15 + mid * 1.0 + presence * 0.65 + air * 0.18) * (0.5 + transient * 0.75) * (0.62 + tonal * 0.32), 0, 1.8);
  if (type === "low") return clamp((bass * 1.9 + lowMid * 0.5) * (0.65 + sustain * 0.35), 0, 1.4);
  return 1;
}

function getCachedLiveBand(features, key, minHz, maxHz) {
  if (!features[key]) {
    features[key] = getLiveBandEnergy(features, minHz, maxHz);
  }
  return features[key];
}

function protectLiveStringStaccato(scores, features) {
  const stringMax = Math.max(scores.violins1 || 0, scores.violins2 || 0, scores.violas || 0, scores.cellos || 0);
  const stringEvidence = stringMax * (0.72 + features.tonal * 0.58 + features.transient * 0.24);
  if (stringEvidence > Math.max(scores.harp || 0, scores.piano || 0) * 0.78 && features.centroid > 850) {
    scores.harp *= 0.34;
    scores.piano *= features.transient > 0.62 ? 0.66 : 0.82;
    scores.violins1 *= 1.12;
    scores.violins2 *= 1.1;
    scores.violas *= 1.04;
  }
}

function protectLivePiano(scores, features) {
  const piano = scores.piano || 0;
  const stringMax = Math.max(scores.violins1 || 0, scores.violins2 || 0, scores.violas || 0);
  const lowCoverage = getCachedLiveBand(features, "bass", 60, 250) + getCachedLiveBand(features, "lowMid", 250, 700);
  if (piano > stringMax * 0.72 && lowCoverage > 0.14 && features.transient > 0.18) {
    scores.harp *= 0.58;
    scores.violins1 *= 0.72;
    scores.violins2 *= 0.76;
    scores.violas *= 0.82;
  }
}

function updateRealtimeDisplay(time, liveScores = null, options = {}) {
  if (!state.analysis) return;
  state.metersZeroed = false;
  const updateField = options.updateField !== false;
  setText(refs.frameTime, formatTime(time));
  getDisplayObjects(state.analysis).forEach((object) => {
    const liveLevel = liveScores ? (liveScores[object.id] || 0) : null;
    const rawLevel = getObjectDisplayLevel(object, time, liveLevel);
    const previous = state.meterLevels[object.id] || 0;
    const level = rawLevel >= previous
      ? previous * 0.18 + rawLevel * 0.82
      : previous * 0.58 + rawLevel * 0.42;
    state.meterLevels[object.id] = level;
    const meterRef = state.meterRows[object.id];
    if (meterRef) {
      const { row, value, cache } = meterRef;
      const visualLevel = clamp(level, 0, 1);
      if (Math.abs(visualLevel - cache.level) > METER_STYLE_EPSILON || (visualLevel === 0 && cache.level !== 0)) {
        cache.level = visualLevel;
        setStyleProperty(row, "--level", visualLevel.toFixed(2));
      }
      const sounding = visualLevel > 0.055;
      const live = liveLevel !== null && liveLevel > 0.12;
      const inactive = !object.active && visualLevel <= 0.055;
      if (cache.sounding !== sounding) {
        cache.sounding = sounding;
        toggleClass(row, "is-sounding", sounding);
      }
      if (cache.live !== live) {
        cache.live = live;
        toggleClass(row, "is-live-detected", live);
      }
      if (cache.inactive !== inactive) {
        cache.inactive = inactive;
        toggleClass(row, "is-inactive", inactive);
      }
      const percent = Math.round(visualLevel * 100);
      if (cache.percent !== percent) {
        cache.percent = percent;
        setText(value, `${percent}%`);
      }
    }
    if (updateField) {
      const previousField = state.fieldLevels[object.id] || 0;
      const fieldLevel = rawLevel >= previousField
        ? previousField * 0.16 + rawLevel * 0.84
        : previousField * 0.62 + rawLevel * 0.38;
      state.fieldLevels[object.id] = fieldLevel;
      updateFieldNodes(state.fieldNodeGroups[object.id] || [], object, fieldLevel, liveLevel, time);
    }
  });
}

function readSoundFieldScores(time = 0, liveScores = null) {
  if (!state.analysis || !state.graph) return null;
  if (state.mode === "original") {
    return Object.fromEntries(getDisplayObjects(state.analysis).map((object) => [object.id, 0]));
  }
  const frame = readMainAnalyserFrame(time, { frequency: false, maxAge: 0.08 });
  const globalLevel = frame ? frame.outputLevel : state.liveOutputLevel;
  const scoreSource = liveScores || state.liveScores || {};
  const objects = getDisplayObjects(state.analysis);
  const scores = {};
  objects.forEach((object, index) => {
    const hasLiveStemScore = object.kind === "stem" &&
      Object.prototype.hasOwnProperty.call(scoreSource, object.id);
    const liveStemLevel = hasLiveStemScore
      ? shapeStemDisplayLevel(scoreSource[object.id] || 0)
      : null;
    const timeline = object.kind === "stem"
      ? (liveStemLevel === null ? getStemFieldWeight(object) : liveStemLevel)
      : getInstrumentLevelFromCurve(object.displayCurve || object.curve, time);
    const activity = object.active ? 1 : 0.45;
    const drift = 0.9 + getFieldDrift(object.id, index, time) * 0.16;
    const depthLift = clamp((Math.abs(object.position.x) * 0.08) + (Math.abs(object.position.z) * 0.035), 0, 0.22);
    const stemGate = hasLiveStemScore
      ? clamp((timeline - 0.022) / 0.2, 0, 1)
      : 1;
    scores[object.id] = clamp(globalLevel * (0.52 + timeline * 0.58 + depthLift) * activity * drift * stemGate, 0, 1);
  });
  return scores;
}

function updateSoundFieldDisplay(time, fieldScores = null) {
  if (!state.analysis) return;
  state.metersZeroed = false;
  setText(refs.frameTime, formatTime(time));
  getDisplayObjects(state.analysis).forEach((object) => {
    const rawLevel = fieldScores ? (fieldScores[object.id] || 0) : 0;
    const previous = state.fieldLevels[object.id] || 0;
    const level = rawLevel >= previous
      ? previous * 0.14 + rawLevel * 0.86
      : previous * 0.64 + rawLevel * 0.36;
    state.fieldLevels[object.id] = level;
    updateFieldNodes(state.fieldNodeGroups[object.id] || [], object, level, level, time);
  });
}

function maybeUpdateSpectrumDisplay(time = 0, options = {}) {
  if (document.hidden && !options.force) return;
  const quality = getRuntimeQualityProfile();
  const interval = Number.isFinite(quality.spectrumInterval) ? quality.spectrumInterval : quality.meterInterval;
  if (
    options.force ||
    state.lastSpectrumFrameTime < 0 ||
    time < state.lastSpectrumFrameTime ||
    time - state.lastSpectrumFrameTime >= interval
  ) {
    const spectrumStart = performance.now();
    updateSpectrumDisplay(time, options);
    trackPerfSample("spectrumMs", performance.now() - spectrumStart);
    state.lastSpectrumFrameTime = time;
  }
}

function updateSpectrumDisplay(time = 0, options = {}) {
  if (!refs.spectrumCanvas) return;
  const hasLiveAnalyser = state.playing &&
    !options.zero &&
    state.graph &&
    state.graph.analyser &&
    state.graph.frequencyData &&
    state.audioContext;
  const nextLevels = hasLiveAnalyser
    ? readLiveSpectrumLevels()
    : state.spectrumLevels.map((level) => level * 0.72);
  state.spectrumLevels = nextLevels;
  state.spectrumPeaks = updateSpectrumPeaks(nextLevels, state.spectrumPeaks, hasLiveAnalyser);
  drawSpectrumGraph(nextLevels, { time, peaks: state.spectrumPeaks, zero: !hasLiveAnalyser || options.zero, force: options.force });
  setText(refs.spectrumStatus, hasLiveAnalyser ? `Live 24 bands · ${getSpectrumTargetFps()} fps` : "Low-load analyser");
}

function getSpectrumTargetFps() {
  const quality = getRuntimeQualityProfile();
  const interval = Number.isFinite(quality.spectrumInterval) ? quality.spectrumInterval : 1 / 30;
  return Math.round(1 / interval);
}

function updateSpectrumPeaks(levels, previousPeaks = [], active = false) {
  return levels.map((level, index) => {
    const previous = previousPeaks[index] || 0;
    if (!active) return previous * 0.66;
    return level >= previous ? level : Math.max(level, previous - 0.026);
  });
}

function readLiveSpectrumLevels() {
  const graph = state.graph;
  if (!graph || !graph.analyser || !graph.frequencyData || !state.audioContext) {
    return state.spectrumLevels;
  }
  const frame = readMainAnalyserFrame(getPlaybackTime(), { time: false, maxAge: 0.08 });
  if (!frame) return state.spectrumLevels;
  return buildSpectrumLevels(
    frame.frequencyData,
    frame.sampleRate,
    state.spectrumLevels
  );
}

function buildSpectrumLevels(frequencyData, sampleRate, previousLevels = []) {
  if (!frequencyData || !frequencyData.length || !sampleRate) {
    return Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0);
  }
  const ranges = getSpectrumRanges(frequencyData.length, sampleRate);
  const next = new Array(SPECTRUM_BAR_COUNT).fill(0);
  const lowBandLimit = Math.max(1, Math.round(SPECTRUM_BAR_COUNT * 0.145));
  const highBandStart = Math.round(SPECTRUM_BAR_COUNT * 0.708);

  for (let band = 0; band < SPECTRUM_BAR_COUNT; band += 1) {
    const [start, end] = ranges[band];
    let sum = 0;
    let peak = 0;
    for (let index = start; index < end; index += 1) {
      const db = Number.isFinite(frequencyData[index]) ? frequencyData[index] : -120;
      const normalized = clamp((db + 94) / 78, 0, 1);
      const energy = normalized * normalized;
      sum += energy;
      if (energy > peak) peak = energy;
    }
    const average = sum / Math.max(1, end - start);
    const lowCompensation = band < lowBandLimit ? 0.86 + (band / lowBandLimit) * 0.14 : 1;
    const highAirLift = band > highBandStart ? 1 + ((band - highBandStart) / Math.max(1, SPECTRUM_BAR_COUNT - highBandStart)) * 0.14 : 1;
    const raw = clamp((average * 0.48 + peak * 0.52) * lowCompensation * highAirLift, 0, 1);
    const shaped = Math.pow(raw, 0.68);
    const previous = previousLevels[band] || 0;
    next[band] = shaped >= previous
      ? previous * 0.14 + shaped * 0.86
      : previous * 0.68 + shaped * 0.32;
  }

  return next;
}

function getSpectrumRanges(binCount, sampleRate) {
  const key = `${binCount}:${sampleRate}:${SPECTRUM_BAR_COUNT}`;
  if (state.spectrumRanges && state.spectrumRangeKey === key) return state.spectrumRanges;

  const binHz = (sampleRate / 2) / binCount;
  const minHz = 20;
  const maxHz = Math.min(20000, sampleRate / 2);
  const ratio = maxHz / minHz;
  state.spectrumRanges = Array.from({ length: SPECTRUM_BAR_COUNT }, (_, band) => {
    const startHz = minHz * Math.pow(ratio, band / SPECTRUM_BAR_COUNT);
    const endHz = minHz * Math.pow(ratio, (band + 1) / SPECTRUM_BAR_COUNT);
    const start = clamp(Math.floor(startHz / binHz), 0, binCount - 1);
    const end = clamp(Math.max(start + 1, Math.ceil(endHz / binHz)), start + 1, binCount);
    return [start, end, startHz, endHz];
  });
  state.spectrumRangeKey = key;
  return state.spectrumRanges;
}

function getSpectrumContext(canvas) {
  if (!state.spectrumContext) {
    state.spectrumContext = canvas.getContext("2d");
  }
  return state.spectrumContext;
}

function drawSpectrumGraph(levels = state.spectrumLevels, options = {}) {
  const canvas = refs.spectrumCanvas;
  if (!canvas) return;
  const ctx = getSpectrumContext(canvas);
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  const resized = canvas.width !== width || canvas.height !== height || state.spectrumCache.dpr !== dpr;
  if (resized) {
    canvas.width = width;
    canvas.height = height;
    state.spectrumCache.width = width;
    state.spectrumCache.height = height;
    state.spectrumCache.dpr = dpr;
    state.spectrumCache.backgroundKey = "";
    state.spectrumCache.gradientKey = "";
  }

  drawSpectrumBackground(ctx, width, height, dpr);

  const paddingX = Math.max(18 * dpr, width * 0.018);
  const top = 22 * dpr;
  const bottom = 44 * dpr;
  const graphHeight = Math.max(1, height - top - bottom);
  const barGap = Math.max(3 * dpr, width * 0.004);
  const barWidth = Math.max(2 * dpr, (width - paddingX * 2) / SPECTRUM_BAR_COUNT - barGap);
  const barGradient = getSpectrumGradient(ctx, height);
  ctx.fillStyle = barGradient;
  ctx.shadowBlur = 0;

  let energy = 0;
  const peaks = Array.isArray(options.peaks) ? options.peaks : [];
  levels.forEach((level, index) => {
    const visual = clamp(level, 0, 1);
    energy += visual;
    const x = paddingX + index * (barWidth + barGap);
    const barHeight = Math.max(2 * dpr, graphHeight * visual);
    const y = top + graphHeight - barHeight;
    ctx.fillRect(x, y, barWidth, barHeight);
    const peak = clamp(peaks[index] || 0, 0, 1);
    if (peak > 0.02) {
      const peakY = top + graphHeight - graphHeight * peak;
      ctx.fillStyle = cssColor("--gold", "#d7b56d");
      ctx.fillRect(x, peakY, barWidth, Math.max(2 * dpr, 2));
      ctx.fillStyle = barGradient;
    }
  });

  ctx.shadowBlur = 0;
  const average = levels.length ? energy / levels.length : 0;
  drawSpectrumEnergyLine(ctx, levels, {
    width,
    height,
    paddingX,
    top,
    graphHeight,
    time: options.time || 0,
    energy: average,
    dpr
  });
}

function drawSpectrumBackground(ctx, width, height, dpr) {
  const theme = document.documentElement.dataset.theme || "light";
  const key = `${width}:${height}:${dpr}:${theme}`;
  if (!state.spectrumCache.backgroundCanvas || state.spectrumCache.backgroundKey !== key) {
    const background = document.createElement("canvas");
    background.width = width;
    background.height = height;
    const bg = background.getContext("2d");
    drawSpectrumBackgroundLayer(bg, width, height, dpr);
    state.spectrumCache.backgroundKey = key;
    state.spectrumCache.backgroundCanvas = background;
  }
  ctx.drawImage(state.spectrumCache.backgroundCanvas, 0, 0);
}

function drawSpectrumBackgroundLayer(ctx, width, height, dpr) {
  ctx.fillStyle = cssColor("--canvas-bg", "rgba(238,244,240,0.78)");
  ctx.fillRect(0, 0, width, height);

  const zones = [
    [0, 0.22, "--green"],
    [0.22, 0.46, "--blue"],
    [0.46, 0.74, "--coral"],
    [0.74, 1, "--gold"]
  ];
  zones.forEach(([start, end, color]) => {
    ctx.globalAlpha = 0.085;
    ctx.fillStyle = cssColor(color, "rgba(81,127,150,0.18)");
    ctx.fillRect(width * start, 0, width * (end - start), height);
  });
  ctx.globalAlpha = 1;

  ctx.strokeStyle = cssColor("--line", "rgba(32,41,51,0.14)");
  ctx.lineWidth = Math.max(1, dpr);
  for (let index = 1; index <= 3; index += 1) {
    const y = (height * index) / 4;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.moveTo(18 * dpr, y);
    ctx.lineTo(width - 18 * dpr, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSpectrumEnergyLine(ctx, levels, layout) {
  if (!levels.length) return;
  const { width, paddingX, top, graphHeight, energy, dpr } = layout;
  const step = (width - paddingX * 2) / Math.max(1, levels.length - 1);
  ctx.beginPath();
  levels.forEach((level, index) => {
    const x = paddingX + index * step;
    const y = top + graphHeight - graphHeight * clamp(level * 0.92, 0, 1);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = cssColor("--gold", "#d7b56d");
  ctx.lineWidth = Math.max(1.2 * dpr, 1);
  ctx.globalAlpha = clamp(0.18 + energy * 0.34, 0.18, 0.52);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function getSpectrumGradient(ctx, height) {
  const theme = document.documentElement.dataset.theme || "light";
  const key = `${height}:${theme}`;
  if (state.spectrumCache.gradientKey !== key) {
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, cssColor("--green", "#687f5b"));
    gradient.addColorStop(0.42, cssColor("--blue", "#517f96"));
    gradient.addColorStop(0.76, cssColor("--coral", "#c86f5a"));
    gradient.addColorStop(1, cssColor("--gold", "#d7b56d"));
    state.spectrumCache.gradientKey = key;
    state.spectrumCache.gradient = gradient;
  }
  return state.spectrumCache.gradient;
}

function updateFieldNodes(nodes, object, level, liveLevel, time) {
  nodes.forEach((node) => {
    if (!node._fieldNode) {
      node._fieldNode = {
        level: -1,
        sounding: null,
        live: null,
        inactive: null,
        left: null,
        top: null
      };
    }
    const cached = node._fieldNode;
    const visualLevel = clamp(level, 0, 1);
    if (Math.abs(visualLevel - cached.level) > 0.01) {
      cached.level = visualLevel;
      setStyleProperty(node, "--level", visualLevel.toFixed(2));
    }
    const sounding = visualLevel > 0.045;
    const live = liveLevel !== null && liveLevel > 0.12;
    const inactive = !object.active && visualLevel <= 0.055;
    if (cached.sounding !== sounding) {
      cached.sounding = sounding;
      node.classList.toggle("is-sounding", sounding);
    }
    if (cached.live !== live) {
      cached.live = live;
      node.classList.toggle("is-live-detected", live);
    }
    if (cached.inactive !== inactive) {
      cached.inactive = inactive;
      node.classList.toggle("is-inactive", inactive);
    }
  });
}

function getStemFieldWeight(stem) {
  if (stem.id === "vocals") return 0.9;
  if (stem.id === "other") return 0.82;
  if (stem.id === "drums") return 0.72;
  if (stem.id === "bass") return 0.52;
  return 0.7;
}

function getFieldDrift(id, index, time) {
  const seed = getFieldDriftSeed(id);
  return Math.sin(time * (0.82 + index * 0.06) + seed * 0.13) * 0.5 + 0.5;
}

function getFieldDriftSeed(id) {
  if (Number.isFinite(state.fieldDriftSeeds[id])) {
    return state.fieldDriftSeeds[id];
  }
  let seed = 0;
  for (let index = 0; index < id.length; index += 1) {
    seed += id.charCodeAt(index);
  }
  state.fieldDriftSeeds[id] = seed;
  return seed;
}

function setRealtimeMetersToZero(time = 0) {
  if (!state.analysis) return;
  state.liveScores = {};
  setText(refs.frameTime, formatTime(time));
  if (state.metersZeroed) return;
  getDisplayObjects(state.analysis).forEach((object) => {
    state.meterLevels[object.id] = 0;
    const meterRef = state.meterRows[object.id];
    const nodes = state.fieldNodeGroups[object.id] || [];
    if (meterRef) {
      const { row, value, cache } = meterRef;
      setStyleProperty(row, "--level", "0");
      toggleClass(row, "is-sounding", false);
      toggleClass(row, "is-live-detected", false);
      toggleClass(row, "is-inactive", !object.active);
      setText(value, "0%");
      if (cache) {
        cache.level = 0;
        cache.percent = 0;
        cache.sounding = false;
        cache.live = false;
        cache.inactive = !object.active;
      }
    }
    state.fieldLevels[object.id] = 0;
    nodes.forEach((node) => {
      setStyleProperty(node, "--level", "0");
      if (node._fieldNode) {
        node._fieldNode.level = 0;
        node._fieldNode.sounding = false;
        node._fieldNode.live = false;
        node._fieldNode.inactive = !object.active;
      }
      toggleClass(node, "is-sounding", false);
      toggleClass(node, "is-live-detected", false);
      toggleClass(node, "is-inactive", !object.active);
    });
  });
  state.metersZeroed = true;
}

function getObjectDisplayLevel(object, time, liveLevel = null) {
  if (object.kind === "stem") {
    return liveLevel === null ? 0 : softenStemBarLevel(liveLevel);
  }
  return getInstrumentDisplayLevel(object, time, liveLevel);
}

function shapeStemDisplayLevel(level) {
  const gated = clamp((level - 0.018) / 0.982, 0, 1);
  if (gated <= 0) return 0;
  const normalized = (1 - Math.exp(-3.1 * gated)) / (1 - Math.exp(-3.1));
  const steady = normalized * 0.9;
  const peakLift = Math.pow(gated, 10) * 0.1;
  return clamp(steady + peakLift, 0, 1);
}

function shapeStemMeterLevel(level) {
  const gated = clamp(level, 0, 1);
  if (gated <= 0) return 0;
  return clamp(Math.pow(gated, 0.92), 0, 1);
}

function softenStemBarLevel(level) {
  const gated = clamp(level, 0, 1);
  if (gated <= 0) return 0;
  const normal = STEM_BAR_NORMAL_CEILING *
    (1 - Math.exp(-STEM_BAR_RESPONSE_CURVE * gated)) /
    (1 - Math.exp(-STEM_BAR_RESPONSE_CURVE));
  const peakRatio = clamp((gated - STEM_BAR_PEAK_GATE) / (1 - STEM_BAR_PEAK_GATE), 0, 1);
  const peak = Math.pow(peakRatio, STEM_BAR_PEAK_EXPONENT) * (1 - normal);
  return clamp(normal + peak, 0, 1);
}

function getInstrumentDisplayLevel(instrument, time, liveLevel = null) {
  const timelineLevel = getInstrumentLevelFromCurve(instrument.displayCurve || instrument.curve, time);
  if (state.playing && liveLevel !== null) {
    if (!instrument.active) return clamp(liveLevel, 0, 1);
    return clamp(liveLevel * 0.88 + timelineLevel * 0.12, 0, 1);
  }
  return timelineLevel;
}

function getInstrumentLevelFromCurve(curve, time) {
  if (!state.analysis || !curve.length) return 0;
  const duration = state.analysis.file.duration || 1;
  const ratio = clamp(time / duration, 0, 1);
  const indexFloat = ratio * (curve.length - 1);
  const index = Math.floor(indexFloat);
  const next = Math.min(curve.length - 1, index + 1);
  const mix = indexFloat - index;
  return clamp(curve[index] * (1 - mix) + curve[next] * mix, 0, 1);
}

function seekToSlider() {
  if (!state.analysis) return;
  const duration = state.analysis.file.duration;
  const nextTime = (Number(refs.seekSlider.value) / 1000) * duration;
  state.offset = nextTime;
  if (state.playing) {
    stopPlayback({ keepOffset: true, silent: true });
    state.offset = nextTime;
    startPlayback();
  } else {
    if (state.mode === "original") {
      setRealtimeMetersToZero(nextTime);
    } else {
      updateRealtimeDisplay(nextTime);
      updateSoundFieldDisplay(nextTime, readSoundFieldScores(nextTime));
    }
    updateSpectrumDisplay(nextTime, { zero: true });
    drawWaveform(nextTime);
    updateSeek(nextTime, { force: true });
  }
}

function getPlaybackTime() {
  if (!state.playing || !state.audioContext) return state.offset;
  return clamp(state.audioContext.currentTime - state.startedAt, 0, state.audioBuffer ? state.audioBuffer.duration : 0);
}

function maybeUpdateSeek(time, options = {}) {
  if (document.hidden && !options.force) return;
  const quality = getRuntimeQualityProfile();
  const interval = Number.isFinite(quality.seekInterval) ? quality.seekInterval : 1 / 12;
  if (
    options.force ||
    state.lastSeekFrameTime < 0 ||
    time < state.lastSeekFrameTime ||
    time - state.lastSeekFrameTime >= interval
  ) {
    updateSeek(time, { force: true });
  }
}

function updateSeek(time, options = {}) {
  const duration = state.analysis ? state.analysis.file.duration : 0;
  setText(refs.currentTime, formatTime(time));
  setText(refs.totalTime, formatTime(duration));
  const sliderValue = String(duration ? Math.round((time / duration) * 1000) : 0);
  if (refs.seekSlider.value !== sliderValue) {
    refs.seekSlider.value = sliderValue;
  }
  if (options.force !== false) {
    state.lastSeekFrameTime = time;
  }
}

function drawWaveform(currentTime = 0) {
  const canvas = refs.waveformCanvas;
  const ctx = getWaveformContext(canvas);
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  const resized = canvas.width !== width || canvas.height !== height || state.waveformCache.dpr !== dpr;
  if (resized) {
    canvas.width = width;
    canvas.height = height;
    state.waveformCache.width = width;
    state.waveformCache.height = height;
    state.waveformCache.dpr = dpr;
    state.waveformCache.backgroundKey = "";
    state.waveformCache.barsKey = "";
    state.waveformCache.gradientKey = "";
  }

  if (!state.analysis || !state.analysis.waveform.length) {
    drawEmptyWaveform(ctx, width, height, dpr);
    return;
  }

  ctx.drawImage(getWaveformBaseCanvas(width, height, dpr), 0, 0);

  const cursor = state.analysis.file.duration ? (currentTime / state.analysis.file.duration) * width : 0;
  ctx.fillStyle = cssColor("--ink", "rgba(32,41,51,0.82)");
  ctx.fillRect(cursor, 0, Math.max(2, dpr * 2), height);
}

function getWaveformContext(canvas) {
  if (!state.waveformContext) {
    state.waveformContext = canvas.getContext("2d");
  }
  return state.waveformContext;
}

function resetWaveformCache() {
  state.waveformCache.backgroundKey = "";
  state.waveformCache.backgroundCanvas = null;
  state.waveformCache.barsKey = "";
  state.waveformCache.bars = [];
  state.waveformCache.gradientKey = "";
  state.waveformCache.gradient = null;
}

function getWaveformBaseCanvas(width, height, dpr) {
  const values = state.analysis?.waveform || [];
  const theme = document.documentElement.dataset.theme || "light";
  const key = `${width}:${height}:${dpr}:${theme}:${values.length}`;
  if (!state.waveformCache.backgroundCanvas || state.waveformCache.backgroundKey !== key) {
    const background = document.createElement("canvas");
    background.width = width;
    background.height = height;
    const context = background.getContext("2d");
    drawWaveformBaseLayer(context, width, height, values);
    state.waveformCache.backgroundKey = key;
    state.waveformCache.backgroundCanvas = background;
  }
  return state.waveformCache.backgroundCanvas;
}

function drawWaveformBaseLayer(ctx, width, height, values) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = cssColor("--canvas-bg", "rgba(238,244,240,0.78)");
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = getWaveformGradient(ctx, width);
  getWaveformBars(values, width, height).forEach((bar) => {
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
  });
}

function getWaveformGradient(ctx, width) {
  const theme = document.documentElement.dataset.theme || "light";
  const key = `${width}:${theme}`;
  if (state.waveformCache.gradientKey !== key) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, cssColor("--green", "#687f5b"));
    gradient.addColorStop(0.48, cssColor("--blue", "#517f96"));
    gradient.addColorStop(1, cssColor("--coral", "#c86f5a"));
    state.waveformCache.gradientKey = key;
    state.waveformCache.gradient = gradient;
  }
  return state.waveformCache.gradient;
}

function getWaveformBars(values, width, height) {
  const key = `${width}:${height}:${values.length}`;
  if (state.waveformCache.barsKey === key) {
    return state.waveformCache.bars;
  }
  const mid = height * 0.5;
  const maxAmp = height * 0.42;
  const barWidth = Math.max(1, width / Math.max(1, values.length));
  state.waveformCache.bars = values.map((value, index) => {
    const h = Math.max(1, value * maxAmp);
    return {
      x: (index / values.length) * width,
      y: mid - h,
      width: barWidth,
      height: h * 2
    };
  });
  state.waveformCache.barsKey = key;
  return state.waveformCache.bars;
}

function drawEmptyWaveform(ctx = null, width = 0, height = 0, dpr = window.devicePixelRatio || 1) {
  const canvas = refs.waveformCanvas;
  const context = ctx || getWaveformContext(canvas);
  let canvasWidth = width;
  let canvasHeight = height;
  if (!canvasWidth || !canvasHeight) {
    const rect = canvas.getBoundingClientRect();
    canvasWidth = Math.max(1, Math.floor(rect.width * dpr));
    canvasHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
  }
  context.fillStyle = cssColor("--canvas-bg", "rgba(238,244,240,0.78)");
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = cssColor("--line", "rgba(32,41,51,0.18)");
  context.fillRect(0, canvasHeight / 2, canvasWidth, Math.max(1, dpr));
}

function resetApp() {
  stopPlayback();
  state.file = null;
  state.analysis = null;
  state.audioBuffer = null;
  state.stemBuffers = null;
  state.displayObjects = null;
  state.meterLevels = {};
  state.metersZeroed = false;
  state.fieldLevels = {};
  state.fieldNodeGroups = {};
  state.fieldDriftSeeds = {};
  resetSpectrumState();
  state.stemPositionCache = {};
  state.stemDisplayPositions = {};
  state.meterRows = {};
  resetWaveformCache();
  state.lastWaveformDrawTime = -1;
  state.lastMeterFrameTime = -1;
  state.lastStemDisplayFrameTime = -1;
  state.lastFieldDisplayFrameTime = -1;
  state.lastSpectrumFrameTime = -1;
  state.lastSeekFrameTime = -1;
  state.lastVisualFrameAt = 0;
  resetLiveAnalysisCache();
  resetRuntimeQualityState();
  state.liveScores = {};
  state.spatialSettings = { ...SPATIAL_ENGINE_DEFAULTS };
  state.spatialAnalysisSummary = { openness: 0, dynamics: 0, density: 0 };
  refs.fileInput.value = "";
  syncFieldModeState();
  updateSpatialControlUi();
  refs.trackKicker.textContent = "READY";
  refs.trackName.textContent = "파일을 선택하세요";
  refs.trackSubtitle.textContent = "로컬 백엔드에서 분석하고 브라우저에서는 원본 출력 기준선을 유지합니다.";
  refs.playButton.disabled = true;
  refs.stopButton.disabled = true;
  refs.seekSlider.disabled = true;
  refs.instrumentList.innerHTML = "";
  refs.stageMap.innerHTML = "";
  if (refs.spectrumStatus) refs.spectrumStatus.textContent = "Live analyser";
  refs.modelStack.innerHTML = "";
  refs.sectionList.innerHTML = "";
  refs.activeCount.textContent = "0 active";
  refs.modelTag.textContent = "대기";
  refs.waveformTag.textContent = "대기";
  refs.currentTime.textContent = "0:00";
  refs.totalTime.textContent = "0:00";
  Object.values(refs.metrics).forEach((metric) => {
    metric.textContent = metric.tagName === "STRONG" ? "--" : "";
  });
  document.body.classList.remove("has-analysis", "is-busy");
  drawEmptyWaveform();
  drawSpectrumGraph(state.spectrumLevels, { zero: true, force: true });
  setBusy(false, "분석 대기 중");
}

function applyStoredTheme() {
  const saved = localStorage.getItem("spatial-audio-new-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("spatial-audio-new-theme", next);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  refs.themeToggle.setAttribute("aria-pressed", String(isDark));
  refs.themeToggle.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  refs.themeToggleText.textContent = isDark ? "Light" : "Dark";
  state.spectrumCache.backgroundKey = "";
  state.spectrumCache.gradientKey = "";
  drawWaveform(getPlaybackTime());
  drawSpectrumGraph(state.spectrumLevels, { time: getPlaybackTime(), zero: !state.playing, force: true });
}

function setBusy(isBusy, text) {
  document.body.classList.toggle("is-busy", isBusy);
  refs.statusText.textContent = text;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => refs.toast.classList.remove("is-visible"), 2800);
}

function setPerfPanelEnabled(enabled) {
  state.perf.enabled = Boolean(enabled);
  refs.perfPanel.hidden = !state.perf.enabled;
  refs.perfToggle.classList.toggle("is-active", state.perf.enabled);
  refs.perfToggle.setAttribute("aria-expanded", String(state.perf.enabled));
  refs.perfToggle.setAttribute("aria-label", state.perf.enabled ? "성능 패널 닫기" : "성능 패널 열기");
  if (state.perf.enabled) {
    updatePerfPanel(performance.now(), { force: true });
  }
}

function trackFrameTiming(now) {
  if (!state.perf.lastFrameAt) {
    state.perf.lastFrameAt = now;
    return;
  }
  const delta = now - state.perf.lastFrameAt;
  state.perf.lastFrameAt = now;
  if (delta > 42) state.perf.droppedFrames += 1;
  const instantFps = delta > 0 ? 1000 / delta : 0;
  state.perf.fps = state.perf.fps
    ? state.perf.fps * 0.86 + instantFps * 0.14
    : instantFps;
}

function trackPerfSample(key, value) {
  if (!Number.isFinite(value)) return;
  const samples = state.perf[key];
  if (!Array.isArray(samples)) return;
  samples.push(value);
  if (samples.length > 80) samples.shift();
}

function averagePerfSample(key) {
  const samples = state.perf[key];
  if (!Array.isArray(samples) || !samples.length) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function updatePerfPanel(now = performance.now(), options = {}) {
  if (!state.perf.enabled) return;
  if (!options.force && now - state.perf.lastPanelAt < 500) return;
  state.perf.lastPanelAt = now;
  setText(refs.perf.fps, state.perf.fps ? `${Math.round(state.perf.fps)} fps` : "--");
  setText(refs.perf.frame, `${averagePerfSample("frameMs").toFixed(1)} ms`);
  setText(refs.perf.meter, `${averagePerfSample("meterMs").toFixed(1)} ms`);
  setText(refs.perf.waveform, `${averagePerfSample("waveformMs").toFixed(1)} ms`);
  setText(refs.perf.nodes, `${formatNumber(getLiveNodeCount())} · ${getRuntimeQualityProfile().label}`);
  setText(refs.perf.heap, getHeapLabel());
}

function getLiveNodeCount() {
  if (!state.graph) return 0;
  const graphNodes = Array.isArray(state.graph.nodes) ? state.graph.nodes.length : 0;
  const retiredNodes = state.retiredGraphs.reduce((sum, item) => {
    return sum + (Array.isArray(item.graph?.nodes) ? item.graph.nodes.length : 0);
  }, 0);
  return graphNodes + retiredNodes;
}

function getHeapLabel() {
  const memory = performance.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return "--";
  return formatBytes(memory.usedJSHeapSize);
}

function scheduleWaveformDraw() {
  if (state.resizeFrame) return;
  state.resizeFrame = requestAnimationFrame(() => {
    state.resizeFrame = 0;
    drawWaveform(getPlaybackTime());
    drawSpectrumGraph(state.spectrumLevels, { time: getPlaybackTime(), zero: !state.playing, force: true });
  });
}

window.addEventListener("resize", scheduleWaveformDraw);
