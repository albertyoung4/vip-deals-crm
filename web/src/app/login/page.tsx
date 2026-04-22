import { login } from "./actions";

const ERRORS: Record<string, string> = {
  domain: "Only @rebuilt.com emails are allowed.",
  inactive: "That account is inactive. Ask an admin to reactivate it.",
  insert: "Could not create your account. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : null;

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold">VIP Deals CRM</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Sign in with your @rebuilt.com email.
      </p>

      {message && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </div>
      )}

      <form action={login} className="flex flex-col gap-3 rounded-lg border bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Email</span>
          <input
            type="email"
            name="email"
            required
            autoFocus
            placeholder="you@rebuilt.com"
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
