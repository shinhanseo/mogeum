/** Templates describe observations only; they never invent preference or missing sensations. */
export function observationSentence(id: string, label: string, values: string[]): string {
  const v = values.join(' · ');
  const topic = label.replace(/ · .*/, '').replace(/\?$/, '');
  const predicate: Record<string,string> = {
    '가벼워요':'가볍게 느껴졌어요', '물처럼 가벼워요':'물처럼 가볍게 느껴졌어요',
    '중간이에요':'중간 정도였어요','묵직해요':'묵직하게 느껴졌어요',
    '매끈해요':'매끈했어요','오일리해요':'오일리했어요','크리미해요':'크리미했어요',
    '입안이 말라요':'입안이 마르는 느낌이었어요','거칠어요':'거칠게 느껴졌어요','거칠게 느껴져요':'거칠게 느껴졌어요',
    '부드러워요':'부드러웠어요','따뜻해요':'따뜻하게 느껴졌어요','화끈해요':'화끈하게 느껴졌어요',
    '거의 없어요':'거의 느껴지지 않았어요','짧아요':'짧게 남았어요','길어요':'길게 남았어요',
    '금방 사라져요':'금방 사라졌어요','잠깐 남아요':'잠깐 남았어요','오래 남아요':'오래 남았어요',
    '맑아요':'맑게 보였어요','약간 흐려요':'약간 흐리게 보였어요','탁해요':'탁하게 보였어요',
    '옅어요':'옅게 보였어요','진해요':'진하게 보였어요','걸쭉해요':'걸쭉했어요',
    '끈적해요':'끈적하게 느껴졌어요','입안이 조여요':'입안이 조이는 느낌이었어요',
    '가루·입자가 느껴져요':'가루나 입자가 느껴졌어요','드라이해요':'드라이하게 느껴졌어요',
    '없어요':'없었어요','얇게 있어요':'얇게 있었어요','적당해요':'적당했어요','풍성해요':'풍성했어요','없음':'느껴지지 않았어요','약함':'약하게 느껴졌어요','중간':'중간 정도로 느껴졌어요','강함':'강하게 느껴졌어요',
    '잔잔해요':'잔잔했어요','부드럽게 올라와요':'부드럽게 올라왔어요','강하게 톡 쏘아요':'강하게 톡 쏘았어요',
    '촘촘하고 부드러워요':'촘촘하고 부드러웠어요','잔잔하고 촘촘해요':'잔잔하고 촘촘했어요','크고 거칠어요':'크고 거칠게 느껴졌어요',
  };
  const phrases = values.map(x => predicate[x] ?? (x.endsWith('어요') || x.endsWith('아요') ? x : `${x} 느낌이었어요`));
  if(id.startsWith('appearance.color')) return `${v}${(v.charCodeAt(v.length-1)-44032)%28===0?'로':'으로'} 보였어요.`;
  if(id==='appearance.type') return `${v} 와인이었어요.`;
  if(id==='conditions.temperature') return `${v === '실온' ? '실온에 가깝게' : v} 마셨어요.`;
  if(id==='conditions.opened') return v==='개봉 직후'?'개봉 직후에 마셨어요.':'개봉하고 시간이 지난 뒤에 마셨어요.';
  if(id==='conditions.decanted') return v==='했어요'?'디캔팅한 뒤에 마셨어요.':'디캔팅하지 않고 마셨어요.';
  if(id==='conditions.subtype') return `${v}${(v.charCodeAt(v.length-1)-44032)%28===0?'를':'을'} 마셨어요.`;
  if(id==='conditions.container') return v==='생맥주'?'생맥주로 마셨어요.':`${v}에 담긴 맥주를 마셨어요.`;
  if(id==='conditions.method') return ({'스트레이트':'스트레이트로 마셨어요.','물 첨가':'물을 더해 마셨어요.','얼음 첨가':'얼음을 넣어 마셨어요.','하이볼·믹서':'하이볼이나 믹서와 함께 마셨어요.','잔으로':'잔으로 마셨어요.','바틀로':'바틀로 마셨어요.','잔에 따랐어요':'잔에 따라 마셨어요.','용기 그대로':'용기 그대로 마셨어요.'} as Record<string,string>)[v] ?? '다른 방식으로 마셨어요.';
  if(id==='aroma_change.observed') return ({'잔을 돌린 뒤':'잔을 돌린 뒤 향을 다시 맡아봤어요.','시간이 지난 뒤':'시간이 지난 뒤 향을 다시 맡아봤어요.','둘 다 비교했어요':'잔을 돌린 뒤와 시간이 지난 뒤의 향을 비교했어요.','확인하지 않았어요':'향의 변화는 따로 확인하지 않았어요.'} as Record<string,string>)[v] ?? '';
  if(id.endsWith('.comparison')) return v==='비슷해요'?'처음 맡은 향과 비슷하게 느껴졌어요.':'처음 맡은 향과 다른 향이 느껴졌어요.';
  if(id==='overall.balance') return v==='잘 어우러졌어요'?'전체적인 느낌이 잘 어우러졌어요.':'전체적으로 유독 튀는 느낌이 있었어요.';
  if(id==='finish.features') {
    const sensations=values.filter(x=>x!=='깔끔하게 사라져요');
    return [sensations.length?`마신 뒤에는 ${sensations.join(' · ')} 느낌이 남았어요.`:'',values.includes('깔끔하게 사라져요')?'여운은 깔끔하게 사라졌어요.':''].filter(Boolean).join(' ');
  }
  if(id==='retronasal.features') return `마신 뒤에는 ${v} 향이 올라왔어요.`;
  if(id==='alcohol.location') return `${v}에서 알코올의 자극이 느껴졌어요.`;
  if(id==='foam.color') return `거품은 ${v}${(v.charCodeAt(v.length-1)-44032)%28===0?'로':'으로'} 보였어요.`;
  const subjects:Record<string,string>={'body.weight':'입안의 무게감은','body.texture':'입안의 질감은','body.oily':'입안의 느낌은','finish.length':'여운은','carbonation.texture':'기포는','alcohol.feeling':'알코올의 느낌은','appearance.clarity':'잔에 담긴 술은','appearance.density':'색은','foam.amount':'거품은','foam.retention':'거품은'};
  const subject=subjects[id] ?? `${topic}${/[가-힣]$/.test(topic) && (topic.charCodeAt(topic.length-1)-44032)%28===0?'는':'은'}`;
  return `${subject} ${phrases.map((p,i)=>i<phrases.length-1?p.replace(/했어요$/, '했고').replace(/였어요$/, '였고').replace(/졌어요$/, '졌고').replace(/었어요$/, '었고').replace(/았어요$/, '았고').replace(/어요$/, '고'):p).join(' ')}.`;
}
