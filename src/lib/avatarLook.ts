// A user's pixel avatar look, stored in profiles.avatar_id as a short code
// like "v1-s1h0c1t0p0a0". Legacy preset ids ("a1".."a6") still parse, so
// existing profiles keep looking the same without a migration.

export const SKIN_TONES = ["#E4C1A3", "#D7AD8D", "#C99C7B", "#B98261", "#9A664D", "#6F4633"] as const;

export const HAIR_COLORS = [
  "#2a221e", // black
  "#4a3426", // dark brown
  "#6F5A43", // brown
  "#A0522D", // auburn
  "#D9A441", // blonde
  "#E8E3D8", // silver
  "#C46A8A", // pink
  "#5B7FB5", // blue
] as const;

export const SHIRT_COLORS = [
  "#8BA08B",
  "#758DA6",
  "#B07B6E",
  "#9A8BB0",
  "#6F9888",
  "#C29372",
  "#E07A5F",
  "#F2CC8F",
  "#F4F1DE",
  "#3D405B",
] as const;

export const PANTS_COLORS = ["#55606b", "#3b4252", "#6b5440", "#4f6b3a", "#2b2b2b", "#c2b59b"] as const;

export const HAIR_STYLES = ["짧은 머리", "긴 머리", "단발", "삐죽 머리", "똥머리"] as const;
export const ACCESSORIES = ["없음", "안경", "꽃핀", "모자"] as const;

export type AvatarLook = {
  skin: number;
  hair: number;
  hairColor: number;
  shirt: number;
  pants: number;
  acc: number;
};

export const DEFAULT_LOOK: AvatarLook = { skin: 1, hair: 0, hairColor: 1, shirt: 0, pants: 0, acc: 0 };

// The original six presets, mapped onto the palettes above.
const PRESETS: Record<string, AvatarLook> = {
  a1: { skin: 1, hair: 0, hairColor: 1, shirt: 0, pants: 0, acc: 0 },
  a2: { skin: 4, hair: 0, hairColor: 0, shirt: 1, pants: 0, acc: 0 },
  a3: { skin: 5, hair: 0, hairColor: 0, shirt: 2, pants: 0, acc: 0 },
  a4: { skin: 0, hair: 0, hairColor: 2, shirt: 3, pants: 0, acc: 0 },
  a5: { skin: 3, hair: 0, hairColor: 0, shirt: 4, pants: 0, acc: 0 },
  a6: { skin: 2, hair: 0, hairColor: 0, shirt: 5, pants: 0, acc: 0 },
};

const LIMITS: Record<keyof AvatarLook, number> = {
  skin: SKIN_TONES.length,
  hair: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  shirt: SHIRT_COLORS.length,
  pants: PANTS_COLORS.length,
  acc: ACCESSORIES.length,
};

const CODE = /^v1-s(\d+)h(\d+)c(\d+)t(\d+)p(\d+)a(\d+)$/;

export function parseLook(id: string | null | undefined): AvatarLook {
  if (!id) return DEFAULT_LOOK;
  if (PRESETS[id]) return PRESETS[id];
  const m = CODE.exec(id);
  if (!m) return DEFAULT_LOOK;
  const [skin, hair, hairColor, shirt, pants, acc] = m.slice(1).map(Number);
  const look = { skin, hair, hairColor, shirt, pants, acc };
  // Out-of-range parts fall back to the default rather than breaking the sprite.
  for (const k of Object.keys(LIMITS) as (keyof AvatarLook)[]) {
    if (!(look[k] >= 0 && look[k] < LIMITS[k])) look[k] = DEFAULT_LOOK[k];
  }
  return look;
}

export function encodeLook(l: AvatarLook) {
  return `v1-s${l.skin}h${l.hair}c${l.hairColor}t${l.shirt}p${l.pants}a${l.acc}`;
}

/** Re-encode any client-sent avatar id into a known-valid one. */
export function normalizeAvatarId(raw: unknown) {
  return encodeLook(parseLook(typeof raw === "string" ? raw : null));
}

export function randomLook(): AvatarLook {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    skin: pick(LIMITS.skin),
    hair: pick(LIMITS.hair),
    hairColor: pick(LIMITS.hairColor),
    shirt: pick(LIMITS.shirt),
    pants: pick(LIMITS.pants),
    acc: pick(LIMITS.acc),
  };
}
