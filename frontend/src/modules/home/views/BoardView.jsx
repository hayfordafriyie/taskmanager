import { useState } from "react";
import { PlusIcon, PersonIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, Avatar } from "../ui";
import Select from "../../../components/Select";
import Modal from "../../../components/Modal";
import { useMyTeam } from "../../invite/hooks";
import {
  useTeamTasks,
  useCreateTask,
  useAssignTask,
  useSetTaskStatus,
  useUpdateTask,
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
  const updateTask = useUpdateTask();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, defineStatus] = useState("TODO");
  const [assigneeId, setAssigneeId] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const members = team?.members ?? [];
  const busy = createTask.isPending || setStatus.isPending || assignTask.isPending;

  function openAdd() {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    defineStatus("TODO");
    setAssigneeId("");
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority || "MEDIUM");
    defineStatus(task.status || "TODO");
    setAssigneeId(task.assignee?.id ?? "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a task title first.");
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assigneeId: assigneeId || null,
    };
    const options = {
      onSuccess: (res) => {
        const r = editingTask ? res?.data?.updateTask : res?.data?.createTask;
        if (r?.success) {
          closeModal();
          toast.success(r.message);
        } else {
          toast.error(r?.message || "Could not save the task.");
        }
      },
      onError: (err) => toast.error(err.message),
    };
    if (editingTask) {
      updateTask.mutate({ taskId: editingTask.id, input: { ...input, status } }, options);
    } else {
      createTask.mutate({ input }, options);
    }
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
            onClick={openAdd}
            className="seg-btn"
            aria-haspopup="dialog"
          >
            <PlusIcon width={14} height={14} />
            Add task
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o) closeModal();
        }}
        title={editingTask ? "Edit task" : "New task"}
        description={editingTask ? "Update the task details." : "Describe the work to be done."}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-gloss-ghost rounded-full px-5 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              form="task-form"
              disabled={busy}
              className="btn-gloss-primary rounded-full px-5 py-2.5 text-sm"
            >
              {busy ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium t-soft">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              aria-label="Task title"
              autoFocus
              className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium t-soft">
              Description <span className="t-faint">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail…"
              aria-label="Description"
              rows={3}
              className="control w-full resize-y rounded-[0.85rem] px-3.5 py-2.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            {editingTask && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Status</span>
                <Select
                  value={status}
                  onValueChange={defineStatus}
                  options={STATUS_SELECT_OPTIONS}
                  ariaLabel="Status"
                  size="md"
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

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
                        onEdit={() => openEdit(t)}
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

function TaskCard({ task, members, dragId, onDragStart, onDragEnd, onEdit, onStatus, onAssignee }) {
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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium t-ink">{task.title}</p>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit task ${task.title}`}
          className="btn-gloss-ghost grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs"
        >
          <Pencil2Icon width={13} height={13} />
        </button>
      </div>

      {task.description && (
        <p className="mt-0.5 line-clamp-3 text-xs t-soft">{task.description}</p>
      )}

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
