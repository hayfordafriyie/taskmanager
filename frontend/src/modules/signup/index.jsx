import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import PhoneInput from "../../components/PhoneInput";
import PasswordInput from "../../components/PasswordInput";
import OtpEntry from "../../components/OtpEntry";
import { useToast } from "../../components/Toast";
import { useRequestOtp } from "./hooks/useRequestOtp";
import { useVerifyOtp } from "./hooks/useVerifyOtp";
import { useCreateAccount } from "./hooks/useCreateAccount";

const inputClass =
  "control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm";

export default function Signup() {
  const navigate = useNavigate();
  const toast = useToast();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const createAccount = useCreateAccount();
  const [stage, setStage] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [otherNames, setOtherNames] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function sendCode() {
    if (!phone) {
      return false;
    }
    try {
      const res = await requestOtp.mutateAsync(phone);
      const result = res?.data?.requestOTP;
      if (result?.success) {
        toast.success(result?.message ?? "Code sent to your phone.");
        return true;
      }
      toast.error(result?.message ?? "Unexpected response");
      return false;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async function handleRequest(e) {
    e.preventDefault();
    if (!phone) {
      toast.error("Enter your phone number first.");
      return;
    }
    const ok = await sendCode();
    if (ok) {
      setStage("otp");
      setCode("");
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!code) {
      toast.error("Enter the code we sent you.");
      return;
    }
    try {
      const res = await verifyOtp.mutateAsync({ phone, code });
      const result = res?.data?.verifyOTP;
      if (result?.success) {
        toast.success(result?.message ?? "Phone verified.");
        setStage("account");
      } else {
        toast.error(result?.message ?? "Verification failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!firstName || !surname || !password) {
      toast.error("Fill in your name and choose a password.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      const res = await createAccount.mutateAsync({
        phone,
        firstName,
        surname,
        otherNames: otherNames || null,
        password,
        confirmPassword: confirm,
      });
      const result = res?.data?.createAccount;
      if (result?.success) {
        navigate("/login", {
          replace: true,
          state: { notice: "Account created. Please log in." },
        });
      } else {
        toast.error(result?.message ?? "Failed to create account");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl font-bold t-ink">
        Signup
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {stage === "phone" &&
          "We’ll text a verification code to your phone."}
        {stage === "otp" &&
          "Enter the code we sent to confirm your phone number."}
        {stage === "account" && "Almost done — set up your profile."}
      </p>

      {stage === "phone" && (
        <form onSubmit={handleRequest} className="mt-6 space-y-4">
          <PhoneInput value={phone} onChange={setPhone} />
          <Button
            type="submit"
            disabled={requestOtp.isPending || !phone}
            className="w-full"
          >
            {requestOtp.isPending ? "Sending…" : "Request code"}
          </Button>
        </form>
      )}

      {stage === "otp" && (
        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <PhoneInput value={phone} onChange={setPhone} disabled />
          <OtpEntry
            value={code}
            onChange={setCode}
            onResend={sendCode}
          />
          <Button
            type="submit"
            disabled={verifyOtp.isPending || !code}
            className="w-full"
          >
            {verifyOtp.isPending ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      )}

      {stage === "account" && (
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <PhoneInput value={phone} onChange={setPhone} disabled />
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className={inputClass}
          />
          <input
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Surname"
            className={inputClass}
          />
          <input
            value={otherNames}
            onChange={(e) => setOtherNames(e.target.value)}
            placeholder="Other names (optional)"
            className={inputClass}
          />
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Password"
          />
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm password"
          />
          <Button
            type="submit"
            disabled={
              createAccount.isPending ||
              !firstName ||
              !surname ||
              !password ||
              !confirm
            }
            className="w-full"
          >
            {createAccount.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          to="/login"
          className="accent-text font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}