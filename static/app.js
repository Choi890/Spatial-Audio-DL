const $ = (selector) => document.querySelector(selector);

const refs = {
  fileInput: $("#audio-file"),
  dropZone: $("#drop-zone"),
  resetButton: $("#reset-button"),
  themeToggle: $("#theme-toggle"),
  themeToggleText: $("#theme-toggle-text"),
  remasterToggle: $("#remaster-toggle"),
  concertHallToggle: $("#concert-hall-toggle"),
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
  sliders: {
    width: $("#width-slider"),
    depth: $("#depth-slider"),
    room: $("#room-slider"),
    gain: $("#gain-slider"),
    remasterAmount: $("#remaster-amount-slider"),
    remasterTone: $("#remaster-tone-slider"),
    remasterClarity: $("#remaster-clarity-slider"),
    remasterHeadroom: $("#remaster-headroom-slider")
  },
  sliderValues: {
    width: $("#width-value"),
    depth: $("#depth-value"),
    room: $("#room-value"),
    gain: $("#gain-value"),
    remaster: $("#remaster-value"),
    concertHall: $("#concert-hall-value"),
    remasterAmount: $("#remaster-amount-value"),
    remasterTone: $("#remaster-tone-value"),
    remasterClarity: $("#remaster-clarity-value"),
    remasterHeadroom: $("#remaster-headroom-value")
  },
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
  instrumentList: $("#instrument-list"),
  waveformCanvas: $("#waveform-canvas"),
  waveformTag: $("#waveform-tag"),
  remasterTag: $("#remaster-tag"),
  remasterGrid: $("#remaster-grid"),
  modelTag: $("#model-tag"),
  modelStack: $("#model-stack"),
  sectionList: $("#section-list")
};

const state = {
  file: null,
  analysis: null,
  audioContext: null,
  audioBuffer: null,
  stemBuffers: null,
  graph: null,
  mode: "spatial",
  playing: false,
  startedAt: 0,
  offset: 0,
  animationId: 0,
  meterLevels: {},
  liveScores: {},
  autoRemasterValues: {
    width: 1.45,
    depth: 1.62,
    remasterAmount: 0.82,
    remasterTone: 0,
    remasterClarity: 0.64,
    remasterHeadroom: 0.62
  },
  settings: {
    width: 1.45,
    depth: 1.62,
    room: 0.58,
    gain: 1,
    remaster: true,
    concertHall: false,
    remasterAmount: 0.82,
    remasterTone: 0,
    remasterClarity: 0.64,
    remasterHeadroom: 0.62
  }
};

const SHORT_NAMES = {
  violins1: "Vn I",
  violins2: "Vn II",
  violas: "Va",
  cellos: "Vc",
  basses: "Cb",
  flute: "Fl",
  oboe: "Ob",
  clarinet: "Cl",
  bassoon: "Bn",
  horn: "Hn",
  trumpet: "Tp",
  trombone: "Tb",
  timpani: "Tmp",
  percussion: "Perc",
  harp: "Hp",
  piano: "Pf"
};

const STEM_ORDER = ["vocals", "other", "drums", "bass"];

const STEM_PROFILES = {
  vocals: {
    id: "vocals",
    label: "Lead Stem",
    description: "멜로디와 전면 중심을 잡는 stem",
    short: "Lead",
    color: "#c86f5a",
    position: { x: 0, y: 0.2, z: -1.75 },
    gain: 0.94,
    send: 0.24,
    highpass: 110,
    lowShelfHz: 180,
    lowShelfGain: -0.6,
    bodyHz: 1450,
    bodyGain: 0,
    airGain: 0.25,
    pan: 0
  },
  other: {
    id: "other",
    label: "Music Stem",
    description: "화성, 질감, 잔향감의 넓이를 만드는 stem",
    short: "Music",
    color: "#517f96",
    position: { x: -1.05, y: 0.22, z: -3.35 },
    gain: 0.9,
    send: 0.36,
    highpass: 90,
    lowShelfHz: 210,
    lowShelfGain: -2.4,
    bodyHz: 980,
    bodyGain: 0,
    airGain: 0.3,
    pan: -0.12
  },
  drums: {
    id: "drums",
    label: "Transient Stem",
    description: "타격감과 거리 단서를 만드는 stem",
    short: "Hit",
    color: "#b89148",
    position: { x: 1.0, y: 0.12, z: -3.9 },
    gain: 0.84,
    send: 0.28,
    highpass: 95,
    lowShelfHz: 180,
    lowShelfGain: -3.2,
    bodyHz: 2500,
    bodyGain: 0,
    airGain: 0.35,
    pan: 0.1
  },
  bass: {
    id: "bass",
    label: "Low Stem",
    description: "저역 위치만 고정하고 공간 잔향에서는 억제하는 stem",
    short: "Low",
    color: "#687f5b",
    position: { x: 0, y: -0.12, z: -1.35 },
    gain: 0.24,
    send: 0,
    highpass: 82,
    lowShelfHz: 135,
    lowShelfGain: -10.5,
    bodyHz: 145,
    bodyGain: -2.2,
    airGain: 0,
    pan: 0
  }
};

const AUTO_REMASTER_KEYS = new Set([
  "width",
  "depth",
  "remasterAmount",
  "remasterTone",
  "remasterClarity",
  "remasterHeadroom"
]);

const LIVE_SIGNATURES = {
  violins1: {
    bands: [[620, 1200, 0.18], [1200, 2600, 0.34], [2600, 6200, 0.34], [6200, 9400, 0.14]],
    gate: "stringHigh"
  },
  violins2: {
    bands: [[420, 1000, 0.2], [1000, 2200, 0.36], [2200, 5200, 0.32], [5200, 8200, 0.12]],
    gate: "stringHigh"
  },
  violas: {
    bands: [[180, 620, 0.24], [620, 1500, 0.42], [1500, 3400, 0.26], [3400, 5600, 0.08]],
    gate: "stringMid"
  },
  cellos: {
    bands: [[65, 260, 0.34], [260, 760, 0.42], [760, 2200, 0.2], [2200, 4200, 0.04]],
    gate: "stringLow"
  },
  basses: {
    bands: [[38, 160, 0.58], [160, 460, 0.32], [460, 1000, 0.1]],
    gate: "low"
  },
  flute: {
    bands: [[760, 1600, 0.12], [1600, 3600, 0.32], [3600, 7600, 0.42], [7600, 11000, 0.14]],
    gate: "woodwindHigh"
  },
  oboe: {
    bands: [[420, 1100, 0.16], [1100, 2600, 0.44], [2600, 5200, 0.32], [5200, 8000, 0.08]],
    gate: "woodwindMid"
  },
  clarinet: {
    bands: [[180, 620, 0.22], [620, 1500, 0.44], [1500, 3400, 0.26], [3400, 6200, 0.08]],
    gate: "woodwindMid"
  },
  bassoon: {
    bands: [[70, 260, 0.22], [260, 760, 0.46], [760, 1800, 0.24], [1800, 3600, 0.08]],
    gate: "woodwindLow"
  },
  horn: {
    bands: [[80, 260, 0.18], [260, 760, 0.42], [760, 1700, 0.3], [1700, 3400, 0.1]],
    gate: "brassWarm"
  },
  trumpet: {
    bands: [[380, 1000, 0.14], [1000, 2600, 0.38], [2600, 6200, 0.36], [6200, 9800, 0.12]],
    gate: "brassBright"
  },
  trombone: {
    bands: [[100, 360, 0.18], [360, 1100, 0.42], [1100, 2600, 0.3], [2600, 5200, 0.1]],
    gate: "brassWarm"
  },
  timpani: {
    bands: [[45, 180, 0.68], [180, 360, 0.22], [360, 720, 0.1]],
    gate: "impactLow"
  },
  percussion: {
    bands: [[1000, 3000, 0.18], [3000, 7600, 0.46], [7600, 14000, 0.36]],
    gate: "impactHigh"
  },
  harp: {
    bands: [[260, 900, 0.16], [900, 2600, 0.3], [2600, 6200, 0.36], [6200, 11000, 0.18]],
    gate: "pluck"
  },
  piano: {
    bands: [[45, 180, 0.12], [180, 620, 0.26], [620, 1800, 0.3], [1800, 5200, 0.24], [5200, 9000, 0.08]],
    gate: "piano"
  }
};

init();

function init() {
  applyStoredTheme();

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
  refs.remasterToggle.addEventListener("change", () => {
    state.settings.remaster = refs.remasterToggle.checked;
    refs.sliderValues.remaster.textContent = state.settings.remaster ? "ON" : "OFF";
    renderRemasterProfile(state.analysis);
    updateAutoRemasterAutomation(getPlaybackTime(), { force: true });
    updateLiveGraphSettings();
  });
  refs.concertHallToggle.addEventListener("change", () => {
    state.settings.concertHall = refs.concertHallToggle.checked;
    refs.sliderValues.concertHall.textContent = state.settings.concertHall ? "ON" : "OFF";
    updateLiveGraphSettings();
  });
  refs.playButton.addEventListener("click", togglePlayback);
  refs.stopButton.addEventListener("click", stopPlayback);
  refs.seekSlider.addEventListener("input", seekToSlider);

  refs.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      refs.modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (state.playing) {
        restartPlaybackAtCurrentTime();
      }
    });
  });

  Object.entries(refs.sliders).forEach(([key, slider]) => {
    slider.addEventListener("input", () => updateSetting(key, slider.value));
    updateSetting(key, slider.value);
  });
  refs.sliderValues.remaster.textContent = refs.remasterToggle.checked ? "ON" : "OFF";
  state.settings.concertHall = refs.concertHallToggle.checked;
  refs.sliderValues.concertHall.textContent = state.settings.concertHall ? "ON" : "OFF";

  drawEmptyWaveform();
}

async function analyzeFile(file) {
  stopPlayback();
  state.file = file;
  state.analysis = null;
  state.audioBuffer = null;
  state.stemBuffers = null;
  state.liveScores = {};
  state.meterLevels = {};
  setBusy(true, "Demucs stem 분리 및 공간 분석 중");
  refs.trackKicker.textContent = "ANALYZING";
  refs.trackName.textContent = file.name;
  refs.trackSubtitle.textContent = `${formatBytes(file.size)} · 로컬 AI 분석 준비 중`;
  refs.playButton.disabled = true;
  refs.stopButton.disabled = true;
  refs.seekSlider.disabled = true;

  try {
    const context = await ensureAudioContext();
    const decodePromise = file.arrayBuffer().then((buffer) => context.decodeAudioData(buffer.slice(0)));
    const analyzePromise = postAudioForAnalysis(file);
    const [audioBuffer, analysis] = await Promise.all([decodePromise, analyzePromise]);

    state.audioBuffer = audioBuffer;
    state.analysis = analysis;
    if (analysis.models.deepSeparator.status === "completed") {
      setBusy(true, "분리된 stem 디코딩 중");
      state.stemBuffers = await loadStemBuffers(context, analysis);
    }
    state.offset = 0;
    renderAnalysis(analysis);
    updateAutoRemasterAutomation(0, { force: true });
    refs.playButton.disabled = false;
    refs.stopButton.disabled = false;
    refs.seekSlider.disabled = false;
    document.body.classList.add("has-analysis");
    setBusy(false, state.stemBuffers ? "Demucs 공간 렌더링 준비 완료" : "공간 분석 완료");
    showToast(state.stemBuffers ? "Demucs stem 기반 공간음향 준비가 완료됐습니다." : "기본 공간음향 분석이 완료됐습니다.");
  } catch (error) {
    console.error(error);
    setBusy(false, "분석 실패");
    showToast(error.message || "분석 중 오류가 발생했습니다.");
  }
}

async function postAudioForAnalysis(file) {
  const params = new URLSearchParams({
    filename: file.name,
    demucs: "true"
  });
  const response = await fetch(`/api/analyze?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });
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
    const response = await fetch(`/outputs/${stem.path}`);
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
  const seen = new Set();
  const stems = separator.stems.map((path) => {
    const filename = path.split("/").pop() || "";
    const id = filename.replace(/\.[^.]+$/, "").toLowerCase();
    const profile = STEM_PROFILES[id];
    if (!profile || seen.has(id)) return null;
    seen.add(id);
    return {
      ...profile,
      path,
      kind: "stem",
      active: true,
      family: "stem",
      displayCurve: [],
      curve: []
    };
  }).filter(Boolean);
  return stems.sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id));
}

async function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive"
    });
  }
  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
  return state.audioContext;
}

function renderAnalysis(analysis) {
  const file = analysis.file;
  refs.trackKicker.textContent = "READY";
  refs.trackName.textContent = file.name;
  refs.trackSubtitle.textContent = `${formatTime(file.duration)} · ${file.channels}ch · ${formatBytes(state.file.size)}`;
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

  renderStage(analysis);
  renderInstrumentList(analysis);
  renderRemasterProfile(analysis);
  renderModelStack(analysis);
  renderSections(analysis);
  drawWaveform(0);
  updateRealtimeDisplay(0);
}

function renderStage(analysis) {
  const objects = getDisplayObjects(analysis);
  refs.activeCount.textContent = state.stemBuffers ? `${objects.length} stems` : `${analysis.activeIds.length} active`;
  refs.stageMap.innerHTML = objects.map((object) => {
    const left = mapRange(object.position.x, -3.4, 3.4, 13, 87);
    const top = mapRange(object.position.z, -4.2, -0.8, 18, 78);
    return `
      <div class="stage-node ${object.active ? "" : "is-inactive"}"
        data-id="${object.id}"
        data-label="${object.label}"
        data-family="${object.family}"
        style="left:${left}%; top:${top}%; --node-color:${object.color}; --level:0">
        <strong>${object.short || SHORT_NAMES[object.id] || object.label}</strong>
      </div>
    `;
  }).join("");
}

function renderInstrumentList(analysis) {
  const objects = getDisplayObjects(analysis);
  state.meterLevels = Object.fromEntries(objects.map((object) => [object.id, 0]));
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
}

function getFallbackObjectDescription(object) {
  if (object.family === "keyboard") return "넓은 대역과 어택을 추적합니다.";
  if (object.family === "percussion") return "타격과 순간 에너지를 추적합니다.";
  if (object.family === "brass" || object.family === "woodwinds") return "중고역 존재감과 거리감을 추적합니다.";
  if (object.family === "strings") return "지속음과 선율 움직임을 추적합니다.";
  return "공간 렌더링의 실시간 에너지를 추적합니다.";
}

function getDisplayObjects(analysis) {
  if (state.stemBuffers) {
    return Object.values(state.stemBuffers).sort((a, b) => STEM_ORDER.indexOf(a.id) - STEM_ORDER.indexOf(b.id));
  }
  return analysis.instruments.map((instrument) => ({
    ...instrument,
    kind: "instrument",
    short: SHORT_NAMES[instrument.id] || instrument.label
  }));
}

function renderRemasterProfile(analysis) {
  const remaster = analysis && analysis.remaster;
  if (!remaster) {
    refs.remasterTag.textContent = "대기";
    refs.remasterGrid.innerHTML = '<div class="remaster-empty">분석 후 자동 리마스터링 프로필이 표시됩니다.</div>';
    return;
  }
  refs.remasterTag.textContent = state.settings.remaster ? "ON" : "OFF";
  refs.remasterGrid.innerHTML = `
    <div class="remaster-summary">
      <strong>${remaster.targetLufs.toFixed(1)} LUFS target</strong>
      <span>${escapeHtml(remaster.summary)}</span>
    </div>
    ${remaster.rows.map((row) => `
      <div class="remaster-item">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
      </div>
    `).join("")}
  `;
}

function renderModelStack(analysis) {
  const separator = analysis.models.deepSeparator;
  refs.modelTag.textContent = state.stemBuffers ? "Demucs spatial" : (separator.available ? "Demucs ready" : "Fallback active");
  refs.modelStack.innerHTML = `
    <div class="model-item">
      <strong>Demucs stem separator</strong>
      <span>${getDemucsStatusText(separator)}</span>
    </div>
    <div class="model-item">
      <strong>Stem HRTF spatial renderer</strong>
      <span>분리된 stem을 각각 독립 panner, 초기반사, 룸 컨볼루션, 출력 리미터로 처리합니다.</span>
    </div>
    <div class="model-item">
      <strong>Realtime stem meters</strong>
      <span>재생 중인 각 stem 신호를 직접 읽어 반응 바와 공간 필드에 즉시 반영합니다.</span>
    </div>
    <div class="model-item">
      <strong>Fallback analysis</strong>
      <span>Demucs가 실패하면 ${analysis.models.primary} 결과로 기본 공간 배치를 유지합니다.</span>
    </div>
    ${analysis.recommendations.map((item) => `
      <div class="model-item"><strong>Engine note</strong><span>${escapeHtml(item)}</span></div>
    `).join("")}
  `;
}

function getDemucsStatusText(separator) {
  if (separator.status === "completed") return `stem 분리 완료 · ${separator.stems.length} files`;
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
        <li>공간 처리 강도 ${Math.round(clamp(section.energy * 0.62 + section.density * 0.38, 0, 1) * 100)}%</li>
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

  const graph = createPlaybackGraph(context, state.audioBuffer, state.analysis, state.mode);
  state.graph = graph;
  const safeOffset = clamp(state.offset, 0, Math.max(0, state.audioBuffer.duration - 0.02));
  state.startedAt = context.currentTime - safeOffset;
  state.playing = true;
  refs.playButton.textContent = "Ⅱ";
  const sources = graph.sources || [graph.source];
  sources.forEach((source) => {
    const sourceOffset = source.buffer ? clamp(safeOffset, 0, Math.max(0, source.buffer.duration - 0.02)) : safeOffset;
    source.start(0, sourceOffset);
  });
  sources[0].onended = () => {
    if (state.playing && getPlaybackTime() >= state.audioBuffer.duration - 0.05) {
      stopPlayback();
    }
  };
  tick();
}

function restartPlaybackAtCurrentTime() {
  const time = getPlaybackTime();
  stopPlayback({ keepOffset: true, silent: true });
  state.offset = time;
  startPlayback();
}

function stopPlayback(options = {}) {
  const { keepOffset = false, silent = false } = options;
  if (state.graph) {
    const sources = state.graph.sources || [state.graph.source];
    sources.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
      } catch (stopError) {
        // Source may already be stopped.
      }
    });
    disconnectGraph(state.graph);
    state.graph = null;
  }
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }
  if (!keepOffset) {
    state.offset = 0;
    Object.keys(state.meterLevels).forEach((id) => {
      state.meterLevels[id] = 0;
    });
  }
  state.playing = false;
  refs.playButton.textContent = "▶";
  if (!silent) {
    drawWaveform(state.offset);
    updateRealtimeDisplay(state.offset);
    updateSeek(state.offset);
  }
}

function createPlaybackGraph(context, buffer, analysis, mode) {
  if (mode === "original") {
    return createOriginalGraph(context, buffer, analysis);
  }
  if (state.stemBuffers && Object.keys(state.stemBuffers).length) {
    return createStemSpatialGraph(context, buffer, analysis);
  }
  return createAnalysisFallbackGraph(context, buffer, analysis);
}

function createOutputChain(context, mode) {
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const limiter = context.createDynamicsCompressor();

  compressor.threshold.value = -13;
  compressor.knee.value = 9;
  compressor.ratio.value = 1.65;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.15;

  limiter.threshold.value = -2.2;
  limiter.knee.value = 1.5;
  limiter.ratio.value = 13;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.075;

  master.gain.value = state.settings.gain;
  compressor.connect(limiter).connect(master).connect(context.destination);
  const liveMeter = createLiveInstrumentMeter(context, master);
  return {
    master,
    compressor,
    limiter,
    liveMeter,
    nodes: [master, compressor, limiter, ...liveMeter.nodes]
  };
}

function createOriginalGraph(context, buffer, analysis) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const sourceInput = context.createGain();
  source.connect(sourceInput);

  const output = createOutputChain(context, "original");
  const remasterChain = createAutoRemasterChain(context, sourceInput, analysis, "original");
  remasterChain.output.connect(output.compressor);

  return {
    source,
    sources: [source],
    master: output.master,
    remasterControls: remasterChain.controls,
    analyser: output.liveMeter.analyser,
    frequencyData: output.liveMeter.frequencyData,
    timeData: output.liveMeter.timeData,
    previousLiveScores: {},
    nodes: [sourceInput, ...remasterChain.nodes, ...output.nodes]
  };
}

function createStemSpatialGraph(context, buffer, analysis) {
  const output = createOutputChain(context, "spatial");
  const originalSource = context.createBufferSource();
  originalSource.buffer = buffer;
  originalSource.connect(output.compressor);

  const spatialBus = context.createGain();
  spatialBus.gain.value = 0.52;
  spatialBus.connect(output.compressor);

  const roomInput = createRoomInputFilter(context);
  const convolver = context.createConvolver();
  convolver.buffer = createImpulseResponse(context, state.settings.room);
  const reverbGain = context.createGain();
  reverbGain.gain.value = state.settings.room * 0.2;
  roomInput.output.connect(convolver);
  convolver.connect(reverbGain).connect(output.compressor);
  const originalRoomSend = context.createGain();
  originalRoomSend.gain.value = 0.2;
  originalSource.connect(originalRoomSend).connect(roomInput.input);
  const concertHall = state.settings.concertHall
    ? createConcertHallLayer(context, originalSource, output.compressor)
    : null;

  const sources = [originalSource];
  const stemPanners = {};
  const spatialObjects = [];
  const earlyReflections = [];
  const spatialMeters = createSpatialStemMeters(context);
  const nodes = [originalSource, originalRoomSend, spatialBus, ...roomInput.nodes, convolver, reverbGain, ...output.nodes, ...spatialMeters.nodes];
  if (concertHall) nodes.push(...concertHall.nodes);
  earlyReflections.push(...connectHallReflections(context, originalSource, spatialBus));

  getDisplayObjects(analysis).forEach((stem) => {
    const source = context.createBufferSource();
    source.buffer = stem.buffer;

    const inputGain = context.createGain();
    inputGain.gain.value = getStemAmbienceGain(stem);
    const tone = createStemToneStack(context, stem);
    const roomSend = context.createGain();
    roomSend.gain.value = stem.send;

    source.connect(inputGain).connect(tone.input);
    tone.output.connect(roomSend).connect(roomInput.input);
    tone.output.connect(spatialMeters.byId[stem.id].input);
    earlyReflections.push(...connectEarlyReflections(context, tone.output, spatialBus, stem));

    sources.push(source);
    spatialObjects.push(stem);
    nodes.push(source, inputGain, ...tone.nodes, roomSend);
  });

  earlyReflections.forEach((reflection) => nodes.push(...reflection.nodes));

  return {
    source: originalSource,
    sources,
    master: output.master,
    reverbGain,
    concertHall,
    concertHallSource: originalSource,
    concertHallOutput: output.compressor,
    spatialMeters,
    spatialObjects,
    stemPanners,
    earlyReflections,
    analyser: output.liveMeter.analyser,
    frequencyData: output.liveMeter.frequencyData,
    timeData: output.liveMeter.timeData,
    previousLiveScores: {},
    nodes
  };
}

function createAnalysisFallbackGraph(context, buffer, analysis) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const output = createOutputChain(context, "spatial");
  source.connect(output.compressor);

  const spatialBus = context.createGain();
  spatialBus.gain.value = 0.48;
  spatialBus.connect(output.compressor);

  const ambienceSend = context.createGain();
  ambienceSend.gain.value = 0.26;
  source.connect(ambienceSend);
  const roomInput = createRoomInputFilter(context);
  const convolver = context.createConvolver();
  convolver.buffer = createImpulseResponse(context, state.settings.room);
  const reverbGain = context.createGain();
  reverbGain.gain.value = state.settings.room * 0.18;
  ambienceSend.connect(roomInput.input);
  roomInput.output.connect(convolver);
  convolver.connect(reverbGain).connect(output.compressor);

  const nodes = [
    source,
    spatialBus,
    ambienceSend,
    ...roomInput.nodes,
    convolver,
    reverbGain,
    ...output.nodes
  ];
  const earlyReflections = connectHallReflections(context, source, spatialBus);
  earlyReflections.forEach((reflection) => nodes.push(...reflection.nodes));
  const concertHall = state.settings.concertHall
    ? createConcertHallLayer(context, source, output.compressor)
    : null;
  if (concertHall) nodes.push(...concertHall.nodes);

  return {
    source,
    sources: [source],
    master: output.master,
    reverbGain,
    concertHall,
    concertHallSource: source,
    concertHallOutput: output.compressor,
    earlyReflections,
    analyser: output.liveMeter.analyser,
    frequencyData: output.liveMeter.frequencyData,
    timeData: output.liveMeter.timeData,
    previousLiveScores: {},
    nodes
  };
}

function createHrtfPanner(context, position) {
  const panner = context.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1.15;
  panner.maxDistance = 18;
  panner.rolloffFactor = 0.52;
  setPannerPosition(panner, position, context.currentTime);
  return panner;
}

function getStemAmbienceGain(stem) {
  if (stem.id === "bass") return 0.05;
  if (stem.id === "drums") return 0.3;
  if (stem.id === "vocals") return 0.24;
  return 0.34;
}

function createStemToneStack(context, stem) {
  const input = context.createGain();
  const lowShelf = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const body = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = stem.lowShelfHz || 180;
  lowShelf.gain.value = stem.lowShelfGain || 0;

  highpass.type = "highpass";
  highpass.frequency.value = stem.highpass;
  highpass.Q.value = 0.7;

  body.type = "peaking";
  body.frequency.value = stem.bodyHz;
  body.Q.value = 0.75;
  body.gain.value = stem.bodyGain;

  presence.type = "peaking";
  presence.frequency.value = 3600;
  presence.Q.value = 0.9;
  presence.gain.value = stem.id === "bass" ? -0.45 : 0.15;

  air.type = "highshelf";
  air.frequency.value = 7600;
  air.gain.value = stem.airGain;

  input.connect(lowShelf).connect(highpass).connect(body).connect(presence).connect(air);
  return {
    input,
    output: air,
    nodes: [input, lowShelf, highpass, body, presence, air]
  };
}

function createRoomInputFilter(context) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = 230;
  highpass.Q.value = 0.72;

  presence.type = "peaking";
  presence.frequency.value = 3100;
  presence.Q.value = 0.8;
  presence.gain.value = 1.15;

  air.type = "highshelf";
  air.frequency.value = 7600;
  air.gain.value = 0.9;

  input.connect(highpass).connect(presence).connect(air);
  return {
    input,
    output: air,
    nodes: [input, highpass, presence, air]
  };
}

function createSpatialStemMeters(context) {
  const silentTap = context.createGain();
  silentTap.gain.value = 0;
  silentTap.connect(context.destination);
  const byId = {};
  const nodes = [silentTap];

  Object.values(state.stemBuffers || {}).forEach((stem) => {
    const input = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.minDecibels = -94;
    analyser.maxDecibels = -12;
    analyser.smoothingTimeConstant = 0.08;
    input.connect(analyser).connect(silentTap);
    byId[stem.id] = {
      stem,
      input,
      analyser,
      timeData: new Float32Array(analyser.fftSize)
    };
    nodes.push(input, analyser);
  });

  return { byId, nodes };
}

function connectHallReflections(context, input, output) {
  const taps = [
    { position: { x: -2.7, y: 0.34, z: -2.4 }, delay: 0.018, gain: 0.06 },
    { position: { x: 2.7, y: 0.34, z: -2.5 }, delay: 0.024, gain: 0.055 },
    { position: { x: -3.35, y: 0.48, z: -4.15 }, delay: 0.041, gain: 0.052 },
    { position: { x: 3.35, y: 0.48, z: -4.05 }, delay: 0.047, gain: 0.05 },
    { position: { x: -1.2, y: 0.72, z: -5.35 }, delay: 0.068, gain: 0.038 },
    { position: { x: 1.2, y: 0.72, z: -5.55 }, delay: 0.074, gain: 0.036 }
  ];

  return taps.map((tap, index) => {
    const filter = createReflectionFilter(context);
    const delay = context.createDelay(0.12);
    const gain = context.createGain();
    const panner = createHrtfPanner(context, tap.position);
    delay.delayTime.value = tap.delay;
    gain.gain.value = state.settings.room * tap.gain;
    input.connect(filter.input);
    filter.output.connect(delay).connect(gain).connect(panner).connect(output);
    return {
      kind: "hall",
      index,
      baseGain: tap.gain,
      position: tap.position,
      gain,
      panner,
      nodes: [...filter.nodes, delay, gain, panner]
    };
  });
}

function getConcertHallAmount() {
  return state.settings.concertHall ? 1 : 0;
}

function createConcertHallLayer(context, input, output) {
  const send = context.createGain();
  send.gain.value = getConcertHallAmount();

  const roomInput = createConcertHallInputFilter(context);
  const preDelay = context.createDelay(0.22);
  preDelay.delayTime.value = 0.036;
  const convolver = context.createConvolver();
  convolver.buffer = createConcertHallImpulse(context);
  const reverbTone = createConcertHallOutputFilter(context);
  const reverbGain = context.createGain();
  reverbGain.gain.value = getConcertHallAmount() * state.settings.room * 0.28;

  input.connect(send);
  send.connect(roomInput.input);
  roomInput.output.connect(preDelay).connect(convolver).connect(reverbTone.input);
  reverbTone.output.connect(reverbGain).connect(output);

  const reflectionBus = context.createGain();
  reflectionBus.gain.value = getConcertHallAmount() * 0.38;
  reflectionBus.connect(output);
  const reflections = connectConcertHallReflections(context, send, reflectionBus);

  return {
    send,
    reverbGain,
    reflectionBus,
    reflections,
    nodes: [
      send,
      ...roomInput.nodes,
      preDelay,
      convolver,
      ...reverbTone.nodes,
      reverbGain,
      reflectionBus,
      ...reflections.flatMap((reflection) => reflection.nodes)
    ]
  };
}

function createConcertHallInputFilter(context) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter();
  const lowMidControl = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = 360;
  highpass.Q.value = 0.72;

  lowMidControl.type = "peaking";
  lowMidControl.frequency.value = 430;
  lowMidControl.Q.value = 0.82;
  lowMidControl.gain.value = -0.65;

  presence.type = "peaking";
  presence.frequency.value = 2600;
  presence.Q.value = 0.74;
  presence.gain.value = 0.38;

  air.type = "highshelf";
  air.frequency.value = 7200;
  air.gain.value = 0.42;

  input.connect(highpass).connect(lowMidControl).connect(presence).connect(air);
  return {
    input,
    output: air,
    nodes: [input, highpass, lowMidControl, presence, air]
  };
}

function createConcertHallOutputFilter(context) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter();
  const lowMidControl = context.createBiquadFilter();
  const deharsh = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = 280;
  highpass.Q.value = 0.7;

  lowMidControl.type = "peaking";
  lowMidControl.frequency.value = 520;
  lowMidControl.Q.value = 0.9;
  lowMidControl.gain.value = -0.72;

  deharsh.type = "peaking";
  deharsh.frequency.value = 3900;
  deharsh.Q.value = 1.15;
  deharsh.gain.value = -0.22;

  air.type = "highshelf";
  air.frequency.value = 6800;
  air.gain.value = 0.32;

  input.connect(highpass).connect(lowMidControl).connect(deharsh).connect(air);
  return {
    input,
    output: air,
    nodes: [input, highpass, lowMidControl, deharsh, air]
  };
}

function connectConcertHallReflections(context, input, output) {
  const taps = [
    { position: { x: -4.2, y: 0.82, z: -6.2 }, delay: 0.086, gain: 0.044 },
    { position: { x: 4.15, y: 0.82, z: -6.05 }, delay: 0.096, gain: 0.042 },
    { position: { x: -5.3, y: 1.08, z: -7.4 }, delay: 0.118, gain: 0.037 },
    { position: { x: 5.25, y: 1.08, z: -7.2 }, delay: 0.129, gain: 0.036 },
    { position: { x: -2.6, y: 1.46, z: -8.8 }, delay: 0.152, gain: 0.031 },
    { position: { x: 2.55, y: 1.46, z: -8.95 }, delay: 0.164, gain: 0.03 },
    { position: { x: -0.9, y: 1.9, z: -10.1 }, delay: 0.188, gain: 0.024 },
    { position: { x: 0.95, y: 1.9, z: -10.35 }, delay: 0.204, gain: 0.023 }
  ];

  return taps.map((tap, index) => {
    const filter = createConcertHallReflectionFilter(context);
    const delay = context.createDelay(0.26);
    const gain = context.createGain();
    const panner = createHrtfPanner(context, tap.position);
    delay.delayTime.value = tap.delay;
    gain.gain.value = getConcertHallAmount() * state.settings.room * tap.gain;
    input.connect(filter.input);
    filter.output.connect(delay).connect(gain).connect(panner).connect(output);
    return {
      kind: "concertHall",
      index,
      baseGain: tap.gain,
      position: tap.position,
      gain,
      panner,
      nodes: [...filter.nodes, delay, gain, panner]
    };
  });
}

function createConcertHallReflectionFilter(context) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter();
  const lowMidControl = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = 430;
  highpass.Q.value = 0.72;

  lowMidControl.type = "peaking";
  lowMidControl.frequency.value = 650;
  lowMidControl.Q.value = 0.86;
  lowMidControl.gain.value = -0.48;

  air.type = "highshelf";
  air.frequency.value = 7600;
  air.gain.value = 0.26;

  input.connect(highpass).connect(lowMidControl).connect(air);
  return {
    input,
    output: air,
    nodes: [input, highpass, lowMidControl, air]
  };
}

function createReflectionFilter(context) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const air = context.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = 340;
  highpass.Q.value = 0.7;

  presence.type = "peaking";
  presence.frequency.value = 2600;
  presence.Q.value = 0.85;
  presence.gain.value = 0.6;

  air.type = "highshelf";
  air.frequency.value = 7800;
  air.gain.value = 0.55;

  input.connect(highpass).connect(presence).connect(air);
  return {
    input,
    output: air,
    nodes: [input, highpass, presence, air]
  };
}

function connectEarlyReflections(context, input, output, stem) {
  return [-1, 1, -0.55, 0.55].map((side, index) => {
    const delay = context.createDelay(0.08);
    const gain = context.createGain();
    const panner = createHrtfPanner(context, {
      x: stem.position.x + side * (1.55 + state.settings.width * 0.48),
      y: stem.position.y * 0.68 + (index > 1 ? 0.08 : 0),
      z: stem.position.z - 0.82 - index * 0.18
    });
    delay.delayTime.value = 0.014 + index * 0.011 + Math.abs(stem.position.x) * 0.002;
    const bassTrim = stem.id === "bass" ? 0.2 : 1;
    gain.gain.value = state.settings.room * (0.024 + stem.send * 0.036) * bassTrim;
    input.connect(delay).connect(gain).connect(panner).connect(output);
    return { gain, panner, stem, side, index, nodes: [delay, gain, panner] };
  });
}

function createLiveInstrumentMeter(context, input) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 4096;
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

function createInstrumentMeters(context, input, analysis) {
  const silentTap = context.createGain();
  silentTap.gain.value = 0;
  silentTap.connect(context.destination);
  const byId = {};
  const nodes = [silentTap];

  analysis.instruments.forEach((instrument) => {
    const filter = createInstrumentFilter(context, instrument);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.minDecibels = -96;
    analyser.maxDecibels = -14;
    analyser.smoothingTimeConstant = 0.18;
    input.connect(filter);
    filter.connect(analyser);
    analyser.connect(silentTap);
    byId[instrument.id] = {
      instrument,
      filter,
      analyser,
      frequencyData: new Float32Array(analyser.frequencyBinCount),
      timeData: new Float32Array(analyser.fftSize)
    };
    nodes.push(filter, analyser);
  });

  return { byId, nodes };
}

function createInstrumentFilter(context, instrument) {
  const filter = context.createBiquadFilter();
  filter.type = getFilterType(instrument);
  filter.frequency.value = instrument.filter.freq;
  filter.Q.value = instrument.filter.q;
  return filter;
}

function createAutoRemasterChain(context, input, analysis, mode) {
  const remaster = analysis && analysis.remaster;
  const output = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  input.connect(dry).connect(output);

  const inputGain = context.createGain();
  inputGain.gain.value = 1;

  const lowShelf = context.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 115;

  const lowMid = context.createBiquadFilter();
  lowMid.type = "peaking";
  lowMid.frequency.value = 360;
  lowMid.Q.value = 0.8;

  const presence = context.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2800;
  presence.Q.value = 0.82;

  const deharsh = context.createBiquadFilter();
  deharsh.type = "peaking";
  deharsh.frequency.value = 4600;
  deharsh.Q.value = 1.15;

  const air = context.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 8800;

  const glue = context.createDynamicsCompressor();
  glue.knee.value = 10;
  glue.attack.value = 0.008;
  glue.release.value = 0.16;

  input
    .connect(inputGain)
    .connect(lowShelf)
    .connect(lowMid)
    .connect(presence)
    .connect(deharsh)
    .connect(air)
    .connect(glue)
    .connect(wet)
    .connect(output);

  const controls = {
    remaster,
    mode,
    dry,
    wet,
    output,
    inputGain,
    lowShelf,
    lowMid,
    presence,
    deharsh,
    air,
    glue
  };
  if (remaster) {
    updateAutoRemasterControls(controls, context.currentTime);
  } else {
    dry.gain.value = 1;
    wet.gain.value = 0;
    output.gain.value = 1;
  }

  return {
    output,
    controls,
    nodes: [dry, wet, inputGain, lowShelf, lowMid, presence, deharsh, air, glue, output]
  };
}

function updateAutoRemasterControls(controls, time = 0) {
  if (!controls || !controls.remaster) return;
  const remaster = controls.remaster;
  const enabled = state.settings.remaster && controls.mode !== "original";
  const amount = enabled ? state.settings.remasterAmount : 0;
  const tone = state.settings.remasterTone;
  const clarity = state.settings.remasterClarity;
  const headroom = state.settings.remasterHeadroom;
  const toneBright = tone > 0 ? tone : 0;
  const lowShelfDb = Math.min(0, remaster.lowShelfDb) - amount * 0.65;
  const lowMidDb = Math.min(0, remaster.lowMidDb) - amount * 0.35;

  controls.dry.gain.setTargetAtTime(1 - amount * 0.82, time, 0.025);
  controls.wet.gain.setTargetAtTime(amount, time, 0.025);
  controls.inputGain.gain.setTargetAtTime(dbToGain(remaster.inputGainDb * amount), time, 0.025);
  controls.lowShelf.gain.setTargetAtTime(lowShelfDb * amount, time, 0.025);
  controls.lowMid.gain.setTargetAtTime(lowMidDb * amount, time, 0.025);
  controls.presence.gain.setTargetAtTime((remaster.presenceDb + toneBright * 1.8 + clarity * 0.7) * amount, time, 0.025);
  controls.deharsh.gain.setTargetAtTime((remaster.deharshDb - clarity * 0.65) * amount, time, 0.025);
  controls.air.gain.setTargetAtTime((remaster.airDb + toneBright * 1.4 + clarity * 0.5) * amount, time, 0.025);
  controls.glue.threshold.setTargetAtTime(remaster.compressor.thresholdDb - amount * 1.5, time, 0.025);
  controls.glue.ratio.setTargetAtTime(1 + (remaster.compressor.ratio - 1) * amount * (0.72 + clarity * 0.45), time, 0.025);
  controls.glue.attack.setTargetAtTime(remaster.compressor.attack, time, 0.025);
  controls.glue.release.setTargetAtTime(remaster.compressor.release + (1 - clarity) * 0.08, time, 0.025);

  const spatialTrim = 0;
  const headroomDb = -0.15 - headroom * 1.15;
  controls.output.gain.setTargetAtTime(dbToGain((remaster.outputGainDb + spatialTrim + headroomDb) * amount), time, 0.025);
}

function getFilterType(instrument) {
  if (instrument.id === "basses" || instrument.id === "timpani") return "lowpass";
  if (instrument.id === "percussion") return "highpass";
  return "bandpass";
}

function getSendLevel(instrument) {
  const familyBoost = instrument.family === "brass" || instrument.family === "woodwinds" ? 1.12 : 1;
  return clamp(0.28 * familyBoost, 0.08, 0.58);
}

function setPannerPosition(panner, position, time) {
  const width = state.settings.width;
  const depth = state.settings.depth;
  const height = position.y * 0.58;
  const x = position.x * width;
  const y = height;
  const z = position.z * depth;
  panner.positionX.setValueAtTime(x, time);
  panner.positionY.setValueAtTime(y, time);
  panner.positionZ.setValueAtTime(z, time);
}

function createImpulseResponse(context, amount) {
  const seconds = 2.35;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const early = Math.exp(-t * 8.8);
      const tail = Math.pow(1 - t, 1.82);
      const decay = early * 0.44 + tail * 0.56;
      const shimmer = 0.78 + 0.22 * Math.sin(t * Math.PI * 20);
      const stereoBias = channel === 0 ? Math.sin(i * 0.0013) : Math.cos(i * 0.0017);
      data[i] = (Math.random() * 2 - 1 + stereoBias * 0.18) * decay * shimmer * amount * 0.44;
    }
  }
  return impulse;
}

function createConcertHallImpulse(context) {
  const seconds = 3.45;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const time = i / context.sampleRate;
      const position = i / length;
      const build = Math.min(1, time * 8.5);
      const early = Math.exp(-time * 4.6) * 0.2;
      const tail = Math.pow(1 - position, 2.05) * Math.exp(-time * 0.16) * 0.28;
      const density = 0.36 + build * 0.64;
      const shimmer = 0.82 + 0.18 * Math.sin(position * Math.PI * 28 + channel * 0.8);
      const stereoBias = channel === 0 ? Math.sin(i * 0.0011) : Math.cos(i * 0.0016);
      const noise = Math.random() * 2 - 1;
      data[i] = (noise + stereoBias * 0.2) * (early + tail) * density * shimmer;
    }
  }
  return impulse;
}

function disconnectGraph(graph) {
  if (!graph.nodes) return;
  graph.nodes.forEach((node) => {
    try {
      node.disconnect();
    } catch (disconnectError) {
      // Some nodes may already be disconnected.
    }
  });
}

function tick() {
  if (!state.playing) return;
  const time = getPlaybackTime();
  if (time >= state.audioBuffer.duration) {
    stopPlayback();
    return;
  }
  const liveScores = readLiveInstrumentScores(time);
  updateAutoRemasterAutomation(time);
  updateGraphGains(time, liveScores);
  updateRealtimeDisplay(time, liveScores);
  updateSeek(time);
  drawWaveform(time);
  state.animationId = requestAnimationFrame(tick);
}

function updateGraphGains(time, liveScores = null) {
  if (!state.graph || !state.analysis) return;
  if (state.graph.stemGains) return;
  if (!state.graph.gains) return;
  const now = state.audioContext.currentTime;
  const modeGain = 0.48;
  state.analysis.instruments.forEach((instrument) => {
    const gain = state.graph.gains[instrument.id];
    if (!gain) return;
    const timelineLevel = getInstrumentAudioLevel(instrument, time);
    const liveLevel = liveScores ? (liveScores[instrument.id] || 0) : 0;
    const level = liveScores
      ? clamp(timelineLevel * 0.58 + liveLevel * 0.42, 0, 1)
      : timelineLevel;
    const target = Math.pow(level, 1.12) * modeGain * getFamilyGain(instrument.family);
    gain.gain.setTargetAtTime(target, now, 0.018);
  });
}

function getFamilyGain(family) {
  if (family === "percussion") return 0.82;
  if (family === "brass") return 0.78;
  if (family === "keyboard" || family === "plucked") return 0.72;
  return 0.86;
}

function readLiveInstrumentScores(time = 0) {
  const graph = state.graph;
  if (!graph || !state.audioContext) return null;
  if (graph.spatialMeters && graph.spatialMeters.byId) {
    const stemScores = readSpatialStemMeterScores(graph.spatialMeters, graph.previousLiveScores || {});
    graph.previousLiveScores = stemScores;
    state.liveScores = stemScores;
    return stemScores;
  }
  if (graph.instrumentMeters && graph.instrumentMeters.byId) {
    const instrumentScores = readInstrumentMeterScores(graph.instrumentMeters, time, graph.previousLiveScores || {});
    graph.previousLiveScores = instrumentScores;
    state.liveScores = instrumentScores;
    return instrumentScores;
  }
  if (!graph.analyser) return null;
  graph.analyser.getFloatFrequencyData(graph.frequencyData);
  graph.analyser.getFloatTimeDomainData(graph.timeData);
  const scores = classifyLiveInstruments(
    graph.frequencyData,
    graph.timeData,
    state.audioContext.sampleRate,
    graph.analyser.fftSize,
    graph.previousLiveScores || {}
  );
  const guardedScores = applyLiveInstrumentRoster(scores);
  graph.previousLiveScores = guardedScores;
  state.liveScores = guardedScores;
  return guardedScores;
}

function readSpatialStemMeterScores(spatialMeters, previousScores) {
  const scores = {};
  Object.entries(spatialMeters.byId).forEach(([id, meter]) => {
    meter.analyser.getFloatTimeDomainData(meter.timeData);
    const raw = getMeterSignalLevel(meter.timeData);
    const previous = previousScores[id] || 0;
    scores[id] = raw >= previous
      ? previous * 0.1 + raw * 0.9
      : previous * 0.48 + raw * 0.52;
  });
  return scores;
}

function readInstrumentMeterScores(instrumentMeters, time, previousScores) {
  const rawScores = {};
  Object.entries(instrumentMeters.byId).forEach(([id, meter]) => {
    meter.analyser.getFloatFrequencyData(meter.frequencyData);
    meter.analyser.getFloatTimeDomainData(meter.timeData);
    const instrument = meter.instrument;
    const meterLevel = getMeterSignalLevel(meter.timeData);
    const spectralBody = getMeterSpectralBody(meter.frequencyData, state.audioContext.sampleRate, instrument);
    const timelineCue = getInstrumentLevelFromCurve(instrument.displayCurve || instrument.curve, time);
    const activeBoost = instrument.active ? 1 : 0.08;
    const cueGate = instrument.active ? (0.18 + timelineCue * 0.92) : 0.08;
    rawScores[id] = Math.pow(meterLevel, 0.78) * (0.42 + spectralBody * 0.75) * cueGate * activeBoost;
  });

  const activeEntries = Object.entries(rawScores).filter(([id]) => {
    const meter = instrumentMeters.byId[id];
    return meter && meter.instrument.active;
  });
  const maxScore = Math.max(...activeEntries.map(([, score]) => score), 1e-8);
  const normalized = {};
  Object.entries(rawScores).forEach(([id, score]) => {
    const meter = instrumentMeters.byId[id];
    const previous = previousScores[id] || 0;
    const relative = score / maxScore;
    const threshold = meter.instrument.active ? 0.055 : 0.22;
    const gated = relative < threshold ? 0 : Math.pow(relative, 0.68);
    normalized[id] = gated >= previous
      ? previous * 0.16 + gated * 0.84
      : previous * 0.6 + gated * 0.4;
  });
  return normalized;
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

function getMeterSpectralBody(frequencyData, sampleRate, instrument) {
  const signature = LIVE_SIGNATURES[instrument.id];
  if (!signature) return 0.5;
  const binHz = (sampleRate / 2) / frequencyData.length;
  let total = 0;
  let weighted = 0;
  for (let index = 0; index < frequencyData.length; index += 1) {
    const amp = 10 ** ((Number.isFinite(frequencyData[index]) ? frequencyData[index] : -120) / 20);
    const energy = amp * amp;
    total += energy;
  }
  signature.bands.forEach(([min, max, weight]) => {
    const start = Math.max(0, Math.floor(min / binHz));
    const end = Math.min(frequencyData.length - 1, Math.ceil(max / binHz));
    let band = 0;
    for (let index = start; index <= end; index += 1) {
      const amp = 10 ** ((Number.isFinite(frequencyData[index]) ? frequencyData[index] : -120) / 20);
      band += amp * amp;
    }
    weighted += (band / Math.max(total, 1e-12)) * weight;
  });
  return clamp(weighted * 3.2, 0, 1);
}

function applyLiveInstrumentRoster(scores) {
  const activeIds = state.analysis && state.analysis.activeIds ? new Set(state.analysis.activeIds) : null;
  if (!activeIds || !activeIds.size) return scores;
  return Object.fromEntries(Object.entries(scores).map(([id, score]) => [
    id,
    activeIds.has(id) ? score : score * 0.04
  ]));
}

function classifyLiveInstruments(frequencyData, timeData, sampleRate, fftSize, previousScores) {
  const features = extractLiveAudioFeatures(frequencyData, timeData, sampleRate, fftSize);
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

function extractLiveAudioFeatures(frequencyData, timeData, sampleRate, fftSize) {
  const nyquist = sampleRate / 2;
  const binHz = nyquist / frequencyData.length;
  const power = new Float32Array(frequencyData.length);
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

function updateRealtimeDisplay(time, liveScores = null) {
  if (!state.analysis) return;
  refs.frameTime.textContent = formatTime(time);
  getDisplayObjects(state.analysis).forEach((object) => {
    const liveLevel = liveScores ? (liveScores[object.id] || 0) : null;
    const rawLevel = getObjectDisplayLevel(object, time, liveLevel);
    const previous = state.meterLevels[object.id] || 0;
    const level = rawLevel >= previous
      ? previous * 0.18 + rawLevel * 0.82
      : previous * 0.58 + rawLevel * 0.42;
    state.meterLevels[object.id] = level;
    const row = refs.instrumentList.querySelector(`[data-id="${object.id}"]`);
    const node = refs.stageMap.querySelector(`[data-id="${object.id}"]`);
    if (row) {
      row.style.setProperty("--level", level.toFixed(3));
      row.classList.toggle("is-sounding", level > 0.055);
      row.classList.toggle("is-live-detected", liveLevel !== null && liveLevel > 0.12);
      row.classList.toggle("is-inactive", !object.active && level <= 0.055);
      const value = row.querySelector("em");
      if (value) value.textContent = `${Math.round(level * 100)}%`;
    }
    if (node) {
      node.style.setProperty("--level", level.toFixed(3));
      node.classList.toggle("is-sounding", level > 0.055);
      node.classList.toggle("is-live-detected", liveLevel !== null && liveLevel > 0.12);
      node.classList.toggle("is-inactive", !object.active && level <= 0.055);
    }
  });
}

function getObjectDisplayLevel(object, time, liveLevel = null) {
  if (object.kind === "stem") {
    return liveLevel === null ? 0 : clamp(liveLevel, 0, 1);
  }
  return getInstrumentDisplayLevel(object, time, liveLevel);
}

function getInstrumentDisplayLevel(instrument, time, liveLevel = null) {
  const timelineLevel = getInstrumentLevelFromCurve(instrument.displayCurve || instrument.curve, time);
  if (state.playing && liveLevel !== null) {
    if (!instrument.active) return clamp(liveLevel, 0, 1);
    return clamp(liveLevel * 0.88 + timelineLevel * 0.12, 0, 1);
  }
  return timelineLevel;
}

function getInstrumentAudioLevel(instrument, time) {
  return getInstrumentLevelFromCurve(instrument.curve, time);
}

function getInstrumentLevelFromCurve(curve, time) {
  const times = state.analysis.timeline.times;
  if (!times.length || !curve.length) return 0;
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
    updateRealtimeDisplay(nextTime);
    drawWaveform(nextTime);
    updateSeek(nextTime);
  }
}

function getPlaybackTime() {
  if (!state.playing || !state.audioContext) return state.offset;
  return clamp(state.audioContext.currentTime - state.startedAt, 0, state.audioBuffer ? state.audioBuffer.duration : 0);
}

function updateSeek(time) {
  const duration = state.analysis ? state.analysis.file.duration : 0;
  refs.currentTime.textContent = formatTime(time);
  refs.totalTime.textContent = formatTime(duration);
  refs.seekSlider.value = duration ? Math.round((time / duration) * 1000) : 0;
}

function drawWaveform(currentTime = 0) {
  const canvas = refs.waveformCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = cssColor("--canvas-bg", "rgba(238,244,240,0.78)");
  ctx.fillRect(0, 0, width, height);

  if (!state.analysis || !state.analysis.waveform.length) {
    drawEmptyWaveform();
    return;
  }

  const values = state.analysis.waveform;
  const mid = height * 0.5;
  const maxAmp = height * 0.42;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, cssColor("--green", "#687f5b"));
  gradient.addColorStop(0.48, cssColor("--blue", "#517f96"));
  gradient.addColorStop(1, cssColor("--coral", "#c86f5a"));
  ctx.fillStyle = gradient;

  values.forEach((value, index) => {
    const x = (index / values.length) * width;
    const barWidth = Math.max(1, width / values.length);
    const h = Math.max(1, value * maxAmp);
    ctx.fillRect(x, mid - h, barWidth, h * 2);
  });

  const cursor = state.analysis.file.duration ? (currentTime / state.analysis.file.duration) * width : 0;
  ctx.fillStyle = cssColor("--ink", "rgba(32,41,51,0.82)");
  ctx.fillRect(cursor, 0, Math.max(2, dpr * 2), height);
}

function drawEmptyWaveform() {
  const canvas = refs.waveformCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.fillStyle = cssColor("--canvas-bg", "rgba(238,244,240,0.78)");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = cssColor("--line", "rgba(32,41,51,0.18)");
  ctx.fillRect(0, canvas.height / 2, canvas.width, Math.max(1, dpr));
}

function updateAutoRemasterAutomation(time = 0, options = {}) {
  if (!state.analysis || !state.settings.remaster) return;
  const features = readLiveOutputFeatures() || getFallbackRemasterFeatures(time);
  const section = getSectionAtTime(time);
  const targets = getAutoRemasterTargets(features, section);
  const smoothing = options.force || !state.playing ? 1 : 0.11;

  Object.entries(targets).forEach(([key, target]) => {
    const current = Number.isFinite(state.autoRemasterValues[key])
      ? state.autoRemasterValues[key]
      : state.settings[key];
    const next = current + (target - current) * smoothing;
    state.autoRemasterValues[key] = next;
    setAutomatedSetting(key, next);
  });

  updateLiveGraphSettings();
}

function readLiveOutputFeatures() {
  const graph = state.graph;
  if (!graph || !graph.analyser || !graph.frequencyData || !graph.timeData || !state.audioContext) return null;
  graph.analyser.getFloatFrequencyData(graph.frequencyData);
  graph.analyser.getFloatTimeDomainData(graph.timeData);
  return buildRealtimeRemasterFeatures(
    graph.frequencyData,
    graph.timeData,
    state.audioContext.sampleRate
  );
}

function buildRealtimeRemasterFeatures(frequencyData, timeData, sampleRate) {
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
  const crest = peak / Math.max(rms, 1e-6);

  const binHz = (sampleRate / 2) / frequencyData.length;
  let total = 0;
  let centroidNumerator = 0;
  const bands = { low: 0, lowMid: 0, mid: 0, presence: 0, air: 0 };
  for (let index = 0; index < frequencyData.length; index += 1) {
    const hz = index * binHz;
    const amp = 10 ** ((Number.isFinite(frequencyData[index]) ? frequencyData[index] : -120) / 20);
    const power = amp * amp;
    total += power;
    centroidNumerator += hz * power;
    if (hz >= 40 && hz < 250) bands.low += power;
    else if (hz < 800) bands.lowMid += power;
    else if (hz < 3200) bands.mid += power;
    else if (hz < 7600) bands.presence += power;
    else if (hz < 14000) bands.air += power;
  }
  total = Math.max(total, 1e-12);
  const centroid = centroidNumerator / total;
  return {
    rmsDb,
    peakDb,
    transient: clamp((crest - 1.8) / 6, 0, 1),
    brightness: clamp((centroid - 520) / 5200, 0, 1),
    low: bands.low / total,
    lowMid: bands.lowMid / total,
    mid: bands.mid / total,
    presence: bands.presence / total,
    air: bands.air / total,
    energy: clamp((rmsDb + 46) / 34, 0, 1)
  };
}

function getFallbackRemasterFeatures(time) {
  const section = getSectionAtTime(time);
  const mix = state.analysis.mix;
  const brightness = clamp((mix.centroidHz - 520) / 5200, 0, 1);
  return {
    rmsDb: mix.rmsDb,
    peakDb: mix.peakDb,
    transient: clamp((mix.crestDb - 6) / 16, 0, 1),
    brightness,
    low: clamp(0.34 - brightness * 0.18, 0.08, 0.42),
    lowMid: 0.24,
    mid: 0.28,
    presence: clamp(brightness * 0.35, 0.06, 0.36),
    air: clamp(brightness * 0.18, 0.02, 0.22),
    energy: section ? section.energy : clamp((mix.rmsDb + 46) / 34, 0, 1)
  };
}

function getAutoRemasterTargets(features, section) {
  const sectionEnergy = section ? section.energy : features.energy;
  const sectionDensity = section ? section.density : features.transient;
  const sectionBrightness = section ? section.brightness : features.brightness;
  const peakPressure = clamp((features.peakDb + 9) / 9, 0, 1);
  const quietLift = clamp((-22 - features.rmsDb) / 20, 0, 1);
  const highDetail = features.presence * 0.7 + features.air * 0.9;
  const lowPressure = features.low + features.lowMid * 0.55;

  return {
    remasterAmount: clamp(0.52 + sectionEnergy * 0.23 + sectionDensity * 0.13 + quietLift * 0.08, 0.4, 0.94),
    remasterTone: clamp((features.brightness - 0.38) * 0.52 + highDetail * 0.12 + lowPressure * 0.42, -0.2, 0.56),
    remasterClarity: clamp(0.42 + features.brightness * 0.32 + features.transient * 0.18 + sectionDensity * 0.16 - lowPressure * 0.12, 0.32, 0.96),
    remasterHeadroom: clamp(0.38 + peakPressure * 0.36 + features.transient * 0.16 + sectionDensity * 0.08, 0.34, 0.94),
    width: clamp(1.42 + features.brightness * 0.12 + sectionBrightness * 0.1 + features.air * 0.08 - features.low * 0.02, 1.34, 1.76),
    depth: clamp(1.48 + sectionEnergy * 0.18 + state.settings.room * 0.18 + (1 - features.transient) * 0.06, 1.32, 1.86)
  };
}

function getSectionAtTime(time) {
  if (!state.analysis || !Array.isArray(state.analysis.sections)) return null;
  return state.analysis.sections.find((section) => time >= section.start && time <= section.end)
    || state.analysis.sections[state.analysis.sections.length - 1]
    || null;
}

function updateSetting(key, value) {
  setSettingFromSliderValue(key, Number(value));
  if (AUTO_REMASTER_KEYS.has(key)) {
    state.autoRemasterValues[key] = state.settings[key];
  }
  updateLiveGraphSettings();
}

function setSettingFromSliderValue(key, numeric) {
  if (key === "remasterTone") {
    state.settings[key] = numeric / 50;
    refs.sliderValues[key].textContent = `${numeric > 0 ? "+" : ""}${numeric}`;
  } else {
    state.settings[key] = numeric / 100;
    refs.sliderValues[key].textContent = `${numeric}%`;
  }
}

function setAutomatedSetting(key, value) {
  const slider = refs.sliders[key];
  if (!slider) return;
  const min = Number(slider.min);
  const max = Number(slider.max);
  const sliderValue = key === "remasterTone"
    ? clamp(Math.round(value * 50), min, max)
    : clamp(Math.round(value * 100), min, max);
  slider.value = String(sliderValue);
  setSettingFromSliderValue(key, sliderValue);
}

function updateLiveGraphSettings() {
  if (!state.graph || !state.audioContext) return;
  const now = state.audioContext.currentTime;
  if (state.graph.master) {
    state.graph.master.gain.setTargetAtTime(state.settings.gain, now, 0.025);
  }
  if (state.graph.reverbGain) {
    const reverbScale = state.graph.spatialMeters ? 0.2 : 0.18;
    state.graph.reverbGain.gain.setTargetAtTime(state.settings.room * reverbScale, now, 0.035);
  }
  if (state.graph.earlyReflections) {
    state.graph.earlyReflections.forEach((reflection) => {
      if (reflection.kind === "hall") {
        reflection.gain.gain.setTargetAtTime(state.settings.room * reflection.baseGain, now, 0.035);
        setPannerPosition(reflection.panner, reflection.position, now);
        return;
      }
      const bassTrim = reflection.stem.id === "bass" ? 0.2 : 1;
      reflection.gain.gain.setTargetAtTime(state.settings.room * (0.024 + reflection.stem.send * 0.036) * bassTrim, now, 0.035);
      setPannerPosition(reflection.panner, {
        x: reflection.stem.position.x + reflection.side * (1.55 + state.settings.width * 0.48),
        y: reflection.stem.position.y * 0.68 + (reflection.index > 1 ? 0.08 : 0),
        z: reflection.stem.position.z - 0.82 - reflection.index * 0.18
      }, now);
    });
  }
  if (state.graph.stemPanners && state.graph.spatialObjects) {
    state.graph.spatialObjects.forEach((object) => {
      const panner = state.graph.stemPanners[object.id];
      if (panner) setPannerPosition(panner, object.position, now);
    });
  }
  if (state.graph.panners && state.analysis) {
    state.analysis.instruments.forEach((instrument) => {
      const panner = state.graph.panners[instrument.id];
      if (panner) setPannerPosition(panner, instrument.position, now);
    });
  }
  updateConcertHallSettings(now);
  updateAutoRemasterControls(state.graph.remasterControls, now);
}

function ensureConcertHallLayer(graph) {
  if (!state.audioContext || !graph || !graph.concertHallSource || !graph.concertHallOutput) {
    return null;
  }
  if (!graph.concertHall) {
    graph.concertHall = createConcertHallLayer(
      state.audioContext,
      graph.concertHallSource,
      graph.concertHallOutput
    );
    if (Array.isArray(graph.nodes)) {
      graph.nodes.push(...graph.concertHall.nodes);
    }
  }
  return graph.concertHall;
}

function updateConcertHallSettings(time) {
  if (!state.graph) return;
  const layer = state.settings.concertHall
    ? ensureConcertHallLayer(state.graph)
    : state.graph.concertHall;
  if (!layer) return;

  const amount = getConcertHallAmount();
  layer.send.gain.setTargetAtTime(amount, time, 0.04);
  layer.reverbGain.gain.setTargetAtTime(amount * state.settings.room * 0.28, time, 0.055);
  layer.reflectionBus.gain.setTargetAtTime(amount * 0.38, time, 0.04);
  layer.reflections.forEach((reflection) => {
    reflection.gain.gain.setTargetAtTime(amount * state.settings.room * reflection.baseGain, time, 0.05);
    setPannerPosition(reflection.panner, reflection.position, time);
  });
}

function resetApp() {
  stopPlayback();
  state.file = null;
  state.analysis = null;
  state.audioBuffer = null;
  state.stemBuffers = null;
  state.meterLevels = {};
  state.liveScores = {};
  state.autoRemasterValues = {
    width: 1.45,
    depth: 1.62,
    remasterAmount: 0.82,
    remasterTone: 0,
    remasterClarity: 0.64,
    remasterHeadroom: 0.62
  };
  state.settings.concertHall = false;
  refs.concertHallToggle.checked = false;
  refs.sliderValues.concertHall.textContent = "OFF";
  refs.fileInput.value = "";
  refs.trackKicker.textContent = "READY";
  refs.trackName.textContent = "파일을 선택하세요";
  refs.trackSubtitle.textContent = "로컬 백엔드에서 분석하고 브라우저에서 공간 렌더링합니다.";
  refs.playButton.disabled = true;
  refs.stopButton.disabled = true;
  refs.seekSlider.disabled = true;
  refs.instrumentList.innerHTML = "";
  refs.stageMap.innerHTML = "";
  refs.modelStack.innerHTML = "";
  refs.remasterGrid.innerHTML = "";
  refs.sectionList.innerHTML = "";
  refs.activeCount.textContent = "0 active";
  refs.modelTag.textContent = "대기";
  refs.remasterTag.textContent = "대기";
  refs.waveformTag.textContent = "대기";
  refs.currentTime.textContent = "0:00";
  refs.totalTime.textContent = "0:00";
  Object.values(refs.metrics).forEach((metric) => {
    metric.textContent = metric.tagName === "STRONG" ? "--" : "";
  });
  document.body.classList.remove("has-analysis", "is-busy");
  drawEmptyWaveform();
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
  drawWaveform(getPlaybackTime());
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

function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dbToGain(db) {
  return 10 ** (Number(db || 0) / 20);
}

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("resize", () => drawWaveform(getPlaybackTime()));
