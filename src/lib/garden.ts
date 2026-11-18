// Decorations that grow on the home map as the user earns XP (+5 per record,
// capped at 100). `w` is the item's width as a percentage of a tall map; where
// each item stands is defined per map in app/(main)/home/maps.ts.
export const GARDEN_ITEMS = [
  { key: "sprout", name: "새싹", xp: 5, w: 6 },
  { key: "tulips", name: "튤립", xp: 10, w: 8.5 },
  { key: "sunflower", name: "해바라기", xp: 20, w: 6 },
  { key: "cat", name: "고양이", xp: 30, w: 7.5 },
  { key: "appletree", name: "사과나무", xp: 40, w: 12 },
  { key: "bluebird", name: "파랑새", xp: 50, w: 5 },
  { key: "mushroom", name: "버섯", xp: 65, w: 7 },
  { key: "birdhouse", name: "새집", xp: 80, w: 6.5 },
] as const;

export type GardenItem = (typeof GARDEN_ITEMS)[number];

export function unlockedGarden(xp: number) {
  return GARDEN_ITEMS.filter((i) => xp >= i.xp);
}

export function nextGardenItem(xp: number) {
  return GARDEN_ITEMS.find((i) => xp < i.xp) ?? null;
}

// Consecutive KST calendar days with at least one record, ending today
// (or yesterday, so the streak survives until the day is over).
export function recordStreak(createdAt: string[], now = new Date()) {
  const kst = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const days = new Set(createdAt.map((iso) => kst(new Date(iso))));
  const DAY = 86_400_000;
  let cursor = now.getTime();
  if (!days.has(kst(new Date(cursor)))) cursor -= DAY;
  let streak = 0;
  while (days.has(kst(new Date(cursor)))) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}
