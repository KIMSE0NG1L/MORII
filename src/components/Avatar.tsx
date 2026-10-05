import { avatarById } from "@/lib/constants";

// Small full-body character drawn from the preset's colors. Used for
// profile pictures and for the walkers in the group exhibition hall.
export default function Avatar({
  avatarId,
  size = 64,
  className = "",
}: {
  avatarId: string;
  size?: number;
  className?: string;
}) {
  const a = avatarById(avatarId);
  return (
    <svg
      viewBox="0 0 40 64"
      width={(size * 40) / 64}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* legs */}
      <rect x="13" y="42" width="6" height="18" rx="3" fill={a.pants} />
      <rect x="21" y="42" width="6" height="18" rx="3" fill={a.pants} />
      {/* body + arms */}
      <rect x="10" y="24" width="20" height="22" rx="8" fill={a.shirt} />
      <rect x="5" y="26" width="6" height="15" rx="3" fill={a.shirt} />
      <rect x="29" y="26" width="6" height="15" rx="3" fill={a.shirt} />
      <circle cx="8" cy="41" r="2.6" fill={a.skin} />
      <circle cx="32" cy="41" r="2.6" fill={a.skin} />
      {/* head */}
      <circle cx="20" cy="14" r="10" fill={a.skin} />
      <path d="M10 14 a10 10 0 0 1 20 0 q-4 -4 -10 -4 q-6 0 -10 4z" fill={a.hair} />
      <circle cx="16.5" cy="15.5" r="1.2" fill="#2a2a2a" />
      <circle cx="23.5" cy="15.5" r="1.2" fill="#2a2a2a" />
      <path d="M17.5 19 q2.5 2 5 0" stroke="#2a2a2a" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
