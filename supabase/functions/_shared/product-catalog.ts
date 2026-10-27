/** Curated, edition-scoped product facts. Never treat aliases as automatic confirmation. */
export const PRODUCT_CATALOG_VERSION = "2026-10-23.1";
export type Product = {
  id: string;
  name: string;
  category: "whisky" | "beer" | "wine" | "traditional";
  aliases: string[];
  baseAliases: string[];
  edition: string;
  features: {
    id: string;
    label: string;
    dimension: string;
    evidence: string;
  }[];
  source: {
    url: string;
    title: string;
    checkedAt: string;
    kind: "producer" | "expert-tasting";
  };
  description: string;
};
export const products: Product[] = [
  {
    id: "glenlivet-12",
    name: "글렌리벳 12년",
    category: "whisky",
    aliases: [
      "글렌리벳 12년",
      "글렌리벳12",
      "The Glenlivet 12",
      "Glenlivet 12",
      "Glenlivet 12 Year Old",
    ],
    baseAliases: [],
    edition: "12년",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "제조사는 과일 향과 파인애플 맛, 크리미한 마무리를 설명해요.",
      },
    ],
    source: {
      url: "https://www.theglenlivet.com/en-us/product/12-year-old-single-malt-scotch/",
      title: "The Glenlivet · 12 Year Old",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "제조사는 과일 향과 파인애플 맛, 크리미한 마무리를 설명해요.",
  },
  {
    id: "makers-mark",
    name: "메이커스 마크",
    category: "whisky",
    aliases: ["메이커스 마크", "Maker’s Mark", "Makers Mark"],
    baseAliases: [],
    edition: "오리지널",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "오리지널 버번의 향을 과일·바닐라·오크로 설명해요.",
      },
      {
        id: "향:나무 향",
        label: "나무 향",
        dimension: "향",
        evidence: "오리지널 버번의 향을 과일·바닐라·오크로 설명해요.",
      },
      {
        id: "향:꿀·바닐라 향",
        label: "꿀·바닐라 향",
        dimension: "향",
        evidence: "오리지널 버번의 향을 과일·바닐라·오크로 설명해요.",
      },
    ],
    source: {
      url: "https://www.makersmark.com/en-us/bourbons/makers-mark",
      title: "Maker’s Mark · Original",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "오리지널 버번의 향을 과일·바닐라·오크로 설명해요.",
  },
  {
    id: "glenfiddich-12",
    name: "글렌피딕 12년",
    category: "whisky",
    aliases: [
      "글렌피딕 12년",
      "글렌피딕12",
      "Glenfiddich 12",
      "Glenfiddich 12 Year Old",
    ],
    baseAliases: [],
    edition: "12년 · 40%",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
      },
      {
        id: "향:사과·배 향",
        label: "사과·배 향",
        dimension: "향",
        evidence: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
      },
      {
        id: "질감:매끈한 질감",
        label: "매끈한 질감",
        dimension: "질감",
        evidence: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운 · 오래 남았어요",
        label: "여운 · 오래 남았어요",
        dimension: "여운",
        evidence: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운의 길이 · 길어요",
        label: "여운의 길이 · 길어요",
        dimension: "여운",
        evidence: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
      },
    ],
    source: {
      url: "https://shop.us.glenfiddich.com/products/glenfiddich-12-year-old",
      title: "Glenfiddich · 12 Year Old",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "배를 떠올리는 과일 향과 부드러운 질감, 긴 여운을 설명해요.",
  },
  {
    id: "laphroaig-10",
    name: "라프로익 10년",
    category: "whisky",
    aliases: [
      "라프로익 10년",
      "라프로익10",
      "Laphroaig 10",
      "Laphroaig 10 Year Old",
    ],
    baseAliases: [],
    edition: "10년 · 기본판",
    features: [
      {
        id: "향:연기 향",
        label: "연기 향",
        dimension: "향",
        evidence:
          "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
      },
      {
        id: "향:피트·스모크 향",
        label: "피트·스모크 향",
        dimension: "향",
        evidence:
          "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
      },
      {
        id: "맛:달콤한 맛",
        label: "달콤한 맛",
        dimension: "맛",
        evidence:
          "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
      },
      {
        id: "여운:여운 · 오래 남았어요",
        label: "여운 · 오래 남았어요",
        dimension: "여운",
        evidence:
          "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
      },
      {
        id: "여운:여운의 길이 · 길어요",
        label: "여운의 길이 · 길어요",
        dimension: "여운",
        evidence:
          "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
      },
    ],
    source: {
      url: "https://www.laphroaig.com/whiskies/10-year-old",
      title: "Laphroaig · 10 Year Old",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "피트 연기와 해조류 향, 단맛과 짠맛, 오래 남는 여운을 설명해요.",
  },
  {
    id: "ardbeg-10",
    name: "아드벡 10년",
    category: "whisky",
    aliases: ["아드벡 10년", "아드벡10", "Ardbeg 10", "Ardbeg Ten Years Old"],
    baseAliases: [],
    edition: "10년 · 기본판",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "기본 10년의 향에는 연기와 과일, 레몬·라임 껍질이 등장해요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "기본 10년의 향에는 연기와 과일, 레몬·라임 껍질이 등장해요.",
      },
      {
        id: "향:연기 향",
        label: "연기 향",
        dimension: "향",
        evidence: "기본 10년의 향에는 연기와 과일, 레몬·라임 껍질이 등장해요.",
      },
      {
        id: "향:피트·스모크 향",
        label: "피트·스모크 향",
        dimension: "향",
        evidence: "기본 10년의 향에는 연기와 과일, 레몬·라임 껍질이 등장해요.",
      },
    ],
    source: {
      url: "https://www.ardbeg.com/en-gb/products/ardbeg-ten-years-old",
      title: "Ardbeg · Ten Years Old",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "기본 10년의 향에는 연기와 과일, 레몬·라임 껍질이 등장해요.",
  },
  {
    id: "johnnie-walker-black-12",
    name: "조니워커 블랙 라벨 12년",
    category: "whisky",
    aliases: [
      "조니워커 블랙 라벨 12년",
      "조니워커블랙",
      "조니워커블랙12",
      "조니워커블랙라벨",
      "Johnnie Walker Black Label",
      "Johnnie Walker Black Label 12",
    ],
    baseAliases: [],
    edition: "블랙 라벨 · 12년",
    features: [
      {
        id: "맛:달콤한 맛",
        label: "달콤한 맛",
        dimension: "맛",
        evidence:
          "제조사는 달콤한 과일 맛과 향신료·바닐라, 연기의 조화를 설명해요.",
      },
    ],
    source: {
      url: "https://www.johnniewalker.com/en/our-whisky/core-range/johnnie-walker-black-label",
      title: "Johnnie Walker · Black Label",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "제조사는 달콤한 과일 맛과 향신료·바닐라, 연기의 조화를 설명해요.",
  },
  {
    id: "jameson-original",
    name: "제임슨 오리지널",
    category: "whisky",
    aliases: [
      "제임슨 오리지널",
      "제임슨",
      "Jameson",
      "Jameson Original",
      "Jameson Irish Whiskey",
    ],
    baseAliases: [],
    edition: "오리지널",
    features: [
      {
        id: "향:꽃 향",
        label: "꽃 향",
        dimension: "향",
        evidence:
          "오리지널의 첫 향에는 가벼운 꽃 향과 나무·향신료 느낌이 있어요.",
      },
      {
        id: "향:나무 향",
        label: "나무 향",
        dimension: "향",
        evidence:
          "오리지널의 첫 향에는 가벼운 꽃 향과 나무·향신료 느낌이 있어요.",
      },
    ],
    source: {
      url: "https://www.jamesonwhiskey.com/en-us/our-whiskey/jameson-irish-whiskey",
      title: "Jameson · Irish Whiskey",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "오리지널의 첫 향에는 가벼운 꽃 향과 나무·향신료 느낌이 있어요.",
  },
  {
    id: "balvenie-doublewood-12",
    name: "발베니 더블우드 12년",
    category: "whisky",
    aliases: [
      "발베니 더블우드 12년",
      "발베니12",
      "발베니더블우드12",
      "Balvenie DoubleWood 12",
      "The Balvenie DoubleWood 12",
    ],
    baseAliases: [],
    edition: "더블우드 · 12년",
    features: [
      {
        id: "향:꿀·바닐라 향",
        label: "꿀·바닐라 향",
        dimension: "향",
        evidence:
          "독립 심사기관 IWSC는 꿀·바닐라 향과 오크의 흔적을 기록했어요.",
      },
      {
        id: "향:나무 향",
        label: "나무 향",
        dimension: "향",
        evidence:
          "독립 심사기관 IWSC는 꿀·바닐라 향과 오크의 흔적을 기록했어요.",
      },
    ],
    source: {
      url: "https://www.iwsc.net/results/detail/89543/the-balvenie-doublewood-12-yo-single-malt-scotch-whisky",
      title: "IWSC · The Balvenie DoubleWood 12 YO",
      checkedAt: "2026-10-23",
      kind: "expert-tasting",
    },
    description:
      "독립 심사기관 IWSC는 꿀·바닐라 향과 오크의 흔적을 기록했어요.",
  },
  {
    id: "guinness-draught",
    name: "기네스 드래프트",
    category: "beer",
    aliases: [
      "기네스 드래프트",
      "기네스드래프트생맥주",
      "Guinness Draught",
      "Guinness Draft",
    ],
    baseAliases: [],
    edition: "Draught · 기본판",
    features: [
      {
        id: "향:커피·초콜릿 향",
        label: "커피·초콜릿 향",
        dimension: "향",
        evidence: "커피와 맥아 향, 크리미한 질감을 설명해요.",
      },
      {
        id: "향:맥아·곡물 향",
        label: "맥아·곡물 향",
        dimension: "향",
        evidence: "커피와 맥아 향, 크리미한 질감을 설명해요.",
      },
      {
        id: "향:곡물·맥아 향",
        label: "곡물·맥아 향",
        dimension: "향",
        evidence: "커피와 맥아 향, 크리미한 질감을 설명해요.",
      },
      {
        id: "질감:크리미한 질감",
        label: "크리미한 질감",
        dimension: "질감",
        evidence: "커피와 맥아 향, 크리미한 질감을 설명해요.",
      },
    ],
    source: {
      url: "https://www.diageobaracademy.com/en-us/home/our-brands/guinness-draught",
      title: "Diageo Bar Academy · Guinness Draught",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "커피와 맥아 향, 크리미한 질감을 설명해요.",
  },
  {
    id: "weihenstephaner-hefeweissbier",
    name: "바이엔슈테판 헤페바이스비어",
    category: "beer",
    aliases: [
      "바이엔슈테판 헤페바이스비어",
      "바이엔슈테판헤페바이스",
      "바이엔슈테판헤페바이스비어",
      "Weihenstephaner Hefeweissbier",
      "Weihenstephaner Hefe Weissbier",
    ],
    baseAliases: [],
    edition: "헤페바이스비어 · 5.4%",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "바나나·정향 향과 크리미한 입안을 설명해요.",
      },
      {
        id: "향:향신료 향",
        label: "향신료 향",
        dimension: "향",
        evidence: "바나나·정향 향과 크리미한 입안을 설명해요.",
      },
      {
        id: "질감:크리미한 질감",
        label: "크리미한 질감",
        dimension: "질감",
        evidence: "바나나·정향 향과 크리미한 입안을 설명해요.",
      },
    ],
    source: {
      url: "https://www.weihenstephaner.de/unsere-biere/hefeweissbier",
      title: "Weihenstephan · Hefeweissbier",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "바나나·정향 향과 크리미한 입안을 설명해요.",
  },
  {
    id: "paulaner-weissbier",
    name: "파울라너 헤페 바이스비어",
    category: "beer",
    aliases: [
      "파울라너 헤페 바이스비어",
      "파울라너바이스비어",
      "파울라너헤페바이스",
      "Paulaner Weissbier",
      "Paulaner Hefe Weissbier",
    ],
    baseAliases: [],
    edition: "바이스비어 · 기본판",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "바나나를 중심으로 망고·파인애플을 떠올리는 향을 설명해요.",
      },
      {
        id: "향:열대과일 향",
        label: "열대과일 향",
        dimension: "향",
        evidence: "바나나를 중심으로 망고·파인애플을 떠올리는 향을 설명해요.",
      },
    ],
    source: {
      url: "https://www.paulaner.com/our-products/weissbier",
      title: "Paulaner · Weissbier",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "바나나를 중심으로 망고·파인애플을 떠올리는 향을 설명해요.",
  },
  {
    id: "hoegaarden-white",
    name: "호가든 화이트",
    category: "beer",
    aliases: ["호가든 화이트", "호가든", "Hoegaarden", "Hoegaarden White"],
    baseAliases: [],
    edition: "White · 기본판",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "화이트의 설명에는 산뜻한 감귤과 코리앤더 향이 있어요. 로제 제품에는 적용하지 않아요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence:
          "화이트의 설명에는 산뜻한 감귤과 코리앤더 향이 있어요. 로제 제품에는 적용하지 않아요.",
      },
    ],
    source: {
      url: "https://www.hoegaarden.com/beer",
      title: "Hoegaarden · White",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "화이트의 설명에는 산뜻한 감귤과 코리앤더 향이 있어요. 로제 제품에는 적용하지 않아요.",
  },
  {
    id: "pilsner-urquell",
    name: "필스너 우르켈",
    category: "beer",
    aliases: ["필스너 우르켈", "Pilsner Urquell"],
    baseAliases: [],
    edition: "오리지널",
    features: [
      {
        id: "맛:쌉쌀한 맛",
        label: "쌉쌀한 맛",
        dimension: "맛",
        evidence: "홉의 쌉쌀함과 깔끔한 마무리를 설명해요.",
      },
      {
        id: "여운:여운 · 깔끔하게 사라져요",
        label: "여운 · 깔끔하게 사라져요",
        dimension: "여운",
        evidence: "홉의 쌉쌀함과 깔끔한 마무리를 설명해요.",
      },
    ],
    source: {
      url: "https://www.pilsnerurquell.com/?l=hungarian",
      title: "Pilsner Urquell · Original",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "홉의 쌉쌀함과 깔끔한 마무리를 설명해요.",
  },
  {
    id: "heineken-original",
    name: "하이네켄 오리지널",
    category: "beer",
    aliases: ["하이네켄 오리지널", "하이네켄", "Heineken", "Heineken Original"],
    baseAliases: [],
    edition: "Original · 기본판",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "제조사는 실버 소개에서도 오리지널의 고유한 과일 향을 명시해요.",
      },
    ],
    source: {
      url: "https://www.heineken.com/za/en/our-products/heineken-silver/",
      title: "Heineken · Silver 소개 내 Original 향 설명",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "제조사는 실버 소개에서 오리지널의 고유한 과일 향을 명시해요. 실버의 도수나 질감은 오리지널에 적용하지 않아요.",
  },
  {
    id: "sierra-nevada-pale-ale",
    name: "시에라 네바다 페일 에일",
    category: "beer",
    aliases: [
      "시에라 네바다 페일 에일",
      "Sierra Nevada Pale Ale",
      "시에라네바다페일에일",
    ],
    baseAliases: [],
    edition: "Pale Ale · 5.6%",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "제조사는 소나무와 감귤의 강렬한 향을 설명해요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "제조사는 소나무와 감귤의 강렬한 향을 설명해요.",
      },
    ],
    source: {
      url: "https://sierranevada.com/brews/pale-ale",
      title: "Sierra Nevada · Pale Ale",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "제조사는 소나무와 감귤의 강렬한 향을 설명해요.",
  },
  {
    id: "brewdog-punk-ipa-54",
    name: "브루독 펑크 IPA 5.4%",
    category: "beer",
    aliases: [
      "브루독 펑크 IPA 5.4%",
      "브루독펑크IPA",
      "펑크IPA",
      "BrewDog Punk IPA",
      "Punk IPA",
      "Punk IPA 5.4%",
    ],
    baseAliases: [],
    edition: "새 레시피 · 5.4%",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "새 5.4% 판본의 향을 자몽 껍질·감귤 오일·열대과일로 설명해요. 이전 레시피에는 적용하지 않아요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence:
          "새 5.4% 판본의 향을 자몽 껍질·감귤 오일·열대과일로 설명해요. 이전 레시피에는 적용하지 않아요.",
      },
      {
        id: "향:열대과일 향",
        label: "열대과일 향",
        dimension: "향",
        evidence:
          "새 5.4% 판본의 향을 자몽 껍질·감귤 오일·열대과일로 설명해요. 이전 레시피에는 적용하지 않아요.",
      },
    ],
    source: {
      url: "https://brewdog.com/blogs/news/introducing-the-new-punk-ipa",
      title: "BrewDog · Introducing the new Punk IPA",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "새 5.4% 판본의 향을 자몽 껍질·감귤 오일·열대과일로 설명해요. 이전 레시피에는 적용하지 않아요.",
  },
  {
    id: "cloudy-bay-sb-2022",
    name: "클라우디 베이 소비뇽 블랑 2022",
    category: "wine",
    aliases: [
      "클라우디 베이 소비뇽 블랑 2022",
      "Cloudy Bay Sauvignon Blanc 2022",
    ],
    baseAliases: ["클라우디 베이 소비뇽 블랑", "Cloudy Bay Sauvignon Blanc"],
    edition: "2022",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "2022년의 향에는 감귤·라임·백도·패션프루트가 있어요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "2022년의 향에는 감귤·라임·백도·패션프루트가 있어요.",
      },
      {
        id: "향:열대과일 향",
        label: "열대과일 향",
        dimension: "향",
        evidence: "2022년의 향에는 감귤·라임·백도·패션프루트가 있어요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/en-us/our-wines/sauvignon-blanc/sauvignon-blanc-2022/",
      title: "Cloudy Bay · Sauvignon Blanc 2022",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "2022년의 향에는 감귤·라임·백도·패션프루트가 있어요.",
  },
  {
    id: "cloudy-bay-sb-2024",
    name: "클라우디 베이 소비뇽 블랑 2024",
    category: "wine",
    aliases: [
      "클라우디 베이 소비뇽 블랑 2024",
      "Cloudy Bay Sauvignon Blanc 2024",
    ],
    baseAliases: ["클라우디 베이 소비뇽 블랑", "Cloudy Bay Sauvignon Blanc"],
    edition: "2024",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
      {
        id: "향:꽃 향",
        label: "꽃 향",
        dimension: "향",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
      {
        id: "맛:새콤한 맛",
        label: "새콤한 맛",
        dimension: "맛",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운 · 오래 남았어요",
        label: "여운 · 오래 남았어요",
        dimension: "여운",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운의 길이 · 길어요",
        label: "여운의 길이 · 길어요",
        dimension: "여운",
        evidence:
          "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/drupal/sites/default/files/2025-04/CloudyBay-TastingNotes-SauvignonBlanc-2024.pdf",
      title: "Cloudy Bay · Sauvignon Blanc 2024 tasting notes",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "2024년에는 감귤·라임 잎·살구·오렌지 꽃 향과 레몬 같은 산미, 긴 여운을 설명해요.",
  },
  {
    id: "cloudy-bay-chardonnay-2023",
    name: "클라우디 베이 샤르도네 2023",
    category: "wine",
    aliases: ["클라우디 베이 샤르도네 2023", "Cloudy Bay Chardonnay 2023"],
    baseAliases: [
      "클라우디베이샤르도네",
      "클라우디베이샤도네이",
      "Cloudy Bay Chardonnay",
    ],
    edition: "2023",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
      },
      {
        id: "향:사과·배 향",
        label: "사과·배 향",
        dimension: "향",
        evidence: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
      },
      {
        id: "향:나무 향",
        label: "나무 향",
        dimension: "향",
        evidence: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
      },
      {
        id: "향:나무·바닐라 향",
        label: "나무·바닐라 향",
        dimension: "향",
        evidence: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/en-us/our-wines/chardonnay/chardonnay-2023/",
      title: "Cloudy Bay · Chardonnay 2023",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "2023년의 향에는 백도·배·감귤과 은은한 오크가 있어요.",
  },
  {
    id: "cloudy-bay-pinot-noir-2022",
    name: "클라우디 베이 피노 누아 2022",
    category: "wine",
    aliases: ["클라우디 베이 피노 누아 2022", "Cloudy Bay Pinot Noir 2022"],
    baseAliases: ["클라우디베이피노누아", "Cloudy Bay Pinot Noir"],
    edition: "2022",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
      {
        id: "향:베리·체리 향",
        label: "베리·체리 향",
        dimension: "향",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
      {
        id: "향:꽃 향",
        label: "꽃 향",
        dimension: "향",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
      {
        id: "떫은 느낌:느낌 · 하나 선택 · 부드러워요",
        label: "느낌 · 하나 선택 · 부드러워요",
        dimension: "떫은 느낌",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운 · 오래 남았어요",
        label: "여운 · 오래 남았어요",
        dimension: "여운",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
      {
        id: "여운:여운의 길이 · 길어요",
        label: "여운의 길이 · 길어요",
        dimension: "여운",
        evidence:
          "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/en-nz/our-wines/pinot-noir/pinot-noir-2022/",
      title: "Cloudy Bay · Pinot Noir 2022",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "2022년에는 붉은 체리·장미 꽃잎 향과 매끄러운 탄닌, 긴 여운을 설명해요.",
  },
  {
    id: "cloudy-bay-te-koko-2021",
    name: "클라우디 베이 테 코코 2021",
    category: "wine",
    aliases: ["클라우디 베이 테 코코 2021", "Cloudy Bay Te Koko 2021"],
    baseAliases: ["클라우디베이테코코", "Cloudy Bay Te Koko"],
    edition: "2021",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "2021년의 첫 향에는 은은한 열대과일과 꿀, 흑연 느낌이 있어요.",
      },
      {
        id: "향:열대과일 향",
        label: "열대과일 향",
        dimension: "향",
        evidence:
          "2021년의 첫 향에는 은은한 열대과일과 꿀, 흑연 느낌이 있어요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/en-ww/our-wines/te-koko/te-koko-2021/",
      title: "Cloudy Bay · Te Koko 2021",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "2021년의 첫 향에는 은은한 열대과일과 꿀, 흑연 느낌이 있어요.",
  },
  {
    id: "cloudy-bay-pelorus-rose-nv",
    name: "클라우디 베이 펠로루스 로제 NV",
    category: "wine",
    aliases: [
      "클라우디 베이 펠로루스 로제 NV",
      "Cloudy Bay Pelorus Rose",
      "Cloudy Bay Pelorus Rosé",
      "클라우디베이펠로루스로제",
    ],
    baseAliases: [],
    edition: "NV · 로제",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "펠로루스 로제 설명에는 라즈베리·크랜베리·딸기와 붉은 꽃 향이 있어요.",
      },
      {
        id: "향:베리·체리 향",
        label: "베리·체리 향",
        dimension: "향",
        evidence:
          "펠로루스 로제 설명에는 라즈베리·크랜베리·딸기와 붉은 꽃 향이 있어요.",
      },
      {
        id: "향:꽃 향",
        label: "꽃 향",
        dimension: "향",
        evidence:
          "펠로루스 로제 설명에는 라즈베리·크랜베리·딸기와 붉은 꽃 향이 있어요.",
      },
    ],
    source: {
      url: "https://www.cloudybay.com/drupal/sites/default/files/2023-11/Violetas-Selection_Tasting-Notes_0.pdf",
      title: "Cloudy Bay · Pelorus Rosé tasting notes",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "펠로루스 로제 설명에는 라즈베리·크랜베리·딸기와 붉은 꽃 향이 있어요.",
  },
  {
    id: "moet-imperial-brut-nv",
    name: "모엣 샹동 임페리얼 브뤼 NV",
    category: "wine",
    aliases: [
      "모엣 샹동 임페리얼 브뤼 NV",
      "모엣샹동임페리얼",
      "모엣샹동브뤼임페리얼",
      "Moët Impérial",
      "Moet Chandon Brut Imperial",
      "Moët & Chandon Impérial Brut",
    ],
    baseAliases: [],
    edition: "NV · Brut Impérial",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
      {
        id: "향:사과·배 향",
        label: "사과·배 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
      {
        id: "향:꽃 향",
        label: "꽃 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
      {
        id: "향:빵·곡물 향",
        label: "빵·곡물 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
      {
        id: "향:견과류 향",
        label: "견과류 향",
        dimension: "향",
        evidence: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
      },
    ],
    source: {
      url: "https://www.moet.com/en-us/moet-imperial",
      title: "Moët & Chandon · Moët Impérial",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "녹색 사과·감귤·흰 꽃·브리오슈·곡물·견과류 향을 설명해요.",
  },
  {
    id: "veuve-clicquot-yellow-label-nv",
    name: "뵈브 클리코 옐로 라벨 브뤼 NV",
    category: "wine",
    aliases: [
      "뵈브 클리코 옐로 라벨 브뤼 NV",
      "뵈브클리코옐로라벨",
      "뵈브클리코옐로우라벨",
      "Veuve Clicquot Yellow Label",
      "Veuve Clicquot Yellow Label Brut",
    ],
    baseAliases: [],
    edition: "NV · Yellow Label Brut",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence: "배·사과·복숭아·감귤·브리오슈 향과 섬세한 기포를 설명해요.",
      },
      {
        id: "향:사과·배 향",
        label: "사과·배 향",
        dimension: "향",
        evidence: "배·사과·복숭아·감귤·브리오슈 향과 섬세한 기포를 설명해요.",
      },
      {
        id: "향:레몬·자몽 향",
        label: "레몬·자몽 향",
        dimension: "향",
        evidence: "배·사과·복숭아·감귤·브리오슈 향과 섬세한 기포를 설명해요.",
      },
      {
        id: "향:빵·곡물 향",
        label: "빵·곡물 향",
        dimension: "향",
        evidence: "배·사과·복숭아·감귤·브리오슈 향과 섬세한 기포를 설명해요.",
      },
    ],
    source: {
      url: "https://www.veuveclicquot.com/en-us/veuve-clicquot-yellow-label-brut-champagne-11003681.html",
      title: "Veuve Clicquot · Yellow Label Brut",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "배·사과·복숭아·감귤·브리오슈 향과 섬세한 기포를 설명해요.",
  },
  {
    id: "naroo-6",
    name: "나루 생막걸리 6도",
    category: "traditional",
    aliases: [
      "나루 생막걸리 6도",
      "나루막걸리6",
      "나루6",
      "나루생막걸리6",
      "Naroo 6",
    ],
    baseAliases: [],
    edition: "생막걸리 · 6%",
    features: [
      {
        id: "맛:달콤한 맛",
        label: "달콤한 맛",
        dimension: "맛",
        evidence: "나루 6도는 자연스러운 쌀의 단맛과 깔끔한 산미를 설명해요.",
      },
      {
        id: "맛:새콤한 맛",
        label: "새콤한 맛",
        dimension: "맛",
        evidence: "나루 6도는 자연스러운 쌀의 단맛과 깔끔한 산미를 설명해요.",
      },
    ],
    source: {
      url: "https://www.hangangbrewery.com/INTRO",
      title: "한강주조 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "나루 6도는 자연스러운 쌀의 단맛과 깔끔한 산미를 설명해요.",
  },
  {
    id: "naroo-115",
    name: "나루 막걸리 11.5도",
    category: "traditional",
    aliases: ["나루 막걸리 11.5도", "나루11.5", "나루막걸리11.5", "Naroo 11.5"],
    baseAliases: [],
    edition: "11.5%",
    features: [
      {
        id: "향:과일 향",
        label: "과일 향",
        dimension: "향",
        evidence:
          "나루 11.5도는 청사과 향, 깊은 단맛과 묵직한 질감을 설명해요.",
      },
      {
        id: "향:사과·배 향",
        label: "사과·배 향",
        dimension: "향",
        evidence:
          "나루 11.5도는 청사과 향, 깊은 단맛과 묵직한 질감을 설명해요.",
      },
      {
        id: "맛:달콤한 맛",
        label: "달콤한 맛",
        dimension: "맛",
        evidence:
          "나루 11.5도는 청사과 향, 깊은 단맛과 묵직한 질감을 설명해요.",
      },
      {
        id: "질감:묵직한 바디",
        label: "묵직한 바디",
        dimension: "질감",
        evidence:
          "나루 11.5도는 청사과 향, 깊은 단맛과 묵직한 질감을 설명해요.",
      },
    ],
    source: {
      url: "https://www.hangangbrewery.com/INTRO",
      title: "한강주조 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "나루 11.5도는 청사과 향, 깊은 단맛과 묵직한 질감을 설명해요.",
  },
  {
    id: "gleem-yakju",
    name: "글림 약주",
    category: "traditional",
    aliases: ["글림 약주", "한강주조글림", "Gleem Yakju"],
    baseAliases: [],
    edition: "약주",
    features: [
      {
        id: "맛:달콤한 맛",
        label: "달콤한 맛",
        dimension: "맛",
        evidence: "글림은 균형 잡힌 단맛과 은은한 산미를 설명해요.",
      },
      {
        id: "맛:새콤한 맛",
        label: "새콤한 맛",
        dimension: "맛",
        evidence: "글림은 균형 잡힌 단맛과 은은한 산미를 설명해요.",
      },
    ],
    source: {
      url: "https://www.hangangbrewery.com/INTRO",
      title: "한강주조 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "글림은 균형 잡힌 단맛과 은은한 산미를 설명해요.",
  },
  {
    id: "hwayo-25",
    name: "화요 25",
    category: "traditional",
    aliases: ["화요 25", "화요25도", "Hwayo 25"],
    baseAliases: [],
    edition: "25%",
    features: [
      {
        id: "향:쌀·곡물 향",
        label: "쌀·곡물 향",
        dimension: "향",
        evidence: "화요 25는 쌀 향과 부드러운 입안을 설명해요.",
      },
      {
        id: "질감:매끈한 질감",
        label: "매끈한 질감",
        dimension: "질감",
        evidence: "화요 25는 쌀 향과 부드러운 입안을 설명해요.",
      },
    ],
    source: {
      url: "https://hwayo.com/home/",
      title: "화요 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "화요 25는 쌀 향과 부드러운 입안을 설명해요.",
  },
  {
    id: "hwayo-41",
    name: "화요 41",
    category: "traditional",
    aliases: ["화요 41", "화요41도", "Hwayo 41"],
    baseAliases: [],
    edition: "41%",
    features: [
      {
        id: "질감:매끈한 질감",
        label: "매끈한 질감",
        dimension: "질감",
        evidence:
          "화요 41은 높은 도수에서도 부드러운 입안을 설명해요. 알코올 자극이 약하다는 뜻으로 사용하지 않아요.",
      },
    ],
    source: {
      url: "https://hwayo.com/home/",
      title: "화요 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "화요 41은 높은 도수에서도 부드러운 입안을 설명해요. 알코올 자극이 약하다는 뜻으로 사용하지 않아요.",
  },
  {
    id: "hwayo-53",
    name: "화요 53",
    category: "traditional",
    aliases: ["화요 53", "화요53도", "Hwayo 53"],
    baseAliases: [],
    edition: "53%",
    features: [
      {
        id: "질감:매끈한 질감",
        label: "매끈한 질감",
        dimension: "질감",
        evidence: "화요 53은 부드러운 입안과 깔끔한 마무리를 설명해요.",
      },
      {
        id: "여운:여운 · 깔끔하게 사라져요",
        label: "여운 · 깔끔하게 사라져요",
        dimension: "여운",
        evidence: "화요 53은 부드러운 입안과 깔끔한 마무리를 설명해요.",
      },
    ],
    source: {
      url: "https://hwayo.com/home/",
      title: "화요 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "화요 53은 부드러운 입안과 깔끔한 마무리를 설명해요.",
  },
  {
    id: "hwayo-xp",
    name: "화요 XP",
    category: "traditional",
    aliases: ["화요 XP", "Hwayo XP"],
    baseAliases: [],
    edition: "XP · 오크 숙성",
    features: [
      {
        id: "향:나무 향",
        label: "나무 향",
        dimension: "향",
        evidence: "화요 XP는 오크 향과 길고 부드러운 여운을 설명해요.",
      },
      {
        id: "여운:여운 · 오래 남았어요",
        label: "여운 · 오래 남았어요",
        dimension: "여운",
        evidence: "화요 XP는 오크 향과 길고 부드러운 여운을 설명해요.",
      },
      {
        id: "여운:여운의 길이 · 길어요",
        label: "여운의 길이 · 길어요",
        dimension: "여운",
        evidence: "화요 XP는 오크 향과 길고 부드러운 여운을 설명해요.",
      },
    ],
    source: {
      url: "https://hwayo.com/home/",
      title: "화요 · 제품 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description: "화요 XP는 오크 향과 길고 부드러운 여운을 설명해요.",
  },
  {
    id: "boksoondoga-son",
    name: "복순도가 손막걸리",
    category: "traditional",
    aliases: [
      "복순도가 손막걸리",
      "복순도가손막걸리6.5",
      "Boksoondoga Son Makgeolli",
    ],
    baseAliases: [],
    edition: "손막걸리 · 기본판",
    features: [
      {
        id: "탄산:탄산감 · 강함",
        label: "탄산감 · 강함",
        dimension: "탄산",
        evidence:
          "손막걸리는 자연 발효에서 생기는 풍부한 탄산을 특징으로 설명해요. 다른 탁주 제품에는 적용하지 않아요.",
      },
      {
        id: "탄산:탄산의 느낌 · 강하게 톡 쏘아요",
        label: "탄산의 느낌 · 강하게 톡 쏘아요",
        dimension: "탄산",
        evidence:
          "손막걸리는 자연 발효에서 생기는 풍부한 탄산을 특징으로 설명해요. 다른 탁주 제품에는 적용하지 않아요.",
      },
    ],
    source: {
      url: "https://www.boksoon.com/shopinfo/about.html",
      title: "복순도가 · 손막걸리 소개",
      checkedAt: "2026-10-23",
      kind: "producer",
    },
    description:
      "손막걸리는 자연 발효에서 생기는 풍부한 탄산을 특징으로 설명해요. 다른 탁주 제품에는 적용하지 않아요.",
  },
];
export const normalizeProductName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(?<=\d)[.,](?=\d)/g, "decimal")
    .replace(/[^\p{L}\p{N}]/gu, "");
/** Only full curated aliases qualify. Explicit unsupported vintages/ABV/editions never fall back. */
export function productCandidates(name: string, catalog: readonly Product[] = products): Product[] {
  const n = normalizeProductName(name);
  if (!n) return [];
  const exact = catalog.filter((p) =>
    p.aliases.some((a) => normalizeProductName(a) === n),
  );
  if (exact.length) return exact;
  if (/(?:19|20)\d{2}/.test(name.normalize("NFKC"))) return [];
  return catalog.filter((p) =>
    p.baseAliases.some((a) => normalizeProductName(a) === n),
  );
}
/** Compatibility helper: ambiguous vintage choices must not silently select the first. */
export function productCandidate(name: string): Product | null {
  const candidates = productCandidates(name);
  return candidates.length === 1 ? candidates[0] : null;
}
