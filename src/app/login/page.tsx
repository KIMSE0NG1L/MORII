import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🎨</span>
        <h1 className="text-2xl font-bold">Me:seum</h1>
        <p className="text-sm text-muted">
          당신의 마음이 머무는 작은 전시공간.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
