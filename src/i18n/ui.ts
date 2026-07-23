/**
 * Shared UI string dictionary for the two supported locales.
 *
 * Only strings used by chrome shared across every page (header, footer,
 * language switcher) live here. Per-page copy (headings, form labels, FAQ,
 * disclaimers) is authored directly in each locale's page file instead of
 * being routed through a dictionary, since it isn't reused elsewhere.
 */

export type Lang = 'ko' | 'en';

export const ui: Record<Lang, {
  siteName: string;
  defaultDescription: string;
  navLabel: string;
  policyLabel: string;
  privacy: string;
  terms: string;
  langSwitchLabel: string;
}> = {
  ko: {
    siteName: '콤집계산기',
    defaultDescription:
      '만나이, 연봉 실수령액 등 일상에 필요한 계산기를 모아둔 무료 계산기 사이트, 콤집계산기입니다.',
    navLabel: '주요 계산기',
    policyLabel: '정책',
    privacy: '개인정보처리방침',
    terms: '이용약관',
    langSwitchLabel: 'English',
  },
  en: {
    siteName: 'Comzip Calculators',
    defaultDescription:
      'Comzip Calculators is a free collection of everyday calculators for Korean age, take-home pay, taxes, and more.',
    navLabel: 'Calculators',
    policyLabel: 'Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    langSwitchLabel: '한국어',
  },
};
