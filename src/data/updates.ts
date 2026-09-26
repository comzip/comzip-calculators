/**
 * 홈 상단 "최근 반영" 배지의 단일 진실 공급원(SSOT).
 *
 * 사용자에게 의미 있는 업데이트(법령·개편안 반영, 신규 계산기 추가)만
 * 수동으로 큐레이션해 기록한다 — git 커밋 날짜를 자동 노출하지 않는 이유는
 * CSS 수정 같은 내부 변경까지 "업데이트"로 표시되면 신호의 신뢰도가 떨어지기
 * 때문. 날짜는 우리가 사이트를 고친 날이 아니라 **반영한 법안·국무회의 등
 * 근거 사건의 날짜**를 쓴다 — 사용자의 질문은 "언제 고쳤나"가 아니라 "어떤
 * 개정 시점까지 반영돼 있나"이고, 사건 기준 서술은 시간이 지나도 낡아
 * 보이지 않는다.
 *
 * 법령·개편안 반영이나 신규 계산기 추가 커밋에서는 이 배열 맨 앞에 항목을
 * 추가한다. 홈(ko/en)은 맨 앞 항목(`latestUpdate`) 1건만 노출한다.
 */
export interface SiteUpdate {
  /** 근거 사건의 ISO 날짜(YYYY-MM-DD) — 법안 발표·국무회의·시행일 등. 정렬·참조용. */
  date: string;
  /** 배지의 굵은 앞부분과 🔥 배너 칩에 쓰이는 사건 요약 (예: "2026.9.1 국무회의 수정안 반영"). */
  labelKo: string;
  labelEn: string;
  /** 배지의 뒷부분 — 무엇이 어떻게 반영됐는지 한 문장. */
  textKo: string;
  textEn: string;
  /**
   * 클릭 시 이동할 로케일 중립 경로 — 끝 슬래시 필수(CLAUDE.md의 canonical
   * 규칙 참고). en 홈은 앞에 `/en`을 붙여 쓴다.
   */
  href: string;
  /** 이 업데이트가 반영된 계산기 slug 목록 — 홈 🔥 배너의 업데이트 칩 표시용. */
  slugs: string[];
}

export const siteUpdates: SiteUpdate[] = [
  {
    date: '2026-09-01',
    labelKo: '2026.9.1 국무회의 수정안 반영',
    labelEn: 'Reflects the Sept 1, 2026 cabinet revision',
    textKo: '종부세·양도세 개편안 계산기가 국회 제출된 정부 최종안(비거주 1주택 공제 12억 유지 등) 기준으로 계산합니다',
    textEn: 'Reform previews now follow the final government bill submitted to the National Assembly (non-occupying deduction kept at ₩1.2B)',
    href: '/calculators/comprehensive-tax-reform-calculator/',
    slugs: ['comprehensive-tax-reform-calculator', 'capital-gains-tax-reform-calculator'],
  },
];

export const latestUpdate = siteUpdates[0];
