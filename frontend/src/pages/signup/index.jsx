import { useState } from 'react';
import { gql } from '../../lib/api';

export default function Signup() {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState(''); 
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await gql(
        'mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }',
        { phone },
      );
      const result = res?.data?.requestOTP;
      setStatus({
        kind: result?.success ? 'ok' : 'error',
        text: result?.message ?? 'Unexpected response',
      });
    } catch (err) {
      setStatus({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Signup
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Signup page placeholder
      </p>
      <form onSubmit={requestCode} className="mt-6 space-y-4">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+233..."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy || !phone}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Request code'}
        </button>
      </form>
      {status && (
        <p
          className={`mt-4 text-sm ${
            status.kind === 'ok'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}