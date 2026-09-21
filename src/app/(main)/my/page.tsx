import { requireProfile } from "@/lib/session";
import { AVATAR_PRESETS, stageLabelForXp } from "@/lib/constants";
import { updateProfile, selectAvatar, signOut } from "./actions";

export default async function MyPage() {
  const { profile } = await requireProfile();

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-8">
      <header className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold">마이</h1>
          <p className="text-sm text-muted">{stageLabelForXp(profile.xp)}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/profile/avatar-profile.png"
          alt="Profile"
          className="w-16 h-16 rounded-full border-2 border-line ml-auto object-cover"
        />
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-bold">아바타</h2>
        <div className="flex justify-center">
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_PRESETS.map((a) => (
              <form key={a.id} action={selectAvatar}>
                <input type="hidden" name="avatar_id" value={a.id} />
                <button
                  type="submit"
                  className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg ${
                    profile.avatar_id === a.id ? "border-sage" : "border-transparent"
                  }`}
                  style={{ background: a.shirt, width: "48px", height: "48px" }}
                  aria-label={a.label}
                >
                  🧑
                </button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <form action={updateProfile} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-bold">프로필</h2>
        <label className="flex flex-col gap-1 text-xs text-muted">
          닉네임
          <input
            name="nickname"
            defaultValue={profile.nickname}
            required
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          소개
          <textarea
            name="bio"
            defaultValue={profile.bio}
            rows={3}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          공개 범위
          <select
            name="visibility"
            defaultValue={profile.visibility}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
          >
            <option value="public">전체 공개</option>
            <option value="friends">친구 공개</option>
            <option value="private">비공개</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white">
          저장하기
        </button>
      </form>

      <form action={signOut}>
        <button type="submit" className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
          로그아웃
        </button>
      </form>
    </div>
  );
}
