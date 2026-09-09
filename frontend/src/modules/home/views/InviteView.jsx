import { useState } from "react";
import { PaperPlaneIcon, PersonIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PolicyBadge, Avatar } from "../ui";
import { useToast } from "../../../components/Toast";

const roles = ["Member", "Admin", "Guest"];

const initialMembers = [
  { id: 1, name: "Kojo Owusu", email: "kojo@example.com", role: "Admin", initial: "KO" },
  { id: 2, name: "Ama Mensah", email: "ama@example.com", role: "Member", initial: "AM" },
  { id: 3, name: "Katherine Adu", email: "kate@example.com", role: "Guest", initial: "KA" },
];

export function InviteView() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");
  const [members, setMembers] = useState(initialMembers);

  function handleInvite(e) {
    e.preventDefault();
    if (!email) {
      toast.error("Enter an email address to invite.");
      return;
    }
    const name = email.split("@")[0].replace(/[._]/g, " ");
    const capitalize = name.replace(/\b\w/g, (c) => c.toUpperCase());
    const initial = email.slice(0, 2).toUpperCase();
    setMembers((prev) => [
      ...prev,
      { id: Date.now(), name: capitalize, email, role, initial },
    ]);
    setEmail("");
    toast.success(`Invite sent to ${email}`);
  }

  return (
    <div>
      <ViewHeader title="Invite" subtitle="Bring teammates into your workspace." />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel>
          <header className="flex items-center gap-2">
            <PaperPlaneIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Invite people
            </h2>
          </header>
          <form onSubmit={handleInvite} className="mt-3 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    role === r
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Send invite
            </button>
          </form>
        </Panel>

        <Panel className="lg:col-span-2">
          <header className="flex items-center gap-2">
            <PersonIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Members ({members.length})
            </h2>
          </header>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar initial={m.initial} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {m.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {m.email}
                  </p>
                </div>
                <PolicyBadge tone={m.role}>{m.role}</PolicyBadge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}