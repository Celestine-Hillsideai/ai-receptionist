import { login } from "@/app/login/actions";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm border border-rule bg-panel p-8">
        <h1 className="font-serif text-xl font-semibold text-ink">Front Desk</h1>
        <p className="mt-1 mb-6 text-sm text-ink-quiet">Enter the dashboard password to continue.</p>

        <form action={login} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-quiet">
            Password
            <input
              type="password"
              name="password"
              required
              className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
            />
          </label>
          {error && <p className="text-sm text-urgency-critical">Incorrect password.</p>}
          <button
            type="submit"
            className="mt-2 border border-ink bg-ink px-3 py-1.5 text-sm text-paper hover:bg-ink/90"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
