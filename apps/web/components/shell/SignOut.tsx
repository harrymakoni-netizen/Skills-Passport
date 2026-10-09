'use client';

export function SignOut() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-sp-csrf': '1' } });
        window.location.assign('/login');
      }}
      className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-muted hover:bg-sunk hover:text-text"
    >
      Sign out
    </button>
  );
}
