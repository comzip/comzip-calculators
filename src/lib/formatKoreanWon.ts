/**
 * 큰 원화 금액을 "5억 2,000만원" 같은 한글 단위 표기로 변환합니다.
 * 조/억/만 단위로 끊어 표시하고, 만 단위 미만 잔액은 쉼표 구분된 숫자로 붙입니다.
 */
export function formatKoreanWon(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return '0원';

  const 조 = Math.floor(n / 1_0000_0000_0000);
  const 억 = Math.floor((n % 1_0000_0000_0000) / 1_0000_0000);
  const 만 = Math.floor((n % 1_0000_0000) / 1_0000);
  const 원 = n % 1_0000;

  const parts: string[] = [];
  if (조 > 0) parts.push(`${조.toLocaleString('ko-KR')}조`);
  if (억 > 0) parts.push(`${억.toLocaleString('ko-KR')}억`);
  if (만 > 0) parts.push(`${만.toLocaleString('ko-KR')}만`);
  if (원 > 0 || parts.length === 0) parts.push(원.toLocaleString('ko-KR'));

  return parts.join(' ') + '원';
}

/**
 * Formats a won amount for the English pages as a plain comma-grouped
 * number with a "₩" prefix (e.g. "₩520,000,000"). English readers aren't
 * expected to know the 억/만 unit notation `formatKoreanWon` produces.
 */
export function formatWonEn(amount: number): string {
  const n = Math.round(Math.abs(amount));
  return `₩${n.toLocaleString('en-US')}`;
}
