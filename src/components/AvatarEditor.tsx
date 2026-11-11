"use client";

import { Shuffle } from "lucide-react";
import PixelAvatar from "@/components/PixelAvatar";
import {
  ACCESSORIES,
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  encodeLook,
  parseLook,
  randomLook,
  type AvatarLook,
} from "@/lib/avatarLook";
import { playSfx } from "@/lib/sfx";

// Live pixel-avatar customizer. Controlled: `value` is the avatar_id code.
export default function AvatarEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const look = parseLook(value);
  const set = (patch: Partial<AvatarLook>) => onChange(encodeLook({ ...look, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <div className="flex h-28 w-28 items-center justify-center rounded-lg border-[3px] border-outline bg-[#cfe3a8] bg-[radial-gradient(circle_at_50%_85%,#b8d68a_0_30%,transparent_31%)] shadow-[0_3px_0_var(--color-outline)]">
          <PixelAvatar avatarId={encodeLook(look)} className="w-14" />
        </div>
        <button
          type="button"
          data-sfx="none"
          onClick={() => {
            playSfx("open");
            onChange(encodeLook(randomLook()));
          }}
          className="px-btn px-btn-cream px-3 py-2 text-xs"
        >
          <Shuffle size={14} /> 랜덤
        </button>
      </div>

      <Row label="머리 모양">
        {HAIR_STYLES.map((name, i) => (
          <Chip key={name} on={look.hair === i} onClick={() => set({ hair: i })}>
            {name}
          </Chip>
        ))}
      </Row>
      <Row label="머리색">
        {HAIR_COLORS.map((c, i) => (
          <Swatch key={c} color={c} on={look.hairColor === i} onClick={() => set({ hairColor: i })} />
        ))}
      </Row>
      <Row label="피부">
        {SKIN_TONES.map((c, i) => (
          <Swatch key={c} color={c} on={look.skin === i} onClick={() => set({ skin: i })} />
        ))}
      </Row>
      <Row label="상의">
        {SHIRT_COLORS.map((c, i) => (
          <Swatch key={c} color={c} on={look.shirt === i} onClick={() => set({ shirt: i })} />
        ))}
      </Row>
      <Row label="바지">
        {PANTS_COLORS.map((c, i) => (
          <Swatch key={c} color={c} on={look.pants === i} onClick={() => set({ pants: i })} />
        ))}
      </Row>
      <Row label="소품">
        {ACCESSORIES.map((name, i) => (
          <Chip key={name} on={look.acc === i} onClick={() => set({ acc: i })}>
            {name}
          </Chip>
        ))}
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-label text-xs text-ink">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`px-chip px-2.5 py-1 text-xs ${on ? "px-chip-on" : ""}`}>
      {children}
    </button>
  );
}

function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-sfx="select"
      onClick={onClick}
      aria-pressed={on}
      aria-label={color}
      className={`h-7 w-7 rounded-[5px] border-2 border-outline transition ${
        on ? "scale-110 ring-2 ring-sage ring-offset-1" : "hover:scale-105"
      }`}
      style={{ background: color }}
    />
  );
}
