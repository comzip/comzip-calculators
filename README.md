# 계산기 허브 (Calculator Hub)

일상에 필요한 계산기(만나이, 연봉 실수령액 등)를 한곳에 모은 한국어 정적 사이트입니다.
[Astro](https://astro.build)로 만든 완전 정적 사이트이며, GitHub Pages + 커스텀 도메인
배포를 전제로 설계되었습니다. 백엔드/서버 없이 브라우저에서 모든 계산이 동작합니다.

## 로컬에서 실행하기

```bash
npm install
npm run dev
```

개발 서버가 뜨면 안내되는 주소(기본 `http://localhost:4321`)를 브라우저에서 엽니다.

| 명령어            | 설명                                   |
| ----------------- | -------------------------------------- |
| `npm install`     | 의존성 설치                            |
| `npm run dev`     | 개발 서버 실행                         |
| `npm run build`   | `dist/`에 정적 사이트 빌드             |
| `npm run preview` | 빌드 결과물을 로컬에서 미리보기        |

## 새 계산기 추가하기

계산기 목록의 단일 소스는 `src/data/calculators.ts` 입니다. 새 계산기를 추가하려면
두 곳만 손대면 됩니다:

1. `src/data/calculators.ts`의 `calculators` 배열에 항목을 하나 추가합니다.
   (`{ slug, title, category, description }`) 새 카테고리가 필요하면
   `CalculatorCategory` 타입과 `categoryOrder` 배열에도 추가하세요.
2. `src/pages/calculators/<slug>.astro` 파일을 만들어 계산기 페이지를 작성합니다.
   기존 페이지(`age-calculator.astro`, `salary-calculator.astro`)를 참고하세요.

홈페이지 카드와 상단 네비게이션은 이 데이터 파일에서 자동으로 생성되므로, 별도의
목록을 따로 관리할 필요가 없습니다.

계산 로직이 복잡하면 `src/lib/`에 순수 TypeScript 모듈로 분리해 두고 페이지의 클라이언트
스크립트에서 import 하세요. (예: `src/lib/salaryCalculator.ts`)

## GitHub Pages 배포 마무리

`.github/workflows/deploy.yml`에 표준 Astro → GitHub Pages 배포 워크플로가 포함되어
있습니다. `main` 브랜치에 push 하거나 Actions 탭에서 수동 실행하면 빌드 후 자동
배포됩니다. 처음 배포하기 전 다음을 설정하세요:

1. **도메인** — 메인 도메인은 `comzip.com`으로 설정되어 있습니다
   (`public/CNAME`, `astro.config.mjs`의 `site` 값 모두 반영됨).
   `comzip.net`은 아래 3번처럼 `comzip.com`으로 리다이렉트되도록 별도 설정합니다.
2. **DNS 설정 (comzip.com → GitHub Pages)** — 도메인 등록업체 DNS에서 아래처럼 설정합니다.
   - Apex 도메인(`comzip.com`)에 A 레코드 4개 추가:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (또는 등록업체가 ALIAS/ANAME을 지원하면 `<사용자명>.github.io`로 지정해도 됩니다)
   - `www.comzip.com`을 쓸 계획이면 `<사용자명>.github.io`로 향하는 CNAME 레코드 추가
   - 저장소 → Settings → Pages → Source를 **"GitHub Actions"**로 지정, Custom domain에
     `comzip.com` 입력 → DNS 전파 후 **"Enforce HTTPS"** 체크
3. **comzip.net → comzip.com 리다이렉트** — 이건 GitHub Pages가 아니라 `comzip.net`을
   구매한 등록업체(가비아/Cafe24/Namecheap 등)의 **도메인 포워딩(Domain Forwarding)**
   기능으로 처리합니다. GitHub Pages CNAME 파일에는 도메인을 하나만 넣을 수 있어서,
   두 번째 도메인은 이 프로젝트 코드가 아니라 등록업체 콘솔에서 설정해야 합니다.
   - 등록업체 관리 콘솔에서 `comzip.net` → 포워딩(Forwarding/리다이렉트) 설정
   - 대상 URL: `https://comzip.com` (301/영구 리다이렉트, 마스킹 없이)
   - 정확한 메뉴 위치는 등록업체마다 다르니, 어느 곳에서 구매하셨는지 알려주시면
     구체적으로 안내해드릴게요.

> `base` 경로는 설정하지 않았습니다. 커스텀 도메인은 루트(`/`)에서 서빙되기 때문입니다.
> 만약 `<사용자명>.github.io/<repo>` 형태의 프로젝트 페이지로 배포하려면
> `astro.config.mjs`에 `base`를 추가하고 CNAME을 제거해야 합니다.

## AdSense / 법적 페이지 안내 (실서비스 전 필수)

수익화(AdSense/제휴 링크)를 붙이기 전에 반드시 아래 자리표시자를 실제 콘텐츠로
교체해야 합니다:

- `src/components/AdSlot.astro` — 실제 광고 코드가 아닌 빈 자리표시자입니다.
  AdSense 승인 후 실제 광고 유닛 마크업으로 교체하세요.
- `src/pages/privacy.astro` (개인정보처리방침) / `src/pages/terms.astro` (이용약관) —
  둘 다 자리표시자 텍스트이며 `TODO` 표시가 있습니다. AdSense 신청 전에 실제 정책·약관
  문구로 채워야 합니다.

또한 각 계산기의 결과는 **참고용 추정치**입니다. 특히 연봉 실수령액 계산기는 국세청
간이세액표가 아닌 단순화된 근사식을 사용하므로 실제 원천징수액과 차이가 있을 수
있습니다.
