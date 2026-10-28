/** Safe machine codes only; never display provider error text or guess a consumed quota. */
export function tasteSummaryFailureMessage(code:unknown){
 switch(code){
  case 'AI_NOT_CONFIGURED':return 'AI 요약을 아직 사용할 수 없어요. 남긴 기록은 그대로 보관돼요.';
  case 'ANALYSIS_TIMEOUT':return 'AI 요약이 평소보다 오래 걸리고 있어요. 기록은 보관했어요. 잠시 후 다시 시도해주세요.';
  case 'SUMMARY_DAILY_LIMIT':return '일일 요약 생성 한도에 도달했어요. 한국 시간 오전 9시에 한도가 새로 시작돼요. 기록은 계속 남길 수 있어요.';
  case 'SUMMARY_COOLDOWN':return '요약을 연속으로 요청했어요. 20초 뒤 다시 시도해주세요.';
  case 'AI_PROVIDER_LIMITED':return 'AI 서비스가 잠시 요청을 받지 못하고 있어요. 잠시 후 다시 시도해주세요. 기록은 그대로 보관돼요.';
  case 'RATE_LIMITED':return '지금은 요약을 다시 요청할 수 없어요. 잠시 후 다시 시도해주세요.';
  case 'STALE_INPUT':return '분석 중 기록이 바뀌었어요. 최신 기록으로 다시 살펴봐요.';
  default:return '취향 요약을 불러오지 못했어요. 다시 시도해주세요.';
 }
}
