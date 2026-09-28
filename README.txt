Surgical SG Annotator
=====================

목적
----
수술 영상에서 Scene Graph relation, 사람 node의 field 상태, 임상 Action을
각각 별도의 시간 구간 annotation으로 저장하는 로컬 웹 도구입니다.

실행
----
1. OPEN_SG_ANNOTATOR.html을 Chrome, Edge 또는 Safari로 엽니다.
2. 영상 열기에서 MP4 또는 MOV 파일을 선택합니다. 화면 배치는 상단 2개 view와
   하단 Surgeon, Assistant, Nurse POV 3개 view를 기준으로 합니다.
3. 영상을 열면 Surgeon POV가 기본 확대됩니다. 전체 5-view와 각 개별 view 버튼도
   그대로 사용할 수 있으며, '영상 크게'를 누르면 영상만 넓게 확인할 수 있습니다.
4. Annotate 상단의 공통 작업 구간에서 Start·End frame을 한 번 지정합니다.
5. Node 목록에서 Person을 클릭하면 사람 입력란에, Instrument/Other 또는 Anatomy를
   클릭하면 SG Object에 자동으로 입력됩니다.
6. SG Relation, Node State, Action 중 하나를 선택해 저장합니다. SG를 저장한 뒤에는
   작업 구간과 Subject가 유지되므로 같은 구간의 여러 관계를 연속 입력할 수 있습니다.
7. 작업 중에는 임시 저장을 누르고, 완료 후 JSON 내보내기를 누릅니다.

기존 JCM Action JSON 가져오기
-----------------------------
- JSON 불러오기에서 기존 version 2 JCM labeling 파일을 선택할 수 있습니다.
- kind가 action인 항목은 Surgeon 중심 Action으로 현재 프로젝트에 병합합니다.
- kind가 triplet인 자유 서술 항목은 SG로 자동 변환하지 않고 REVIEW 항목으로 보존합니다.
- 타임라인의 '기록 검토'를 누른 뒤 '검토 필요' 필터에서 REVIEW 항목을 확인할 수 있습니다.
- 'Action 전환'을 누르면 label과 note를 정리한 뒤 정식 Action으로 저장할 수 있습니다.
- 기존 SG Relation과 Node State는 유지되며, 같은 legacy source ID는 중복으로 가져오지 않습니다.
- 현재 영상과 JSON의 전체 프레임 수가 크게 다르면 가져오기 전에 경고합니다.

재생 속도
---------
0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x를 지원합니다.

프레임 이동
-----------
- 재생 제어의 Frame 입력란에 번호를 입력하고 Enter 또는 '이동'을 누르면 정확한
  프레임으로 이동합니다.
- 슬라이더는 긴 구간을 빠르게 탐색할 때 사용하고, 정확한 위치는 Frame 입력란이나
  단축키로 조정합니다.

단축키
------
Space       재생 또는 정지
Left/Right  이전 또는 다음 frame
Shift+Left/Right  10 frame 이동
Alt+Left/Right    100 frame 이동
I           현재 frame을 Start로 지정
O           현재 frame을 End로 지정

중요
----
- 상단 아이콘은 로컬 환경에서도 확실히 보이는 SVG로 세 Node와 이를 연결하는 Edge를
  표현하며, 브라우저 탭 아이콘에도 동일한 Scene Graph 구성을 사용합니다.
- macOS에서는 .command 실행이 필요하지 않습니다. OPEN_SG_ANNOTATOR.html을
  더블클릭하세요.
- 데스크톱에서는 Chrome 확대 100%를 기준으로 전체 작업 영역이 브라우저 한 화면에
  맞춰집니다.
- 하단에는 별도의 기록 바를 두지 않습니다. 타임라인 우측의 '기록 검토'를 누르면
  우측 Annotate/Node 영역이 스크롤 가능한 기록 검토 패널로 전환됩니다. 영상은
  왼쪽에 계속 표시되며 가려지지 않습니다. '라벨 입력으로 돌아가기' 또는 Esc 키로
  검토 모드를 닫을 수 있습니다.
- 기록 검토 전환 전후에도 영상 패널의 폭과 높이는 동일하게 유지됩니다.
- 검토 모드에서 '이동'은 패널을 유지한 채 영상 위치만 변경합니다. '수정'이나
  'Action 전환'을 누르면 검토 모드를 닫고 해당 입력 폼으로 자동 복귀합니다.
- 기록 검토 상단의 종류 버튼으로 전체, SG, State, Action, 검토 필요 항목을 즉시
  구분하고 Frame 오름차순·내림차순 또는 종류별로 정렬할 수 있습니다.
- 기록의 '이동'을 누르면 영상이 시작 frame으로 이동하며, 해당 시작·종료 frame이
  세 Annotation 입력 폼에 함께 적용됩니다. 라벨 입력으로 돌아가 원하는 종류를 선택하면
  frame 값을 다시 입력하지 않고 새 라벨을 작성할 수 있습니다.
- 상단 중앙의 현재 구간 박스에는 frame 범위가 가장 먼저 표시되고, 그 뒤에 해당
  Action 내용과 SG·State·Review 개수가 표시됩니다. 종류 버튼을 누르면 선택 구간과
  겹치는 Annotation을 바로 확인할 수 있습니다.
- 검토 필요 항목은 'Action 전환 · 이동 · 수정 · 삭제' 순서로 표시됩니다. 수정은
  검토 항목 자체를 고치고, Action 전환은 정식 Action으로 변환합니다.
- 같은 frame 구간에는 서로 다른 SG·State·Action을 여러 개 저장할 수 있지만, 종류와
  핵심 내용까지 동일한 Annotation은 중복 저장되지 않습니다. Note 차이만으로는 별도
  Annotation으로 간주하지 않습니다.
- 데스크톱의 Node 선택 목록은 Person, Instrument / Other, Anatomy 세 구역으로
  나뉘며 각 구역은 2열로 배치됩니다. 항목이 많아지면 해당 구역만 독립적으로
  스크롤됩니다. 각 구역 안에서는 이름순으로 자동 정렬됩니다. Instrument와 Other는
  같은 구역에 표시되지만 JSON에서는 서로 다른 Category로 저장됩니다.
- 선택하지 않은 Node는 투명하고 선택한 Node만 회색으로 표시됩니다. Person을
  클릭하면 Subject·Actor·Person node에, 나머지 Node는 SG Object에 자동 적용됩니다.
- + Node로 추가한 항목은 현재 프로젝트에 누적되며, 임시 저장과 JSON 내보내기에
  포함됩니다. 동일한 Node ID의 중복 추가는 허용되지 않습니다.
- 기본 제공 Node와 사용자가 추가한 Node 모두 선택하면 Node 선택 헤더의 수정 버튼이
  활성화됩니다. 표시 이름, Category, Node ID를 수정할 수 있으며 ID가 바뀌면 기존
  annotation의 참조도 함께 갱신됩니다.
- + Node 버튼은 Node 목록 관리 기능임을 명확히 하기 위해 Node 선택 헤더에
  배치됩니다. Annotate 헤더에는 현재 선택한 Node만 표시합니다.
- Node 개수는 Node 선택 제목 바로 옆의 작은 숫자 배지로 표시하고, + Node 버튼은
  헤더 오른쪽 끝에 분리해 배치합니다.
- 넓은 데스크톱에서는 영상 열을 줄여 영상 좌우의 검은 여백을 최소화하고,
  Annotate와 Node 선택 패널을 좌우로 나란히 배치합니다.
- 전체 작업 화면은 1600x900의 16:9 기준 비율로 고정됩니다. 브라우저 창이 작을 때만
  통째로 축소되며, 큰 창에서는 1600x900보다 확대하지 않습니다. 남는 공간에는 여백이
  생기지만 패널 비율은 바뀌지 않습니다. 축소 전 레이아웃 크기와 관계없이 실제
  브라우저 화면 중앙에 고정되므로 Chrome 100%에서도 한쪽으로 치우치지 않습니다.
- 전체 화면을 감싸는 바깥쪽 테두리는 표시하지 않고 내부 작업 패널만 구분합니다.
- SG Relation, Node State, Action의 저장 버튼은 동일한 파란색으로 표시됩니다.
- 세 Annotation 저장 버튼은 입력 항목 수와 관계없이 동일한 52px 높이로 표시됩니다.
- 세 탭의 단일 입력칸은 42px, Note 입력칸은 72px로 통일됩니다. 목록 선택과 직접
  입력 칸은 같은 폭으로 표시되고, 선택 여부 안내는 Note 제목과 같은 줄에 배치됩니다.
- Node의 MASK/CATEGORY 배지는 내용 구분에 필요한 최소 크기로 표시됩니다.
- 모든 활성 버튼은 마우스를 올렸을 때 밝기와 테두리 반응으로 클릭 가능 상태를 표시합니다.
- Node 카드는 고정 높이로 정렬되며 긴 이름과 역할은 말줄임으로 표시됩니다. Annotate
  상단에는 현재 선택한 Node의 이름과 할당 색상을 함께 표시합니다.
- 영상에서 선택한 Node의 상태 표시는 영상 픽셀을 가리지 않도록 제목 줄에 표시됩니다.
- 영상은 로컬 브라우저에서만 열리며 도구에 포함되거나 외부로 전송되지 않습니다.
- 현재 표시되는 사람 mask는 UI 시험을 위한 mock placeholder입니다.
- 내보낸 JSON의 grounding.is_placeholder가 true인 mask는 segmentation 정답으로
  사용하면 안 됩니다.
- 실제 사람 mask와 tracking 결과가 생기면 entity_id와 실제 track_id의 mapping으로
  mock grounding을 교체할 수 있습니다. 기존 SG relation은 수정할 필요가 없습니다.
- Instrument, Other, Anatomy node는 현재 category-only node이며 mask나 track_id가 없습니다.
- Predicate와 Action label은 기존 목록에서 선택하거나 직접 입력할 수 있습니다.
  직접 입력한 새 값은 저장 시 목록에 자동 등록됩니다. 새 SG를 저장하면 Predicate만
  비워지고 작업 구간은 유지됩니다.
- Field zone의 기준이 연구팀에서 확정되기 전에는 기본값인 Unknown을 사용합니다.
- 이름을 모르는 물체는 기본 제공되는 Unknown item을 선택하고 Note에 특징을
  기록한 뒤 추후 검토합니다.

저장 구조
---------
sg_relations  화면에서 관찰되는 subject-predicate-object
node_states   사람 node의 field 안/밖 및 좌/우 상태
actions       임상적으로 의미 있는 표준 수술 action과 note
grounding     사람 mask와 tracking 연결 정보

기본 Node 색상
--------------
Surgeon 빨강, Assistant 1 파랑, Assistant 2 초록, Nurse (Scrub) 노랑,
Nurse (Circulator) 보라로 표시합니다. Instrument는 모두 회색, Anatomy는 모두
주황색으로 통일하며, Other는 Instrument와 구분되는 중립 회색으로 표시합니다.

기존 버전에서 저장한 초안이나 JSON을 불러오면 Operator/Assistant/Nurse 명칭과
연결된 annotation 참조를 새 역할 체계로 자동 변환합니다. 기존 object Category와
Unknown object도 각각 other와 Unknown item으로 변환하며 SG 연결은 유지됩니다.
