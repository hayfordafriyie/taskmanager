import { useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent } from "react";
import { errorMessage } from "../../../lib/errors";
import { TargetIcon, PlusIcon, TrashIcon, Cross2Icon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PolicyBadge } from "../ui";
import Select from "../../../components/Select";
import { useAuth } from "../../auth/AuthContext";
import { useMyTeam } from "../../invite/hooks";
import {
  useTeamGoals,
  useCreateGoal,
  useUpdateGoalStatus,
  useCreateKeyResult,
  useSetKeyResultProgress,
  useDeleteGoal,
  GOAL_STATUS_LABEL,
  GOAL_STATUS_OPTIONS,
} from "../../goals/hooks";
import { useToast } from "../../../components/Toast";
import type { PersonNameFields } from "../../../types/home";
import type {
  GoalKeyResultDrafts,
  GoalOwnerOption,
  GoalProgressRingProps,
  GoalStatus,
} from "../../../types/goals";
import type { ID, TeamMember } from "../../../types/common";

function ProgressRing({ value }: GoalProgressRingProps) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={radius} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="6" fill="none" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-sky-500"
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        className="fill-zinc-900 font-display text-sm font-bold dark:fill-zinc-100"
      >
        {value}%
      </text>
    </svg>
  );
}

function nameOf(user?: PersonNameFields | null): string {
  if (!user) return "Unassigned";
  return `${user.firstName ?? ""} ${user.surname ?? ""}`.trim() || "Teammate";
}

export function GoalsView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: team } = useMyTeam();
  const { data: goals = [], isLoading } = useTeamGoals({ enabled: !!user?.id });

  const createGoal = useCreateGoal();
  const updateStatus = useUpdateGoalStatus();
  const createKeyResult = useCreateKeyResult();
  const setKrProgress = useSetKeyResultProgress();
  const deleteGoal = useDeleteGoal();

  const [showNew, setShowNew] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [status, setStatus] = useState<GoalStatus>("ON_TRACK");
  const [newKr, setNewKr] = useState<GoalKeyResultDrafts>({});

  const members = team?.members ?? [];

  function handleCreate(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a goal title first.");
      return;
    }
    createGoal.mutate(
      {
        input: {
          title: title.trim(),
          description: description.trim(),
          status,
          ownerId: ownerId || null,
        },
      },
      {
        onSuccess: (res) => {
          const r = res?.data?.createGoal;
          if (r?.success) {
            setTitle("");
            setDescription("");
            setOwnerId("");
            setStatus("ON_TRACK");
            setShowNew(false);
            toast.success(r.message);
          } else {
            toast.error(r?.message || "Could not create the goal.");
          }
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  function addKeyResult(goalId: ID): void {
    const value = (newKr[goalId] || "").trim();
    if (!value) return;
    createKeyResult.mutate(
      { goalId, title: value },
      {
        onSuccess: (res) => {
          const r = res?.data?.createKeyResult;
          if (r && !r.success) toast.error(errorMessage(r, "Something went wrong"));
          setNewKr((prev) => ({ ...prev, [goalId]: "" }));
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  return (
    <div>
      <ViewHeader title="Goals" subtitle="Objectives and key results for the quarter." />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="btn-gloss-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
        >
          <PlusIcon width={14} height={14} />
          New goal
        </button>
        <span className="text-xs t-soft">
          {goals.length} goal{goals.length === 1 ? "" : "s"}
        </span>
      </div>

      {user?.id && !isLoading && goals.length === 0 && (
        <Panel className="mt-4">
          <p className="py-8 text-center text-sm t-soft">
            No goals yet — create one to start tracking objectives.
          </p>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => (
          <Panel key={g.id}>
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TargetIcon width={16} height={16} className="t-faint shrink-0" />
                <h2 className="truncate font-display text-sm font-semibold t-ink">
                  {g.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label={`Delete goal ${g.title}`}
                onClick={() =>
                  deleteGoal.mutate(
                    { goalId: g.id },
                    { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
                  )
                }
                className="ring-accent shrink-0 rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-red-500"
              >
                <TrashIcon width={13} height={13} />
              </button>
            </header>

            {g.description && <p className="mt-1 text-xs t-soft">{g.description}</p>}

            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={g.progress} />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-xs t-soft">Owner</p>
                  <p className="truncate text-sm font-medium t-ink">{nameOf(g.owner)}</p>
                </div>
                <Select
                  ariaLabel={`Status of ${g.title}`}
                  value={g.status}
                  onValueChange={(value) =>
                    updateStatus.mutate(
                      { goalId: g.id, status: value },
                      { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
                    )
                  }
                  options={GOAL_STATUS_OPTIONS}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <PolicyBadge tone={GOAL_STATUS_LABEL[g.status]} className="shrink-0">
                {GOAL_STATUS_LABEL[g.status] || g.status}
              </PolicyBadge>
              {g.dueAt && (
                <span className="text-xs t-faint">
                  Due {new Date(g.dueAt).toLocaleDateString()}
                </span>
              )}
              <span className="ml-auto text-xs t-faint">
                {g.keyResults.length} result{g.keyResults.length === 1 ? "" : "s"}
              </span>
            </div>

            <ul className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
              {g.keyResults.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate t-ink">{r.title}</span>
                    <span className="ml-2 shrink-0 text-xs t-faint">{r.progress}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={r.progress}
                      aria-label={`Progress of ${r.title}`}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setKrProgress.mutate(
                          { keyResultId: r.id, progress: Number(e.target.value) },
                          { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
                        )
                      }
                      className="h-1.5 w-full cursor-pointer accent-sky-500"
                    />
                  </div>
                </li>
              ))}
              {g.keyResults.length === 0 && (
                <li className="text-xs t-faint">No key results yet.</li>
              )}
            </ul>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={newKr[g.id] || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewKr((prev) => ({ ...prev, [g.id]: e.target.value }))}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyResult(g.id);
                  }
                }}
                placeholder="Add a key result…"
                aria-label={`New key result for ${g.title}`}
                className="control w-full rounded-full px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => addKeyResult(g.id)}
                aria-label={`Add key result to ${g.title}`}
                className="btn-gloss-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              >
                <PlusIcon width={13} height={13} />
              </button>
            </div>
          </Panel>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={(e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="glass-pop mt-16 w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold t-ink">New goal</h3>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                aria-label="Close new goal"
                className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-3 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Title</span>
                <input
                  value={title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="What do you want to achieve?"
                  aria-label="Goal title"
                  className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">
                  Description <span className="t-faint">(optional)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Add context…"
                  aria-label="Goal description"
                  rows={2}
                  className="control w-full resize-y rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Owner</span>
                <Select
                  ariaLabel="Goal owner"
                  value={ownerId || user?.id || ""}
                  onValueChange={setOwnerId}
                  options={Array.from(new Map<string, TeamMember>(members.map((m): [string, TeamMember] => [m.id, m])).values()).map((m): GoalOwnerOption => ({
                    value: m.id,
                    label: nameOf(m),
                    member: m,
                  }))}
                  size="md"
                  className="w-full"
                  // The trigger shows the member's name, truncated — no
                  // initials or icons anywhere in member selectors.
                  renderValue={
                    <span
                      className="block max-w-[12rem] truncate"
                      title={nameOf(members.find((m) => m.id === (ownerId || user?.id)))}
                    >
                      {nameOf(members.find((m) => m.id === (ownerId || user?.id))) || "Unassigned"}
                    </span>
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Status</span>
                <Select
                  ariaLabel="Goal status"
                  value={status}
                  onValueChange={setStatus}
                  options={GOAL_STATUS_OPTIONS}
                  size="md"
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={createGoal.isPending}
                className="btn-gloss-primary w-full rounded-full px-3.5 py-2.5 text-sm"
              >
                {createGoal.isPending ? "Creating…" : "Create goal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsView;
