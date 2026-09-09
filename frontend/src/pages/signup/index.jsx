import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../../lib/api';
import Button from '../../components/Button';

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
        <Button
          type="submit"
          disabled={busy || !phone}
          className="w-full"
        >
          {busy ? 'Sending…' : 'Request code'}
        </Button>
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
      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}