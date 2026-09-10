import { useState } from "react";
import { PlusIcon, PersonIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, Avatar } from "../ui";
import Select from "../../../components/Select";
import { useMyTeam } from "../../invite/hooks";
import {
  useTeamTasks,
  useCreateTask,
  useAssignTask,
  useSetTaskStatus,
  toApiStatus,
} from "../../tasks/hooks";
import { useToast } from "../../../components/Toast";

const COLUMNS = [
  { key: "TODO", label: "To do", dot: "bg-zinc-400", tint: "text-zinc-400" },
  { key: "IN_PROGRESS", label: "In progress", dot: "bg-sky-500", tint: "text-sky-500" },
  { key: "REVIEW", label: "Review", dot: "bg-amber-500", tint: "text-amber-500" },
  { key: "DONE", label: "Done", dot: "bg-emerald-500", tint: "text-emerald-500" },
];

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const UNASSIGNED = "__none";

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUS_SELECT_OPTIONS = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
];

function priorityClass(p) {
  const map = {
    LOW: "tone-neutral",
    MEDIUM: "tone-amber",
    HIGH: "tone-red",
  };
  return map[p] || "tone-neutral";
}

function personLabel(m) {
  return `${m?.firstName ?? ""} ${m?.surname ?? ""}`.trim() || "Unassigned";
}

function initials(m) {
  if (!m) return "?";
  return `${(m.firstName?.[0] || "")}${(m.surname?.[0] || "")}`.toUpperCase();
}

export function BoardView() {
  const toast = useToast();
  const { data: team } = useMyTeam();
  const { data: tasks = [], isLoading } = useTeamTasks();

  const createTask = useCreateTask();
  const assignTask = useAssignTask();
  const setStatus = useSetTaskStatus();

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const members = team?.members ?? [];
  const busy = createTask.isPending || setStatus.isPending || assignTask.isPending;

  function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a task title first.");
      return;
    }
    createTask.mutate(
      {
        input: {
          title: title.trim(),
          priority,
          assigneeId: assigneeId || null,
        },
      },
      {
        onSuccess: (res) => {
          const r = res?.data?.createTask;
          if (r?.success) {
            setTitle("");
            setAssigneeId("");
            setShowAdd(false);
            toast.success(r.message);
          } else {
            toast.error(r?.message || "Could not create the task.");
          }
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function dropOn(columnKey) {
    if (!dragId) return;
    setStatus.mutate(
      { taskId: dragId, status: toApiStatus(columnKey) },
      {
        onSuccess: (res) => {
          const r = res?.data?.setTaskStatus;
          if (r && !r.success) toast.error(r.message);
        },
        onError: (err) => toast.error(err.message),
      },
    );
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div>
      <ViewHeader title="Board" subtitle="Drag tasks across columns or change their status manually." />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="seg">
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="seg-btn"
            aria-expanded={showAdd}
          >
            <PlusIcon width={14} height={14} />
            Add task
          </button>
        </div>
      </div>

      {showAdd && (
        <Panel className="mt-3">
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-medium t-soft">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                aria-label="Task title"
                className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium t-soft">Priority</span>
              <Select
                value={priority}
                onValueChange={setPriority}
                options={PRIORITY_OPTIONS}
                ariaLabel="Priority"
                size="md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium t-soft">Assignee</span>
              <Select
                value={assigneeId || UNASSIGNED}
                onValueChange={(v) => setAssigneeId(v === UNASSIGNED ? "" : v)}
                options={[
                  { value: UNASSIGNED, label: "Unassigned" },
                  ...members.map((m) => ({ value: m.id, label: personLabel(m) })),
                ]}
                ariaLabel="Assignee"
                size="md"
              />
            </div>
            <button
              type="submit"
              disabled={createTask.isPending}
              className="btn-gloss-primary rounded-full px-5 py-2.5 text-sm"
            >
              {createTask.isPending ? "Adding…" : "Add task"}
            </button>
          </form>
        </Panel>
      )}

      {isLoading ? (
        <p className="t-soft mt-6 text-sm">Loading tasks…</p>
      ) : (
        <div className="-mx-3 mt-6 flex snap-x gap-3 overflow-x-auto px-3 pb-4 sm:-mx-6 sm:gap-4 sm:px-6">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => toApiStatus(t.status) === col.key);
            const isOver = overCol === col.key;
            return (
              <Panel
                key={col.key}
                className={`w-72 shrink-0 snap-start transition-colors ${isOver ? "ring-2 ring-[var(--accent)]" : ""}`}
              >
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(col.key);
                  }}
                  onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                  onDrop={() => dropOn(col.key)}
                >
                  <header className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h2 className={`font-display text-sm font-semibold ${col.tint}`}>
                      {col.label}
                    </h2>
                    <span className="badge badge-tint px-2 py-0.5 text-xs">
                      {colTasks.length}
                    </span>
                  </header>

                  <ul className="mt-3 space-y-3">
                    {colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        members={members}
                        dragId={dragId}
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onStatus={(status) =>
                          setStatus.mutate(
                            { taskId: t.id, status },
                            { onError: (err) => toast.error(err.message) },
                          )
                        }
                        onAssignee={(memberId) =>
                          assignTask.mutate(
                            { taskId: t.id, assigneeId: memberId || null },
                            { onError: (err) => toast.error(err.message) },
                          )
                        }
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <li className="rounded-xl border border-dashed border-[var(--border-soft)] py-6 text-center text-xs t-faint">
                        Drop tasks here
                      </li>
                    )}
                  </ul>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs t-faint lg:hidden">
        <PersonIcon width={14} height={14} />
        Swipe columns sideways; drag cards to move status.
      </p>
    </div>
  );
}

function TaskCard({ task, members, dragId, onDragStart, onDragEnd, onStatus, onAssignee }) {
  const assignee = task.assignee;
  const dragging = dragId === task.id;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`glass-tile p-3 transition-all ${
        dragging ? "opacity-40" : "hover:-translate-y-0.5 hover:bg-[var(--glass-hover)]"
      }`}
    >
      <p className="text-sm font-medium t-ink">{task.title}</p>
      <p className="mt-0.5 truncate text-xs t-soft">{task.description}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`badge rounded-full px-2 py-0.5 text-xs ${priorityClass(task.priority)}`}>
          {PRIORITY_LABEL[task.priority] || task.priority}
        </span>
        <Avatar
          initial={initials(assignee)}
          className="h-6 w-6 text-[10px]"
          title={personLabel(assignee)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <Select
            ariaLabel={`Change status of ${task.title}`}
            value={task.status}
            onValueChange={onStatus}
            options={STATUS_SELECT_OPTIONS}
            size="sm"
            className="w-full"
          />
        </div>
        <Select
          ariaLabel={`Assignee of ${task.title}`}
          value={task.assignee?.id ?? UNASSIGNED}
          onValueChange={(v) => onAssignee(v === UNASSIGNED ? "" : v)}
          options={[
            { value: UNASSIGNED, label: "Unassigned" },
            ...members.map((m) => ({ value: m.id, label: personLabel(m) })),
          ]}
          size="sm"
          className="max-w-[7.5rem]"
        />
      </div>
    </li>
  );
}

export default BoardView;
