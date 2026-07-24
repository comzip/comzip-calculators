# CLAUDE.md

이 문서는 콤집계산기(comzip.com) 프로젝트에서 작업하는 모든 LLM 세션이 읽어야 하는
프로젝트 메모리입니다. Claude Code는 이 저장소를 열 때마다 이 파일을 자동으로
불러오므로, 별도 세션·별도 사람이 이어받아도 아래 구조와 원칙을 따르면 기존
작업과 일관되게 개발을 계속할 수 있습니다.

## 프로젝트가 무엇인가

- **콤집계산기 / Comzip Calculators** — 만나이·연봉·세금·부동산 등 일상에 필요한
  계산기를 모아둔 무료 정적 사이트.
- [Astro](https://astro.build) 정적 사이트, GitHub Pages + 커스텀 도메인
  (comzip.com, comzip.net 포워딩)으로 배포. 백엔드 없음 — 모든 계산은 브라우저에서
  클라이언트 스크립트로 실행됨.
- 한국어(루트, `/`)와 영어(`/en/`) 두 언어를 지원하며, 헤더의 언어 전환 버튼으로
  이동. 신규 계산기·정책 페이지는 항상 두 언어 버전을 함께 만든다.
- GA4, Google AdSense, Google Search Console 연동 완료. SEO를 위한 sitemap/robots.txt
  자동 생성(`@astrojs/sitemap`).

## 파일 구조와 데이터 흐름

```
src/data/calculators.ts   ← 전체 계산기 목록의 단일 진실 공급원(SSOT)
src/i18n/ui.ts             ← 헤더/푸터 등 공통 UI 문자열 사전 (ko/en)
src/layouts/BaseLayout.astro
                            ← 헤더 nav, 푸터, 전역 CSS, GA4/AdSense, hreflang,
                               언어 전환 버튼을 전부 여기서 관리
src/components/            ← CalculatorCard, AdSlot (둘 다 lang prop을 받음)
src/lib/*Calculator.ts     ← 계산 로직 (순수 함수, DOM/Astro 비의존)
src/lib/formatKoreanWon.ts ← 금액 표기: formatKoreanWon(한글 억/만 단위, ko 페이지용),
                               formatWonEn(₩ + 쉼표, en 페이지용)
src/pages/calculators/*.astro     ← 한글 계산기 페이지
src/pages/en/calculators/*.astro  ← 영문 계산기 페이지 (한글판과 1:1 대응)
src/pages/{index,privacy,terms}.astro     ← 한글 홈/정책
src/pages/en/{index,privacy,terms}.astro  ← 영문 홈/정책
LEGAL_REFERENCES.md        ← 각 계산기가 참조하는 법령·기준값의 인덱스 (아래 참고)
```

**계산기 하나를 추가/수정할 때 건드리게 되는 파일들:**
1. `src/lib/<name>Calculator.ts` — 순수 계산 함수 (입출력 타입 정의 포함)
2. `src/pages/calculators/<slug>.astro` — 한글 페이지 (폼 + 결과 + FAQ)
3. `src/pages/en/calculators/<slug>.astro` — 영문 페이지 (같은 id/class, 텍스트만 번역)
4. `src/data/calculators.ts`에 항목 추가 (`title`/`titleEn`, `navLabel`/`navLabelEn`,
   `description`/`descriptionEn`, `category`) — 이것만 하면 홈 카드와 헤더 nav에
   자동으로 반영됨. 별도로 하드코딩된 목록은 없다.
5. 법령·고시가격 등 외부 기준값을 쓴다면 `LEGAL_REFERENCES.md`에 항목을 추가하고,
   `.ts` 파일 상단 주석에 `📋 법령 현황 추적: ... LEGAL_REFERENCES.md → "섹션명"`
   형태로 상호 참조를 남긴다 (기존 lib 파일들 참고).

## 핵심 원칙

**단일 진실 공급원을 지킨다.** 계산기 메타데이터(제목/설명/카테고리)는
`calculators.ts`에만 존재한다. 홈페이지·헤더 nav·meta 태그가 전부 이 배열에서
파생되므로, 페이지에 제목을 하드코딩하지 않는다.

**공통 스타일은 `BaseLayout.astro`의 전역 CSS에만 정의한다.** `.calc-form`,
`.result-grid`, `.result-item`, `table.breakdown`, `.disclaimer`, `.faq`,
`.method-toggle`, `.method-option`, `.check-row`, `.amount-preview` 등은 이미
전역으로 정의돼 있다. 새 페이지에서 이 클래스들을 로컬 `<style>`로 다시
정의하지 않는다 — 과거에 이것 때문에 새 페이지만 스타일이 깨지는 버그가 여러 번
있었다.

**입력 필드에 인위적 반올림 제한을 걸지 않는다.** 금액류 `<input type="number">`는
`step="any"`를 쓴다. `step="100000"` 같은 값은 브라우저가 배수가 아닌 값을 거부하고
"근사값을 입력하라"고 안내하게 만드는데, 이는 사용자가 정확한 금액을 입력하지
못하게 막는 결과가 된다. 나이·개월수처럼 정수만 의미 있는 필드(`step="1"`)나
이율처럼 의도적으로 소수 자릿수를 제한한 필드(`step="0.01"` + 커스텀 검증)는
예외.

**영문 페이지 작성 시 절대 건드리면 안 되는 것들:**
- `<select>`/`<input type="radio">`의 Korean literal `value="..."` (예:
  `value="원리금균등"`)는 그대로 유지한다 — 계산 함수가 이 문자열을 그대로
  받는 타입(`LoanMethod` 등)이기 때문. 보이는 라벨 텍스트만 번역한다.
- element `id`, CSS class명은 한글판과 동일하게 유지한다 — 전역 CSS와 클라이언트
  스크립트의 `getElementById`가 이걸 참조한다.
- import 경로는 `src/pages/en/calculators/`가 한 단계 더 깊으므로 `../../../`로
  보정한다.
- `<BaseLayout path=...>`는 `/en` 접두사 없는 로케일-중립 경로를 받는다
  (`path={`/calculators/${meta.slug}`}`) — 레이아웃이 내부적으로 `/en`을 붙인다.
- 내비게이션 드롭다운에는 `title`이 아니라 `navLabel`/`navLabelEn`(괄호 없는 짧은
  버전)을 쓴다. 모바일 폭에서 긴 영문 제목이 넘치는 문제를 이렇게 해결했다.

**Astro 스코프 스타일의 함정.** Astro는 정적 템플릿에 작성된 엘리먼트에만
`[data-astro-cid-*]`를 자동으로 붙인다. 클라이언트 `<script>`에서
`document.createElement`로 만든 엘리먼트(예: 대출 상환 스케줄 테이블의 `<tr>`)는
이 속성이 없으므로, 스코프드 `<style>`의 선택자가 절대 매치되지 않는다. 이런
동적으로 생성되는 요소를 스타일링해야 하면 `<style is:global>`을 쓴다
(`loan-calculator.astro` 참고).

**CSS 명시도 주의.** `.calc-form label { display: grid }` (0,1,1)이 `.method-option`
같은 단일 클래스(0,1,0)를 조용히 덮어쓴 적이 있다. 폼 내부의 커스텀 옵션류
클래스는 `.calc-form .method-option`처럼 부모로 한 번 더 감싸서 명시도를 올린다.

## 작업 검증 방식

- 코드 수정 후 항상 `npm run build`로 빌드 확인 (전체 페이지 수가 예상대로
  생성되는지까지 확인 — 현재 ko 18 + en 17 = 35페이지).
- UI/레이아웃 변경은 코드만 보고 끝내지 않는다. Playwright로 실제 렌더링을
  확인한다 (스크린샷, `getComputedStyle`, `checkValidity()` 등). Playwright는
  **프로젝트 의존성이 아니다** — 세션 스크래치패드에서 임시 검증 도구로만
  실행하고, `package.json`에 추가하지 않는다.
- 계산 로직 변경은 `tsx`로 직접 함수를 호출해 실제 법령/공식 기준 수치와
  대조한다.
- 법령·세율 등 수치를 넣을 때는 실제 검색으로 확인된 law.go.kr 등 공식 출처
  URL만 인용한다. URL을 추측/생성하지 않는다.

## Git 워크플로

- **커밋·push는 사용자가 명시적으로 승인("응", "응 해줘" 등)한 뒤에만 한다.**
  이 저장소에서 지금까지 예외 없이 지켜온 규칙이다. 먼저 변경하고 나중에
  물어보지 않는다.
- 커밋 메시지는 "왜"를 설명하는 1~2문장 + `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>` 트레일러.
- `git add`는 파일을 명시적으로 나열한다 (`git add -A`/`.` 지양).

## 참고 문서

- `LEGAL_REFERENCES.md` — 계산기별 법령 근거·현재 반영값·다음 확인 시점 인덱스.
  법이 바뀌었는지 빠르게 파악하려면 이 문서부터 본다.
- `README.md` — 로컬 개발 실행 방법.

---

# Karpathy-Inspired Coding Guidelines

아래는 [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
프로젝트(Andrej Karpathy의 LLM 코딩 실패 패턴 관찰에서 파생)의 `CLAUDE.md`를
그대로 병합한 것이다. 이 저장소 전체 작업에 적용된다.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks (typo fixes, obvious one-liners), use judgment — not every change needs the full rigor.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
