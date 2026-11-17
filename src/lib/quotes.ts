// A small rotating set of gentle, therapy-friendly lines shown on the home
// screen - the same one for everyone each day, so it feels like a shared
// daily ritual rather than a random tip.
const QUOTES = [
  "오늘 하루도 애썼어요.",
  "잘하지 않아도 괜찮아요, 그냥 해낸 것만으로 충분해요.",
  "지금 느끼는 감정에 이름을 붙여보는 것만으로도 큰 걸음이에요.",
  "조급해하지 않아도 돼요. 마음은 당신의 속도로 자라고 있어요.",
  "완벽한 그림보다, 솔직한 한 줄이 더 오래 남아요.",
  "힘든 날엔 쉬어가도 괜찮아요. 내일의 당신이 고마워할 거예요.",
  "작은 기록 하나가 나중엔 당신을 지켜주는 증거가 돼요.",
  "비교하지 않아도 돼요. 당신의 속도가 곧 정답이에요.",
  "오늘 느낀 감정 중 하나만 떠올려도, 이미 자신을 돌보고 있는 거예요.",
  "그려낸 색이 어떤 모양이든, 그건 오늘의 솔직한 당신이에요.",
  "마음이 복잡할 땐, 숨을 한 번 깊게 쉬는 것부터 시작해요.",
  "누군가에게 보여주지 않아도, 이 기록은 이미 의미가 있어요.",
  "지금 이 순간, 여기까지 온 당신을 응원해요.",
  "힘들었던 기억도 적어두면 조금은 가벼워져요.",
  "오늘의 나를 토닥여주는 건, 다른 누구도 아닌 나 자신이에요.",
  "서툴러도 괜찮아요. 서툰 마음도 소중한 기록이에요.",
  "작은 변화도 변화예요. 어제와 조금 다른 오늘을 알아차려봐요.",
  "지친 날엔 그림 한 장, 글 한 줄이면 충분해요.",
  "당신의 이야기는 그 자체로 가치가 있어요.",
  "오늘 하루, 나에게 조금 더 다정해져도 괜찮아요.",
];

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86400000);
}

export function quoteOfTheDay(date = new Date()) {
  return QUOTES[dayOfYear(date) % QUOTES.length];
}
