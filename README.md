# Surgical SG Annotator

수술 영상에서 **Scene Graph Relation**, **Node State**, **Action**을 프레임 구간 단위로 기록하는 로컬 웹 기반 라벨링 도구입니다.

영상과 라벨 데이터는 사용자의 브라우저에서만 처리되며, 서버로 자동 전송되지 않습니다.

> **연구용 소프트웨어 / Research use only:** 본 도구는 연구용 프로토타입이며 임상 진료 또는 의료기기 용도로 제작되지 않았습니다. This software is a research prototype and is not intended for clinical use.

## 주요 기능

- 전체 5-view와 개별 view 전환 및 수술 영상 확대 보기
- 프레임 번호 직접 입력, ±1/10/100 frame 이동 및 단축키 지원
- 하나의 공통 Start/End 구간에 여러 SG·State·Action 기록
- Person, Instrument, Other, Anatomy Node 추가·수정 및 이름순 정렬
- 선택한 Node를 Annotation 입력란에 자동 반영
- Predicate와 Action label 목록 선택 또는 직접 입력
- 저장된 Annotation의 종류별 필터, 프레임 정렬, 이동·수정·삭제
- 같은 프레임과 내용의 중복 Annotation 생성 방지
- 기존 JCM Action JSON 병합 및 검토 항목 전환
- 작업 중 임시 저장과 최종 JSON 내보내기

## 빠른 시작

별도의 설치나 서버 실행이 필요하지 않습니다.

1. 저장소를 내려받거나 ZIP 파일의 압축을 풉니다.
2. `OPEN_SG_ANNOTATOR.html`을 Chrome, Edge 또는 Safari로 엽니다.
3. 상단의 **영상 열기**에서 MP4 또는 MOV 파일을 선택합니다.
4. 공통 작업 구간의 Start/End frame을 지정합니다.
5. Node와 `SG Relation`, `Node State`, `Action` 탭 중 하나를 선택해 라벨을 저장합니다.
6. 작업 중에는 **임시 저장**, 완료 후에는 **JSON 내보내기**를 사용합니다.

> macOS에서도 `.command` 파일은 필요하지 않습니다. `OPEN_SG_ANNOTATOR.html`을 더블클릭하면 됩니다.

## Annotation 종류

| 종류 | 저장 내용 |
| --- | --- |
| SG Relation | 화면에서 관찰되는 `subject–predicate–object` 관계 |
| Node State | 사람 Node의 field 안/밖 및 좌/우 상태 |
| Action | 임상적으로 의미 있는 수술 행동과 선택적 Note |
| Grounding | 사람 Node와 mask·tracking 결과의 연결 정보 |

같은 프레임 구간에 서로 다른 Annotation을 여러 개 저장할 수 있습니다. 종류, 프레임 구간, 핵심 내용이 모두 같은 항목은 중복 저장되지 않습니다.

## 기본 Node 체계

| Category | 예시 | 표시 색상 |
| --- | --- | --- |
| Person | Surgeon, Assistant 1·2, Nurse (Scrub), Nurse (Circulator) | 역할별 고유 색상 |
| Instrument | Saw, Retractor, Scalpel | 회색 |
| Other | Unknown item 등 비기구 물체 | 중립 회색 |
| Anatomy | Patient leg, Surgical site | 주황색 |

Instrument와 Other는 화면에서 같은 구역에 표시되지만 JSON에는 서로 다른 Category로 저장됩니다. Category는 Node 수정 기능을 통해 나중에 변경할 수 있으며, 기존 Annotation 참조는 유지됩니다.

## 프레임 이동 단축키

| 키 | 동작 |
| --- | --- |
| `Space` | 재생 또는 정지 |
| `←` / `→` | 이전 또는 다음 frame |
| `Shift` + `←` / `→` | 10 frame 이동 |
| `Alt` + `←` / `→` | 100 frame 이동 |
| `I` | 현재 frame을 Start로 지정 |
| `O` | 현재 frame을 End로 지정 |
| `Esc` | 기록 검토 닫기 |

## 기존 JSON 가져오기

**JSON 불러오기**에서 기존 version 2 JCM 라벨링 파일을 선택할 수 있습니다.

- `kind: action` 항목은 Surgeon 중심 Action으로 병합됩니다.
- 자유 서술 triplet은 자동 SG 변환 대신 `REVIEW` 항목으로 보존됩니다.
- 기록 검토에서 내용을 확인한 후 정식 Action으로 전환할 수 있습니다.
- 같은 legacy source ID는 중복으로 가져오지 않습니다.
- 영상과 JSON의 전체 프레임 수가 크게 다르면 병합 전에 경고합니다.

## 프로젝트 구조

```text
OPEN_SG_ANNOTATOR.html   # 로컬 실행 진입점
START_SG_ANNOTATOR.bat  # Windows 실행 보조 파일
dist/
  index.html            # 애플리케이션 화면
  app.js                # Annotation 로직과 상태 관리
  styles.css            # UI 스타일
README.txt              # 상세 사용 및 구현 안내
```

## 데이터 및 보안 주의

- 수술 영상은 로컬 브라우저에서만 열리며 저장소나 내보낸 JSON에 포함되지 않습니다.
- 실제 수술 영상, 환자 식별 정보, 기관 내부 라벨 파일은 GitHub에 커밋하지 마세요.
- 현재 사람 mask는 UI 시험용 mock placeholder입니다.
- `grounding.is_placeholder: true`인 mask는 segmentation 정답으로 사용하면 안 됩니다.
- Field zone 기준이 연구팀에서 확정되기 전에는 `Unknown`을 사용합니다.
- 이름을 모르는 물체는 `Unknown item`으로 기록하고 Note에 특징을 남깁니다.

## 개발 및 변경 이력

변경사항은 하나의 검증된 기능 또는 수정 단위로 커밋하며 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 사용합니다.

```text
feat: add node category editing
fix: prevent duplicate scene graph annotations
docs: update labeling workflow
```

배포 가능한 주요 버전에는 `v0.1.0`과 같은 Git tag를 추가할 수 있습니다.

## 소속

서울대학교병원 융합의학기술원 융합의학과 · Medical Vision Lab
