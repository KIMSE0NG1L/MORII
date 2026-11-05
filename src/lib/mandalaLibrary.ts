// 만다라 도안 라이브러리 - 스캔한 컬러링북 페이지에서 도안만 깔끔하게
// 오려내고(자동 경계 감지 + 배경 정리), 옆 페이지에 있던 시/명언을 옮겨
// 적은 것. 지금은 정적 목록일 뿐이고, "마음체크 결과를 보고 AI가 어울리는
// 만다라를 추천"하는 기능은 아직 구현 안 함 - moodTags는 그 다음 단계에서
// 추천 로직(규칙 기반이든 AI 매칭이든)이 참고할 수 있도록 미리 달아둔
// 재료임. 마지막 mandala-18은 도안 없이 빈 원 하나뿐인 페이지 - 자유
// 색칠용으로 그대로 남겨둠.
export type MandalaEntry = {
  id: string;
  image: string;
  quote: string;
  author: string;
  moodTags: string[];
};

export const MANDALA_LIBRARY: MandalaEntry[] = [
  {
    id: "mandala-01",
    image: "/assets/programs/mandala-library/mandala-01.png",
    quote: "황혼이 깃든 뜰을 거닐며\n새들의 빛나는 행방을 생각한다.",
    author: "G. 트라클",
    moodTags: ["사색", "그리움", "고요"],
  },
  {
    id: "mandala-02",
    image: "/assets/programs/mandala-library/mandala-02.png",
    quote:
      "한가로이 거니는 것 그것은 시간을 중단시키는 것이 아니라 시간에게 쫓겨 몰리는 법 없이 오히려 시간과 조화를 이루는 것이다. 그것은 구애받지 않는 자유로움을 의미한다.",
    author: "피에르 쌍소",
    moodTags: ["여유", "평온", "자유"],
  },
  {
    id: "mandala-03",
    image: "/assets/programs/mandala-library/mandala-03.png",
    quote: "사람이 온 세상을 다 얻을지라도 자기 영혼을 잃으면 무슨 유익이 있으리오.",
    author: "마태복음 16:26",
    moodTags: ["성찰", "영혼", "묵상"],
  },
  {
    id: "mandala-04",
    image: "/assets/programs/mandala-library/mandala-04.png",
    quote: "사랑하는 이여, 삶이란 얼마나 아름다운가요!\n시인의 가슴처럼\n빛과 영혼으로 가득 차 있습니다.",
    author: "칼릴 지브란",
    moodTags: ["기쁨", "사랑", "생동감"],
  },
  {
    id: "mandala-05",
    image: "/assets/programs/mandala-library/mandala-05.png",
    quote:
      "어린애마다 알고 있습니다. 봄이 말하는 것을, 살아라. 자라라. 꽃피어라. 희망하라. 사랑하라. 기뻐하라. 새싹을 내밀라. 몸을 던지고 삶을 두려워하지 마라.",
    author: "헤르만 헤세",
    moodTags: ["희망", "성장", "용기"],
  },
  {
    id: "mandala-06",
    image: "/assets/programs/mandala-library/mandala-06.png",
    quote: "따로 한적한 곳으로 가서 함께 좀 쉬자.",
    author: "예수",
    moodTags: ["휴식", "쉼", "평온"],
  },
  {
    id: "mandala-07",
    image: "/assets/programs/mandala-library/mandala-07.png",
    quote:
      "나침반\n\n네 곳의 바람에게\n내 사랑을 나누어준다\n\n다섯 개의 장미꽃잎에\n나는 피어난다\n\n여기저기로\n내 삶은 오간다\n\n위와 아래의\n중심을\n찾으려 한다.",
    author: "기젤라 드레허-리헬",
    moodTags: ["탐색", "방향", "중심잡기"],
  },
  {
    id: "mandala-08",
    image: "/assets/programs/mandala-library/mandala-08.png",
    quote: "소원이 너무 많으면 거지가 된다.",
    author: "티베트의 지혜",
    moodTags: ["비움", "만족", "단순함"],
  },
  {
    id: "mandala-09",
    image: "/assets/programs/mandala-library/mandala-09.png",
    quote:
      "텅 빈 방 안에 여유 있는 한가함만이 있네.\n오랫동안 새장 속에 갇혀 있다가\n다시 자연 속으로 되돌아온 것일세",
    author: "도연명",
    moodTags: ["자유", "해방감", "안도"],
  },
  {
    id: "mandala-10",
    image: "/assets/programs/mandala-library/mandala-10.png",
    quote:
      "목표\n\n오늘을\n원으로 그려 보아라\n\n너는\n아무런 생각 없이\n너의 중심에\n들어간다.\n\n어떤 때도\n너는\n목표가 아니었다\n\n바로\n그렇게.",
    author: "기젤라 드레허-리헬",
    moodTags: ["명상", "중심", "현재에 머물기"],
  },
  {
    id: "mandala-11",
    image: "/assets/programs/mandala-library/mandala-11.png",
    quote:
      "목적을 알 수 없는 매우 단순한 운동은 이미 그 자체가 의미 깊고, 비밀에 가득 차고, 뿐만 아니라 엄숙한 운동으로서 작용한다.",
    author: "칸딘스키",
    moodTags: ["사색", "호기심", "몰입"],
  },
  {
    id: "mandala-12",
    image: "/assets/programs/mandala-library/mandala-12.png",
    quote:
      "결코 마음의 평정을 잃지 마라.\n분노하지 않는 것은 중요한 지혜의 하나다.\n평정을 잃지 않는 사람은 마음이 큰 사람이다.",
    author: "발타자르 그라시안",
    moodTags: ["평정", "안정", "인내"],
  },
  {
    id: "mandala-13",
    image: "/assets/programs/mandala-library/mandala-13.png",
    quote: "실수를 범할 수 있는 피조물인 자유로운 인간은 훨씬 더 아름다운 것을 만들어낼 수 있다.",
    author: "지오 폰티",
    moodTags: ["자기수용", "창조", "용기"],
  },
  {
    id: "mandala-14",
    image: "/assets/programs/mandala-library/mandala-14.png",
    quote: "그대 자신에 대한 존경을 잃지 마라. 그리고 스스로 비천하게 되지 마라.",
    author: "발타자르 그라시안",
    moodTags: ["자존감", "자기존중", "힘"],
  },
  {
    id: "mandala-15",
    image: "/assets/programs/mandala-library/mandala-15.png",
    quote: "본다는 것은 우리에게 세계의 넓고 넓은 지평을 열어 준다.",
    author: "카알 라너",
    moodTags: ["통찰", "열림", "호기심"],
  },
  {
    id: "mandala-16",
    image: "/assets/programs/mandala-library/mandala-16.png",
    quote: "당신은 배에 탔습니다.\n당신은 항해를 했습니다.\n당신은 해변에 도착했습니다.\n이제 내리십시오.",
    author: "아우렐리우스",
    moodTags: ["수용", "내려놓기", "마무리"],
  },
  {
    id: "mandala-17",
    image: "/assets/programs/mandala-library/mandala-17.png",
    quote: "아침이 오면\n나와 미풍은 함께\n빛을 선포한다.\n저녁이면 새와 나는 빛에게 작별의 말을 한다.",
    author: "칼릴 지브란",
    moodTags: ["평온", "새로운 시작", "리듬"],
  },
  {
    id: "mandala-18",
    image: "/assets/programs/mandala-library/mandala-18.png",
    quote: "도는 텅 비어 있다.\n그러나 아무리 퍼내어 써도\n고갈되지 않는다.\n그윽하도다!",
    author: "노자",
    moodTags: ["비움", "자유연상", "무한함"],
  },
];
