export const GARDEN_STAGES = [
  { name: "씨앗", emoji: "🌰" },
  { name: "새싹", emoji: "🌱" },
  { name: "꽃밭", emoji: "🌷" },
  { name: "풍성한 정원", emoji: "🌳" },
] as const;

export function stageIndexForXp(xp: number) {
  if (xp < 20) return 0;
  if (xp < 50) return 1;
  if (xp < 80) return 2;
  return 3;
}

export function stageLabelForXp(xp: number) {
  const i = stageIndexForXp(xp);
  const stage = GARDEN_STAGES[i];
  return `${stage.emoji} ${stage.name} Lv.${i + 1}`;
}

// Decorations that unlock automatically as the garden stage advances.
// index < stageIndex means "unlocked" - mirrors the Flutter prototype's
// `_syncStageObjects`.
export const STAGE_UNLOCK_ITEMS = [
  { key: "tree", emoji: "🌳", left: 0.12, top: 0.47, fontSize: 46 },
  { key: "flower", emoji: "🌼", left: 0.7, top: 0.69, fontSize: 35 },
  { key: "cat", emoji: "🐈", left: 0.57, top: 0.7, fontSize: 33 },
] as const;

// Naive keyword -> garden object mapping for the "마음공간" free-text feature.
export const TEXT_TO_GARDEN_ITEMS = [
  { keywords: ["친구"], key: "friend", emoji: "🧑", left: 0.76, top: 0.57, fontSize: 40 },
  { keywords: ["강아지"], key: "dog", emoji: "🐕", left: 0.28, top: 0.7, fontSize: 40 },
  { keywords: ["고양이"], key: "cat2", emoji: "🐈", left: 0.6, top: 0.7, fontSize: 40 },
  { keywords: ["꽃"], key: "flower2", emoji: "🌷", left: 0.78, top: 0.73, fontSize: 35 },
  { keywords: ["집", "쉼터"], key: "house", emoji: "🏡", left: 0.65, top: 0.43, fontSize: 40 },
  { keywords: ["나무", "숲"], key: "tree2", emoji: "🌲", left: 0.2, top: 0.42, fontSize: 40 },
] as const;

export const GARDEN_THEMES = {
  forest: { top: "#DCE9E6", bottom: "#B8C9A5" },
  night: { top: "#354257", bottom: "#65755E" },
  sea: { top: "#BCDCE5", bottom: "#91C3C8" },
} as const;

export const AVATAR_PRESETS = [
  { id: "a1", label: "Avatar 1", skin: "#D7AD8D", hair: "#3D332E", shirt: "#8BA08B", pants: "#59636D" },
  { id: "a2", label: "Avatar 2", skin: "#9A664D", hair: "#2E2624", shirt: "#758DA6", pants: "#515862" },
  { id: "a3", label: "Avatar 3", skin: "#6F4633", hair: "#171717", shirt: "#B07B6E", pants: "#535D58" },
  { id: "a4", label: "Avatar 4", skin: "#E4C1A3", hair: "#6F5A43", shirt: "#9A8BB0", pants: "#5D6674" },
  { id: "a5", label: "Avatar 5", skin: "#B98261", hair: "#2F2D2B", shirt: "#6F9888", pants: "#59636A" },
  { id: "a6", label: "Avatar 6", skin: "#C99C7B", hair: "#1F1D1D", shirt: "#C29372", pants: "#5C6670" },
] as const;

export function avatarById(id: string) {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0];
}

export const MOODS = ["😞", "😕", "😐", "🙂", "😄"] as const;

// 마음 체크 문항. 모두 "높을수록 편안한" 방향이라 평균을 그대로 점수로 쓴다.
export const MOOD_CHECK_QUESTIONS = [
  { id: "mood", question: "오늘 기분은 어떤가요?", low: "많이 가라앉아요", high: "아주 좋아요" },
  { id: "energy", question: "몸의 에너지는 어느 정도인가요?", low: "지쳐 있어요", high: "활기차요" },
  { id: "calm", question: "마음이 얼마나 편안한가요?", low: "불안하고 답답해요", high: "편안해요" },
  { id: "focus", question: "지금 집중이 잘 되나요?", low: "산만해요", high: "또렷해요" },
  { id: "express", question: "마음을 표현하고 싶은 정도는요?", low: "조용히 있고 싶어요", high: "마음껏 표현하고 싶어요" },
] as const;

export type ActivityId = "free" | "mandala" | "collage" | "painting";

// 추천 활동별 작성 화면 설정. template은 캔버스에 미리 깔리는 도안,
// reference는 캔버스 위에 보여주는 감상용 이미지.
export const ACTIVITY_GUIDES: Record<
  ActivityId,
  { title: string; emoji: string; guide: string; mode: "draw" | "upload"; template?: string; reference?: string }
> = {
  free: {
    title: "자유화",
    emoji: "🖌️",
    guide: "떠오르는 색과 모양을 자유롭게 그려보세요. 잘 그릴 필요는 없어요.",
    mode: "draw",
  },
  mandala: {
    title: "만다라 색칠",
    emoji: "🎨",
    guide: "가운데에서 바깥으로, 마음이 끌리는 색으로 천천히 채워보세요.",
    mode: "draw",
    template: "/assets/programs/mandala-pattern.png",
  },
  collage: {
    title: "콜라주",
    emoji: "📰",
    guide: "캔버스의 🖼️ 사진 버튼으로 사진을 불러와 그 위에 덧그리고 꾸며보세요.",
    mode: "draw",
  },
  painting: {
    title: "명화 감상·그리기",
    emoji: "🖼️",
    guide: "그림을 천천히 감상하고, 느껴지는 감정이나 장면을 나만의 방식으로 그려보세요.",
    mode: "draw",
    reference: "/assets/gallery/painting-bg-1.png",
  },
};

export function isActivityId(value: unknown): value is ActivityId {
  return typeof value === "string" && value in ACTIVITY_GUIDES;
}

// 마음 체크 1-10 점수에 따른 추천 활동
export const MOOD_CHECK_ACTIVITIES: {
  range: readonly [number, number];
  label: string;
  activities: { id: ActivityId; reason: string }[];
}[] = [
  {
    range: [1, 3],
    label: "마음이 많이 힘든 날이네요",
    activities: [
      { id: "mandala", reason: "규칙적인 패턴이 마음을 차분하게 붙잡아줘요" },
      { id: "free", reason: "마음속 색을 그대로 꺼내 놓아보세요" },
    ],
  },
  {
    range: [4, 5],
    label: "마음이 조금 답답한 하루",
    activities: [
      { id: "mandala", reason: "차분한 색으로 마음을 정리해요" },
      { id: "painting", reason: "그림을 감상하며 잠시 쉬어가요" },
    ],
  },
  {
    range: [6, 7],
    label: "평온한 하루예요",
    activities: [
      { id: "painting", reason: "작가의 감정을 느끼고 나만의 그림으로 옮겨봐요" },
      { id: "free", reason: "마음 가는 대로 표현해요" },
    ],
  },
  {
    range: [8, 10],
    label: "기분 좋은 하루네요!",
    activities: [
      { id: "free", reason: "즐거움을 색으로 표현해봐요" },
      { id: "collage", reason: "좋아하는 사진으로 오늘을 꾸며봐요" },
    ],
  },
];

export function moodCheckResult(score: number) {
  const rounded = Math.min(10, Math.max(1, Math.round(score)));
  return (
    MOOD_CHECK_ACTIVITIES.find((r) => rounded >= r.range[0] && rounded <= r.range[1]) ??
    MOOD_CHECK_ACTIVITIES[0]
  );
}

export const MATERIAL_KINDS = [
  { id: "mind_card", label: "마음카드" },
  { id: "masterpiece", label: "명화 도안" },
  { id: "mandala", label: "만다라 도안" },
  { id: "activity", label: "활동자료" },
  { id: "etc", label: "기타" },
] as const;

export const NAV_ITEMS = [
  { href: "/home", label: "홈", shortLabel: "홈", iconName: "home" },
  { href: "/programs", label: "프로그램", shortLabel: "프로그램", iconName: "palette" },
  { href: "/diary", label: "마음기록", shortLabel: "마음기록", iconName: "bookOpen" },
  { href: "/exhibition", label: "우리들의 전시회", shortLabel: "전시회", iconName: "frame" },
  { href: "/my", label: "마이", shortLabel: "마이", iconName: "user" },
] as const;

// Keyword heuristic over the latest diary entry - not a real AI call, kept
// obviously mock-ish until a real recommendation backend exists.
export function recommendProgram(
  diaryText: string,
  templates: { id: string; title: string; icon: string; keywords: string[] }[],
) {
  const match = templates.find(
    (t) => t.keywords.length > 0 && t.keywords.some((k) => diaryText.includes(k)),
  );
  if (match) {
    return { ...match, reason: `최근 다이어리에서 느껴진 마음에 맞춰 "${match.title}"를 추천해요.` };
  }
  const fallback = templates.find((t) => t.keywords.length === 0) ?? templates[0];
  return fallback
    ? { ...fallback, reason: "꾸준히 나를 돌아보고 싶은 분들을 위한 여정을 추천해요." }
    : null;
}
