# Spatial Audio NEW

원본을 보존하는 dry path 위에 객체 기반 FIR HRTF binaural renderer를 더하는 로컬 오디오 분석/공간음향 스튜디오입니다.

`Original`은 디코딩된 원본 버퍼를 투명한 unity gain 출력 경로로 재생하며 Spatial engine과 stem analyser를 연결하지 않습니다. `Spatial`은 곡 분석값으로 wet layer, 360 radius, reflections 값을 자동 산출하고, 원본 dry 신호 위에 stem/mix 객체 렌더링, cached FIR HRTF, 360 orbit field를 별도 레이어로 섞습니다. Spatial과 Original 전환은 같은 gain envelope로 크로스페이드되어 끊김을 줄입니다. Stem 바와 음향 필드는 Spatial 모드에서만 Demucs stem analyser에 연결되어 재생 중 실시간 반응합니다.

## 핵심 구조

- `backend/audio_engine.py`: 오디오 메타데이터, 스펙트럼, stereo image, Demucs stem 분석
- `app.py`: FastAPI 서버, 오디오 업로드 API, 정적 프론트엔드와 `/outputs` stem 파일 제공
- `static/app.js`: 원본 직접 출력 path, 객체 기반 FIR HRTF spatial renderer, stem analyser UI
- `static/js/config.js`: stem 표시 정보와 실시간 악기 시그니처
- `static/js/utils.js`: API 경로, 포맷, DOM 업데이트 유틸
- `static/styles.css`: 라이트/다크 테마와 대시보드 UI

## 실행

```powershell
cd "D:\Code\Codex\Spatial Audio-NEW"
python -m uvicorn app:app --host 127.0.0.1 --port 8766
```

브라우저에서 `http://127.0.0.1:8766/`을 열면 됩니다.

## 설치

기본 패키지:

```powershell
pip install -r requirements.txt
```

Demucs 포함 패키지:

```powershell
pip install -r requirements-ml.txt
```

개발 검증용 JavaScript 테스트:

```powershell
npm install
npm run test:e2e
```

PowerShell 실행 정책 때문에 `npm`이 막힌 환경에서는 `npm.cmd install`, `npm.cmd run test:e2e`를 사용하면 됩니다.

## 현재 재생 방식

1. 업로드한 오디오는 분석 API에서 Demucs 분리를 기본 요청합니다.
2. Demucs가 성공하면 `spatial-q2` 품질 프로파일로 `vocals`, `other`, `drums`, `bass` stem을 생성하고, shift averaging/overlap/soft-mask cleanup 결과를 브라우저가 디코딩합니다.
3. `Original`은 음색 보정 없이 unity gain 출력 경로로 재생하며, 모드 전환 순간에만 크로스페이드 envelope가 적용됩니다.
4. Stem은 Spatial 모드에서만 별도 무음 analyser path로 연결되어 stem 반응 바와 음향 필드를 움직입니다. Original 모드에서는 Stem 바와 음향 필드가 0으로 고정됩니다.
5. `Spatial`은 원본 dry를 보존하고 stem 품질 메타데이터의 `spatialWeight`를 반영해 누설이 큰 stem의 wet layer를 과하게 키우지 않습니다.
6. Spatial 객체 renderer는 직접음은 짧은 FIR HRTF로 선명하게 유지하고, 반사/공간 레이어는 가벼운 delay/stereo panner 기반으로 처리해 ConvolverNode 부담을 줄였습니다. 현재 spatial cue는 확장 프로파일로 동작해 거리, 패닝, 초반사, horizon wrap을 넓게 배치합니다. 중앙 성분은 L/R 공통 mid만 완전 대칭 초반사로 넓혀서 주변 소리와 더 잘 섞이되 중심 위치가 흔들리지 않도록 합니다.
7. 두 번째 카드의 `Wet layer`, `360 radius`, `Reflections` 값은 곡 분석 결과에 따라 자동 설정됩니다.
8. 실측 BRIR 자동 탐색/디코딩 경로는 재생 중 부하와 초기 분석 지연을 줄이기 위해 제거했습니다. 현재 Spatial은 캐시된 synthetic FIR HRTF와 경량 반사 레이어를 사용합니다.

모드 전환은 새 그래프를 약간 미래 시점에 예약 시작해 기존 그래프와 샘플 위치를 맞추고, 동일 dry 신호가 겹쳐 커지지 않도록 linear constant-sum 크로스페이드를 사용합니다. `Original -> Spatial` 전환 시에는 Spatial wet layer를 dry 전환 뒤에 짧게 따라 올려 딜레이/더블링처럼 들리는 현상을 줄입니다.

## 재생 중 성능 관리

- `ScriptProcessorNode`는 사용하지 않습니다. 실시간 분석은 `AnalyserNode` 기반이며, live analyser는 2048 FFT, stem meter는 512 FFT로 제한합니다.
- 모든 실시간 UI 갱신은 60fps 목표로 고정합니다. Stem bar, 음향 필드, 스펙트럼 밴드 뷰, 파형 커서, 재생 시간 표시가 같은 60fps cadence를 사용하며 자동 품질 단계가 UI FPS를 낮추지 않습니다.
- 파형과 스펙트럼은 Canvas 기반으로 그리고, stem bar와 field DOM은 값 변화가 임계값을 넘을 때만 style/class/text를 갱신합니다.
- Stem 반응 바는 분석값을 그대로 쓰되 UI 전용 stem meter와 표시 압축 곡선을 적용합니다. 0% 근처에서는 빠르게 반응하지만 퍼센티지가 올라갈수록 증가율이 줄어들어, 높은 음량도 보통 80~90%에 머물고 99.97% 이상 극단 피크에서만 100% 구간이 열립니다.
- 재생 그래프 dispose 시 source, LFO, analyser, convolver, gain node를 모두 stop/disconnect해 retired graph가 남지 않도록 정리합니다.
