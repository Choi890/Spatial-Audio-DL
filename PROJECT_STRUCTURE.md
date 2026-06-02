# Spatial Audio-NEW 프로젝트 구조 설명

## 프로젝트 한줄 설명

FastAPI 백엔드와 정적 프론트엔드를 결합한 공간 오디오 분석/렌더링 프로젝트입니다. 업로드한 오디오를 분석하고 공간화 파라미터와 UI를 통해 원본/공간 오디오 재생을 제어합니다.

## 기본 작동 흐름

- app.py가 FastAPI 서버와 업로드/분석/정적 파일 라우팅을 제공합니다.
- backend/audio_engine.py가 오디오 메타데이터, 스펙트럼, 스템/공간화 분석 값을 계산합니다.
- static의 JavaScript/CSS/HTML이 브라우저 UI, Web Audio 렌더링, 분석 결과 표시를 담당하고 tests가 API와 UI 동작을 검증합니다.

## 문서 기준

- 아래 목록은 `git ls-files`로 확인되는 Git 추적 파일을 기준으로 작성했습니다.
- `.git`, `node_modules`, `build`, `.gradle`, 임시 업로드/출력물처럼 Git이 관리하지 않는 폴더는 제외했습니다.
- 폴더 표는 코드와 자산이 어떤 책임으로 나뉘는지, 파일 표는 각 파일이 실제로 무엇을 담당하는지 설명합니다.

## 폴더별 설명 (9개)

| 폴더 | 설명 |
| --- | --- |
| `.` | 프로젝트 루트입니다. 실행/빌드 설정, README, 전체 구조 문서, 최상위 진입 파일이 모여 있습니다. |
| `backend` | FastAPI 서버가 호출하는 Python 백엔드 로직 폴더입니다. 오디오 분석과 엔진 코드를 분리해 둡니다. |
| `data` | 런타임 데이터 폴더입니다. 업로드 파일, 출력 파일, BRIR 같은 처리용 데이터를 구분합니다. |
| `data/brir` | 공간 오디오 렌더링에 사용할 BRIR/HRTF 관련 데이터를 보관하기 위한 폴더입니다. |
| `data/outputs` | 분석 또는 공간 오디오 처리 결과물을 저장하기 위한 자리 표시자/런타임 폴더입니다. |
| `data/uploads` | 사용자가 업로드한 오디오 파일을 저장하기 위한 자리 표시자/런타임 폴더입니다. |
| `static` | 브라우저로 내려가는 정적 프론트엔드 파일 폴더입니다. HTML, CSS, JavaScript가 이 아래에 있습니다. |
| `static/js` | 프론트엔드 공통 설정과 유틸리티 JavaScript 모듈을 보관합니다. |
| `tests` | 자동 테스트 폴더입니다. Python 단위 테스트나 Playwright 브라우저 테스트가 들어 있습니다. |

## 파일별 설명 (22개)

| 파일 | 설명 |
| --- | --- |
| `.gitignore` | Git에 올리지 않을 빌드 산출물, 캐시, 개인 환경 파일을 지정하는 설정 파일입니다. 저장소에는 필요한 소스/자산만 남기도록 도와줍니다. |
| `app.py` | Python/FastAPI 서버의 진입 파일입니다. 업로드 요청, 분석 요청, 정적 UI 제공, 결과 파일 접근 경로를 묶어 백엔드를 실행합니다. |
| `backend/__init__.py` | 해당 폴더를 Python 패키지로 인식시키는 초기화 파일입니다. 필요하면 패키지 공개 API를 이곳에서 정리합니다. |
| `backend/audio_engine.py` | 오디오 파일의 메타데이터, 스펙트럼, 공간화에 필요한 분석 값을 계산하는 백엔드 엔진 코드입니다. |
| `data/brir/.gitkeep` | 빈 런타임 폴더도 Git에 남겨 두기 위한 자리 표시자 파일입니다. 실제 업로드/출력 파일은 실행 중 생성됩니다. |
| `data/outputs/.gitkeep` | 빈 런타임 폴더도 Git에 남겨 두기 위한 자리 표시자 파일입니다. 실제 업로드/출력 파일은 실행 중 생성됩니다. |
| `data/uploads/.gitkeep` | 빈 런타임 폴더도 Git에 남겨 두기 위한 자리 표시자 파일입니다. 실제 업로드/출력 파일은 실행 중 생성됩니다. |
| `package.json` | Node.js 프로젝트의 스크립트, 의존성, 개발 도구 설정을 정의합니다. |
| `package-lock.json` | npm 의존성의 정확한 버전을 고정해 다른 PC에서도 같은 패키지 조합으로 설치되게 합니다. |
| `playwright.config.js` | Playwright 브라우저 테스트 실행 환경, 테스트 폴더, 서버 옵션을 지정하는 설정 파일입니다. |
| `PROJECT_STRUCTURE.md` | 프로젝트의 모든 주요 폴더와 Git 추적 파일을 한글로 설명하는 구조 문서입니다. 처음 보는 사람이 경로별 역할을 빠르게 파악하기 위해 추가했습니다. |
| `README.md` | 프로젝트 개요, 실행 방법, 주요 기능을 설명하는 기본 안내 문서입니다. |
| `requirements.txt` | Python 실행에 필요한 기본 패키지 목록입니다. `pip install -r requirements.txt`로 설치합니다. |
| `requirements-ml.txt` | 머신러닝/오디오 분리처럼 무거운 선택 기능에 필요한 Python 패키지 목록입니다. |
| `start.ps1` | Windows PowerShell에서 프로젝트 서버나 개발 환경을 빠르게 실행하기 위한 시작 스크립트입니다. |
| `static/app.js` | Spatial Audio-NEW 프론트엔드의 중심 JavaScript 파일입니다. UI 상태, Web Audio 재생, 공간화 렌더링, 분석 결과 표시를 담당합니다. |
| `static/index.html` | 브라우저 앱의 기본 HTML 문서입니다. 화면 뼈대, 스크립트/CSS 연결, 주요 DOM 영역을 정의합니다. |
| `static/js/config.js` | 프론트엔드에서 재사용하는 설정값과 표시 옵션을 모아 둔 JavaScript 설정 모듈입니다. |
| `static/js/utils.js` | API 경로 구성, 포맷팅, DOM 보조 처리처럼 여러 화면 로직이 공유하는 유틸리티 함수 모음입니다. |
| `static/styles.css` | 웹 화면의 레이아웃, 색상, 간격, 반응형 스타일을 정의하는 CSS 파일입니다. |
| `tests/spatial-ui.spec.js` | Playwright로 브라우저 UI를 열어 업로드/재생/화면 표시 같은 공간 오디오 웹 동작을 검증하는 E2E 테스트입니다. |
| `tests/test_audio_engine.py` | Python 오디오 엔진의 분석 결과와 예외 처리를 검증하는 pytest 테스트 파일입니다. |

## 읽는 방법

- 먼저 폴더별 설명에서 큰 기능 묶음을 확인한 다음, 파일별 설명에서 실제 구현 파일을 찾으면 됩니다.
- Android 프로젝트는 `app/src/main/java` 아래 Kotlin 파일이 핵심 코드이고, `app/src/main/res`와 `app/src/main/assets`는 화면/모델/오디오 자산입니다.
- 웹 프로젝트는 `index.html`, `styles.css`, `script.js` 또는 `app.js`가 화면 구조, 스타일, 동작을 나눠 담당합니다.
- Python 프로젝트는 루트의 실행 스크립트와 `src`, `backend`, `scripts`, `tests` 폴더를 함께 보면 처리 흐름을 이해할 수 있습니다.
