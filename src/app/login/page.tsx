import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🌱</span>
        <h1 className="text-2xl font-bold">MORII</h1>
        <p className="text-sm text-muted">
          매일 작은 마음을 돌보고, 나만의 마음정원을 가꿔보세요.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
