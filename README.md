# Spatial Audio NEW

Demucs 딥러닝 stem 분리와 브라우저 Web Audio HRTF 렌더링을 결합한 로컬 공간음향 스튜디오입니다. 기존 객체 기반 확장 모드는 제거했고, 모든 재생 자원은 stem 기반 공간 배치, 초기반사, 룸 컨볼루션, 자동 리마스터링, 출력 리미터에 집중합니다.

## 핵심 구조

- `backend/audio_engine.py`: 음원 메타 분석, 자동 리마스터 프로필, Demucs 실행 및 stem 파일 제공
- `app.py`: FastAPI 서버, 오디오 업로드 API, 정적 프론트엔드와 `/outputs` stem 파일 제공
- `static/app.js`: Demucs stem 디코딩, stem별 HRTF panner, 초기반사, 룸 컨볼루션, 실시간 stem meter
- `static/styles.css`: Cloud Dancer 기반 라이트/다크 대시보드 UI

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

현재 로컬 환경은 `torch 2.5.1+cu121`, `torchaudio 2.5.1+cu121`, `demucs 4.0.1`로 맞춰져 있습니다. Demucs 첫 실행은 모델 가중치를 내려받을 수 있고, CPU에서는 곡 길이에 따라 오래 걸릴 수 있습니다.

개발 검증용 JavaScript 런타임은 Node.js LTS를 사용합니다. 현재 로컬에는 `node v24.15.0`이 설치되어 있습니다.

## 공간음향 방식

1. 업로드한 오디오는 분석 API에서 Demucs 분리를 기본 요청합니다.
2. Demucs가 성공하면 `vocals`, `other`, `drums`, `bass` stem을 브라우저가 각각 디코딩합니다.
3. 각 stem은 독립 HRTF panner, stem별 톤 보정, 초기반사, 룸 컨볼루션 send를 거쳐 공간 버스로 합쳐집니다.
4. 최종 출력에는 자동 리마스터 EQ/컴프레션과 리미터가 적용되어 공간 처리 중 클리핑과 음질 깨짐을 줄입니다.
5. Demucs가 실패하면 기존 NMF 기반 분석 결과로 기본 공간 렌더링 fallback을 수행합니다.
