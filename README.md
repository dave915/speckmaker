# Speck

디자이너와 개발자가 HTML 목업을 함께 리뷰하는 작업 공간입니다.

## 기능

- 프로젝트 생성과 프로젝트별 HTML 업로드: 파일당 5MB, 한 번에 최대 10개 파일
- HTML 탭 자동 감지와 별도 프레임 표시: 파일당 최대 12개 화면
- 캔버스 이동, 확대·축소(8–200%), 전체 화면 맞춤, 트랙패드 확대
- 기준 화면 높이와 함께 저장되는 핀 댓글, 답글, 해결·다시 열기
- 프로젝트 채팅, 참여자 표시, 공유 커서: 약 1.8초 주기로 서버 동기화
- D1 데이터베이스에 프로젝트·댓글·참여 정보 저장, R2에 HTML 원본 저장
- 모바일 프로젝트 메뉴, 접었다 펼치는 코멘트 패널

첫 접속에는 Luma 샘플 프로젝트와 사용 가이드 댓글 3개가 준비됩니다. 샘플의 대시보드 수치는 예시입니다.

## HTML 지원 범위

ARIA `role="tab"`, Bootstrap 탭, `data-tab`, 일반적인 탭 버튼 클래스와 `onclick` 기반 버튼을 감지합니다. 각각의 샌드박스 iframe에서 해당 탭을 활성화합니다. 자동 감지가 맞지 않으면 업로드 화면에서 한 화면으로 합칠 수 있습니다. 사용자 파일을 사이트 DOM에 직접 삽입하지 않으며 iframe은 `allow-scripts`만 허용합니다. iframe에 같은 출처 권한, 팝업, 폼 제출, 상위 페이지 탐색 권한은 부여하지 않습니다.

CSS, 이미지, JavaScript가 포함된 단일 HTML을 권장합니다. 로컬의 별도 파일 및 ZIP 업로드는 지원하지 않습니다. JavaScript 실행 후에만 생성되는 탭, 임의의 사용자 정의 탭 시스템, 프레임워크 라우터를 통한 페이지 전환은 자동 분리가 보장되지 않습니다. 프레임 폭은 740px이며 높이는 콘텐츠에 맞춰 자동으로 늘어납니다(최소 880px, 최대 20,000px). 내부 스크롤을 사용하는 앱의 스크롤 동작은 유지합니다. 기본 상태에서 버튼·링크·입력 폼을 바로 사용할 수 있고, H로 이동 모드, C로 코멘트 모드를 켭니다.

## 협업과 접근

프로젝트 링크에는 프로젝트 식별자가 포함됩니다. 사이트에 접근할 수 있는 사용자는 팀 워크스페이스의 모든 프로젝트를 볼 수 있습니다. 프로젝트별 역할, 초대 이메일, 사용자 인증 시스템은 별도로 구현하지 않았습니다. 배포 환경의 Sites 접근 제어가 적용되며 최초 배포는 비공개입니다. 실제 팀원과 사용하려면 사이트의 대상 사용자 범위를 설정해야 합니다.

프로필 이름·색상만 기기에 보관하며, 프로젝트와 업로드 및 대화 데이터의 원본은 서버에 저장됩니다. 실시간 동기화는 WebSocket 대신 짧은 주기 폴링을 사용합니다.

## 개발

Node.js 22.13 이상을 사용합니다.

```sh
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stormy_madame_web.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_legal_northstar.sql
npm run dev
```

마이그레이션은 로컬에서 한 번만 적용합니다. 배포 시에는 Sites가 production 마이그레이션을 적용합니다.

```sh
npx tsc --noEmit
npm run build
```

## 확인한 흐름

실제 브라우저 두 세션에서 프로젝트 생성 → HTML 업로드 → 세 탭의 서로 다른 내용 확인 → 핀 댓글 작성 → 다른 세션 동기화 → 답글 → 해결 처리 → 채팅 수신 → 새로고침 후 데이터 유지까지 확인했습니다. 확대 후 핀 크기가 27px로 유지되고 비율 좌표가 유지되는 것을 확인했습니다. 390px 모바일 화면의 가로 넘침, 프로젝트 메뉴와 코멘트 접근도 확인했습니다.

높이 자동 조절 수정 후에는 1,860px 목업의 프레임 높이·문서 높이·푸터 끝 좌표가 일치하는지 확인했습니다. 기본 클릭으로 콘텐츠가 2,280px, 2,700px로 늘어나는 동작, 입력 폼, 탭 전환, 목업 위 휠 이동·Ctrl 휠 확대, 880px 아래에 남긴 코멘트의 위치 유지도 검증했습니다.
