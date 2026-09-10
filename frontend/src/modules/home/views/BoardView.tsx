import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { errorMessage } from "../../../lib/errors";
import { PlusIcon, PersonIcon, Pencil2Icon, CalendarIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";
import Select from "../../../components/Select";
import Modal from "../../../components/Modal";
import DatePicker from "../../../components/DatePicker";
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
import {
  buildDatePayload,
  formatWindow,
  isWindowReversed,
  toDateInput,
} from "../../tasks/dates";
import type { ApiResponse } from "../../../types/api";
import type {
  BoardAssigneeOption,
  BoardColumn,
  BoardTaskCardProps,
  MemberEntry,
  PriorityLabelMap,
} from "../../../types/board";
import type { ID, TeamMember } from "../../../types/common";
import type { PersonNameFields } from "../../../types/home";
import type {
  CreateTaskInput,
  Priority,
  Task,
  TaskMutationData,
  TaskStatus,
} from "../../../types/tasks";
import type { SelectOption } from "../../../types/ui";

const COLUMNS: ReadonlyArray<BoardColumn> = [
  { key: "TODO", label: "To do", dot: "bg-zinc-400", tint: "text-zinc-400" },
  { key: "IN_PROGRESS", label: "In progress", dot: "bg-sky-500", tint: "text-sky-500" },
  { key: "REVIEW", label: "Review", dot: "bg-amber-500", tint: "text-amber-500" },
  { key: "DONE", label: "Done", dot: "bg-emerald-500", tint: "text-emerald-500" },
];

const PRIORITY_LABEL: PriorityLabelMap = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const UNASSIGNED = "__none";

const PRIORITY_OPTIONS: ReadonlyArray<SelectOption<Priority>> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUS_SELECT_OPTIONS: ReadonlyArray<SelectOption<TaskStatus>> = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
];

function priorityClass(p: Priority): string {
  const map: Record<Priority, string> = {
    LOW: "tone-neutral",
    MEDIUM: "tone-amber",
    HIGH: "tone-red",
  };
  return map[p] || "tone-neutral";
}

function personLabel(m?: PersonNameFields | null): string {
  return `${m?.firstName ?? ""} ${m?.surname ?? ""}`.trim() || "Unassigned";
}


export function BoardView() {
  const toast = useToast();
  const { data: team } = useMyTeam();
  const { data: tasks = [], isLoading } = useTeamTasks();

  const createTask = useCreateTask();
  const assignTask = useAssignTask();
  const setStatus = useSetTaskStatus();
  const updateTask = useUpdateTask();

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, defineStatus] = useState<TaskStatus>("TODO");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dragId, setDragId] = useState<ID | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const members: TeamMember[] = team?.members ?? [];
  const busy = createTask.isPending || setStatus.isPending || assignTask.isPending;

  // Options carry the member object so rows can render an initials chip; long
  // names therefore truncate instead of stretching the select.
  // Deduped by id so a select can never list the same person twice; options
  // carry the name only (no icons or initials) to stay readable.
  const uniqueMembers: TeamMember[] = Array.from(
    new Map<string, TeamMember>(members.map((m): MemberEntry => [m.id, m])).values(),
  );
  const assigneeOptions: BoardAssigneeOption[] = [
    { value: UNASSIGNED, label: "Unassigned", member: null },
    ...uniqueMembers.map((m) => ({ value: m.id, label: personLabel(m), member: m })),
  ];
  const selectedMember = members.find((m) => m.id === assigneeId) ?? null;

  function openAdd(): void {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    defineStatus("TODO");
    setAssigneeId("");
    setStartDate("");
    setEndDate("");
    setModalOpen(true);
  }

  function openEdit(task: Task): void {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority || "MEDIUM");
    defineStatus(task.status || "TODO");
    setAssigneeId(task.assignee?.id ?? "");
    setStartDate(toDateInput(task.startDate));
    setEndDate(toDateInput(task.endDate));
    setModalOpen(true);
  }

  function closeModal(): void {
    setModalOpen(false);
    setEditingTask(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a task title first.");
      return;
    }
    if (isWindowReversed(startDate, endDate)) {
      toast.error("The end date cannot be before the start date.");
      return;
    }
    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assigneeId: assigneeId || null,
      ...buildDatePayload({
        start: startDate,
        end: endDate,
        previous: editingTask,
        isEdit: Boolean(editingTask),
      }),
    };
    const options = {
      onSuccess: (res: ApiResponse<TaskMutationData>): void => {
        const r = editingTask ? res?.data?.updateTask : res?.data?.createTask;
        if (r?.success) {
          closeModal();
          toast.success(r.message);
        } else {
          toast.error(r?.message || "Could not save the task.");
        }
      },
      onError: (err: unknown): void => toast.error(errorMessage(err, "Something went wrong")),
    };
    if (editingTask) {
      updateTask.mutate({ taskId: editingTask.id, input: { ...input, status } }, options);
    } else {
      createTask.mutate({ input }, options);
    }
  }

  function dropOn(columnKey: TaskStatus): void {
    if (!dragId) return;
    setStatus.mutate(
      { taskId: dragId, status: toApiStatus(columnKey) },
      {
        onSuccess: (res) => {
          const r = res?.data?.setTaskStatus;
          if (r && !r.success) toast.error(errorMessage(r, "Something went wrong"));
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
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
                options={assigneeOptions}
                ariaLabel="Assignee"
                size="md"
                renderValue={
                  <span className="block truncate" title={selectedMember ? personLabel(selectedMember) : "Unassigned"}>
                    {selectedMember ? personLabel(selectedMember) : "Unassigned"}
                  </span>
                }
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium t-soft">
                Start date <span className="t-faint">(optional)</span>
              </span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                max={endDate || ""}
                ariaLabel="Start date"
                placeholder="Select start"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium t-soft">
                End date <span className="t-faint">(optional)</span>
              </span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                min={startDate || ""}
                ariaLabel="End date"
                placeholder="Select end"
              />
            </div>
          </div>
          <p className="t-faint text-[11px]">
            Dates before the start date are unavailable in the end-date picker (and vice versa),
            so a task can never end before it starts.
          </p>
          {isWindowReversed(startDate, endDate) && (
            <p className="text-xs text-red-500" role="alert">
              The end date cannot be before the start date.
            </p>
          )}
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
                            { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
                          )
                        }
                        onAssignee={(memberId) =>
                          assignTask.mutate(
                            { taskId: t.id, assigneeId: memberId || null },
                            { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
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

function TaskCard({ task, members, dragId, onDragStart, onDragEnd, onEdit, onStatus, onAssignee }: BoardTaskCardProps) {
  const assignee = task.assignee;
  const dragging = dragId === task.id;
  const assigneeOptions: BoardAssigneeOption[] = [
    { value: UNASSIGNED, label: "Unassigned", member: null },
    ...Array.from(new Map<string, TeamMember>(members.map((m): MemberEntry => [m.id, m])).values()).map((m) => ({
      value: m.id,
      label: personLabel(m),
      member: m,
    })),
  ];
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

      {formatWindow(task.startDate, task.endDate) && (
        <p className="mt-1.5 flex items-center gap-1 text-xs t-faint">
          <CalendarIcon width={12} height={12} />
          {formatWindow(task.startDate, task.endDate)}
        </p>
      )}

      <div className="mt-2">
        <span className={`badge rounded-full px-2 py-0.5 text-xs ${priorityClass(task.priority)}`}>
          {PRIORITY_LABEL[task.priority] || task.priority}
        </span>
      </div>

      {/* Status and assignee sit on their own rows so neither is squeezed on
          narrow cards. The assignee is named once, here — the card used to
          also draw an initials avatar, which printed the same person twice. */}
      <div className="mt-3 flex flex-col gap-2">
        <Select
          ariaLabel={`Change status of ${task.title}`}
          value={task.status}
          onValueChange={onStatus}
          options={STATUS_SELECT_OPTIONS}
          size="sm"
          className="w-full"
        />
        <Select
          ariaLabel={`Assignee of ${task.title}`}
          value={task.assignee?.id ?? UNASSIGNED}
          onValueChange={(v) => onAssignee(v === UNASSIGNED ? "" : v)}
          options={assigneeOptions}
          size="sm"
          className="w-full"
          renderValue={
            <span className="block truncate" title={assignee ? personLabel(assignee) : "Unassigned"}>
              {assignee ? personLabel(assignee) : "Unassigned"}
            </span>
          }
        />
      </div>
    </li>
  );
}

export default BoardView;
