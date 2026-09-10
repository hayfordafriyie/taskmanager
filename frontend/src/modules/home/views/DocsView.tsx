import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { errorMessage } from "../../../lib/errors";
import {
  ReaderIcon,
  FileTextIcon,
  PlusIcon,
  Cross2Icon,
  TrashIcon,
  Share1Icon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";
import Select from "../../../components/Select";
import { useAuth } from "../../auth/AuthContext";
import { useMyTeam } from "../../invite/hooks";
import {
  useTeamDocs,
  useCreateDoc,
  useUpdateDoc,
  useDeleteDoc,
  useDocAccessList,
  useSetDocAccess,
  useRevokeDocAccess,
  VISIBILITY_OPTIONS,
  VISIBILITY_LABEL,
  VISIBILITY_TONE,
} from "../../docs/hooks";
import { useToast } from "../../../components/Toast";
import type { ID, TeamMember } from "../../../types/common";
import type {
  Doc,
  DocAccess,
  DocShareButtonProps,
  DocVisibility,
  DocVisibilityGroup,
  DocVisibilityGroupSpec,
} from "../../../types/docs";
import type { PersonNameFields } from "../../../types/home";

function nameOf(person?: PersonNameFields | null): string {
  if (!person) return "Teammate";
  return `${person.firstName ?? ""} ${person.surname ?? ""}`.trim() || "Teammate";
}


export function DocsView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: docs = [], isLoading } = useTeamDocs({ enabled: !!user?.id });

  const createDoc = useCreateDoc();
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();

  const [selectedId, setSelectedId] = useState<ID | null>(null);
  const [search, setSearch] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [visibility, setVisibility] = useState<DocVisibility>("TEAM");

  const [showNew, setShowNew] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newBody, setNewBody] = useState<string>("");
  const [newVisibility, setNewVisibility] = useState<DocVisibility>("TEAM");

  const selected = docs.find((d) => d.id === selectedId) || null;

  // Load the selected document into the editor. Depend on the server snapshot
  // values (not the object identity) so typing isn't reset by re-renders.
  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setBody(selected.body);
    setVisibility(selected.visibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.title, selected?.body, selected?.visibility]);

  const filtered = useMemo<Doc[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.body.toLowerCase().includes(q) ||
        nameOf(d.createdBy).toLowerCase().includes(q),
    );
  }, [docs, search]);

  const groups = useMemo<DocVisibilityGroup[]>(() => {
    const order: DocVisibilityGroupSpec[] = [
      { key: "TEAM", label: "Shared with team" },
      { key: "RESTRICTED", label: "Restricted" },
      { key: "PRIVATE", label: "Private" },
    ];
    return order
      .map((g) => ({ ...g, items: filtered.filter((d) => d.visibility === g.key) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const dirty =
    selected && (title !== selected.title || body !== selected.body || visibility !== selected.visibility);

  function save(): void {
    if (!selected) return;
    updateDoc.mutate(
      { docId: selected.id, title, body, visibility },
      {
        onSuccess: (res) => {
          const r = res?.data?.updateDoc;
          if (r?.success) toast.success(r.message);
          else toast.error(r?.message || "Could not save the document.");
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  function removeDoc(doc: Doc): void {
    deleteDoc.mutate(
      { docId: doc.id },
      {
        onSuccess: () => {
          toast.success("Document deleted");
          setSelectedId((id) => (id === doc.id ? null : id));
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  function handleCreate(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Enter a document title first.");
      return;
    }
    createDoc.mutate(
      { title: newTitle.trim(), body: newBody, visibility: newVisibility },
      {
        onSuccess: (res) => {
          const r = res?.data?.createDoc;
          if (r?.success) {
            setShowNew(false);
            setNewTitle("");
            setNewBody("");
            setNewVisibility("TEAM");
            if (r.doc?.id) setSelectedId(r.doc.id);
            toast.success(r.message);
          } else {
            toast.error(r?.message || "Could not create the document.");
          }
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  return (
    <div>
      <ViewHeader title="Docs" subtitle="Shared and personal pages, like a lightweight wiki." />

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="h-fit">
          <div className="flex items-center justify-between gap-2">
            <header className="flex items-center gap-2">
              <ReaderIcon width={16} height={16} className="t-faint" />
              <h2 className="font-display text-sm font-semibold t-ink">Pages</h2>
            </header>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="btn-gloss-primary flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
            >
              <PlusIcon width={12} height={12} />
              New doc
            </button>
          </div>

          <div className="relative mt-3">
            <MagnifyingGlassIcon
              width={14}
              height={14}
              className="t-faint absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search docs…"
              aria-label="Search docs"
              className="control w-full rounded-full py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="mt-3 space-y-4">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="px-1 text-xs font-semibold t-faint">{g.label}</p>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        aria-label={`Open document ${d.title}`}
                        className={`flex w-full items-center gap-2 rounded-[0.6rem] px-2 py-1.5 text-left text-sm transition-colors ${
                          d.id === selectedId
                            ? "accent-text bg-[var(--accent-tint)] font-semibold"
                            : "t-soft hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span className={`badge ${VISIBILITY_TONE[d.visibility]} shrink-0 rounded p-0.5`}>
                          {d.visibility === "TEAM" ? (
                            <FileTextIcon width={14} height={14} />
                          ) : (
                            <LockClosedIcon width={14} height={14} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{d.title}</span>
                        {d.accessCount > 0 && (
                          <span className="shrink-0 text-[10px] t-faint">{d.accessCount}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!isLoading && filtered.length === 0 && (
              <p className="px-1 py-6 text-center text-sm t-soft">
                {docs.length === 0
                  ? "No documents yet — create the first one."
                  : "No documents match your search."}
              </p>
            )}
          </div>
        </Panel>

        {selected ? (
          <Panel>
            <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
              {selected.canEdit ? (
                <input
                  value={title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  aria-label="Document title"
                  className="control min-w-0 flex-1 rounded-[0.85rem] px-3 py-2 font-display text-lg font-bold"
                />
              ) : (
                <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold t-ink">
                  {selected.title}
                </h2>
              )}

              <span className={`badge ${VISIBILITY_TONE[selected.visibility]} px-2 py-0.5 text-xs`}>
                {VISIBILITY_LABEL[selected.visibility]}
              </span>

              {selected.canEdit && (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || updateDoc.isPending}
                    className="btn-gloss-primary rounded-full px-3.5 py-1.5 text-xs disabled:opacity-50"
                  >
                    {updateDoc.isPending ? "Saving…" : "Save"}
                  </button>
                  <ShareButton doc={selected} />
                  <button
                    type="button"
                    aria-label={`Delete document ${selected.title}`}
                    onClick={() => removeDoc(selected)}
                    className="ring-accent rounded-full p-2 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-red-500"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </>
              )}
            </header>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs t-faint">
              <span className="flex items-center gap-2">
                {nameOf(selected.createdBy)}
              </span>
              <span>Updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
              {selected.canEdit ? (
                <div className="w-56">
                  <Select
                    ariaLabel="Document visibility"
                    value={visibility}
                    onValueChange={setVisibility}
                    options={VISIBILITY_OPTIONS}
                    size="sm"
                    className="w-full"
                  />
                </div>
              ) : (
                <span>Read only</span>
              )}
            </div>

            {selected.canEdit ? (
              <textarea
                value={body}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                placeholder="Write the document…"
                aria-label="Document body"
                rows={14}
                className="control mt-4 w-full resize-y rounded-[0.85rem] px-3.5 py-3 text-sm leading-relaxed"
              />
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed t-soft">
                {selected.body}
              </p>
            )}
          </Panel>
        ) : (
          <Panel>
            <div className="flex min-h-[20rem] items-center justify-center">
              <p className="text-sm t-soft">Select a page, or create a new document.</p>
            </div>
          </Panel>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="glass-pop mt-16 w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold t-ink">New document</h3>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                aria-label="Close new document"
                className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-3 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Title</span>
                <input
                  value={newTitle}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
                  placeholder="e.g. Product roadmap"
                  aria-label="New document title"
                  className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Body</span>
                <textarea
                  value={newBody}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewBody(e.target.value)}
                  placeholder="Start writing…"
                  aria-label="New document body"
                  rows={6}
                  className="control w-full resize-y rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Who can see it</span>
                <Select
                  ariaLabel="New document visibility"
                  value={newVisibility}
                  onValueChange={setNewVisibility}
                  options={VISIBILITY_OPTIONS}
                  size="md"
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={createDoc.isPending}
                className="btn-gloss-primary w-full rounded-full px-3.5 py-2.5 text-sm"
              >
                {createDoc.isPending ? "Creating…" : "Create document"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ShareButton opens the per-member access modal for a document.
function ShareButton({ doc }: DocShareButtonProps) {
  const toast = useToast();
  const { data: team } = useMyTeam();
  const { data: access = [] } = useDocAccessList(doc.id);
  const setAccess = useSetDocAccess();
  const revokeAccess = useRevokeDocAccess();
  const [open, setOpen] = useState<boolean>(false);

  const members = team?.members ?? [];
  const accessByUser = new Map<ID, DocAccess>(access.map((a) => [a.userId, a]));

  function toggleAccess(member: TeamMember): void {
    const existing = accessByUser.get(member.id);
    if (existing) {
      revokeAccess.mutate(
        { docId: doc.id, userId: member.id },
        { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
      );
      return;
    }
    setAccess.mutate(
      { docId: doc.id, userId: member.id, canEdit: false },
      { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
    );
  }

  function toggleEdit(member: TeamMember): void {
    const existing = accessByUser.get(member.id);
    setAccess.mutate(
      { docId: doc.id, userId: member.id, canEdit: !existing?.canEdit },
      { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gloss-secondary flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
      >
        <Share1Icon width={13} height={13} />
        Share
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="glass-pop mt-16 w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold t-ink">
                Who can access “{doc.title}”
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close sharing"
                className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>
            <p className="mt-1 text-xs t-soft">
              {doc.visibility === "TEAM"
                ? "This doc is visible to the whole team. Members below get edit rights."
                : "Only the people you add here can open this doc."}
            </p>

            <ul className="divide-soft mt-3 max-h-[22rem] overflow-y-auto">
              {members.map((m) => {
                const grant = accessByUser.get(m.id);
                const isCreator = m.id === doc.createdBy?.id;
                const canEdit = Boolean(grant?.canEdit);
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium t-ink">{nameOf(m)}</p>
                      <p className="truncate text-xs t-soft">
                        {isCreator ? "Owner" : m.phone}
                      </p>
                    </div>
                    {isCreator ? (
                      <span className="badge tone-indigo px-2 py-0.5 text-xs">Owner</span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${grant ? "Revoke" : "Grant"} access for ${nameOf(m)}`}
                          aria-pressed={Boolean(grant)}
                          onClick={() => toggleAccess(m)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            grant ? "tone-emerald" : "badge badge-tint"
                          }`}
                        >
                          {grant ? "Can view" : "No access"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Toggle edit rights for ${nameOf(m)}`}
                          aria-pressed={canEdit}
                          disabled={!grant}
                          onClick={() => toggleEdit(m)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                            canEdit ? "tone-indigo" : "badge badge-tint"
                          }`}
                        >
                          {canEdit ? "Can edit" : "View only"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {members.length === 0 && (
                <li className="py-6 text-center text-sm t-soft">
                  No other teammates yet — invite someone from the Invite page.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export default DocsView;
