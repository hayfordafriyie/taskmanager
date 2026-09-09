import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../../lib/api';
import Button from '../../components/Button';
import PhoneInput from '../../components/PhoneInput';
import { useToast } from '../../components/Toast';

export default function Signup() {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    if (!phone) {
      toast.error('Enter your phone number first.');
      return;
    }
    setBusy(true);
    try {
      const res = await gql(
        'mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }',
        { phone },
      );
      const result = res?.data?.requestOTP;
      if (result?.success) {
        toast.success(result?.message ?? 'Code sent to your phone.');
      } else {
        toast.error(result?.message ?? 'Unexpected response');
      }
    } catch (err) {
      toast.error(err.message);
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
        <PhoneInput value={phone} onChange={setPhone} />
        <Button
          type="submit"
          disabled={busy || !phone}
          className="w-full"
        >
          {busy ? 'Sending…' : 'Request code'}
        </Button>
      </form>
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