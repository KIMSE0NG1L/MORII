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

export const NAV_ITEMS = [
  { href: "/garden", label: "마음정원" },
  { href: "/programs", label: "프로그램" },
  { href: "/diary", label: "다이어리" },
  { href: "/gallery", label: "전시" },
  { href: "/my", label: "마이" },
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
