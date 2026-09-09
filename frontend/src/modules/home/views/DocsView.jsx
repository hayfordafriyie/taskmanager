import { useState } from "react";
import { ReaderIcon, FileTextIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";

const docs = [
  {
    id: 1,
    title: "Product roadmap",
    group: "Workspace",
    tint: "tone-indigo",
    blocks: [
      "Our product roadmap for the next two quarters.",
      "Focus areas: collaboration, automation, and mobile experience.",
    ],
  },
  {
    id: 2,
    title: "Engineering playbook",
    group: "Workspace",
    tint: "tone-emerald",
    blocks: ["Every team ships like a startup, reviewed like a platform."],
  },
  {
    id: 3,
    title: "Design tokens",
    group: "Workspace",
    tint: "tone-amber",
    blocks: ["Colors, typography, spacing, and motion defined in one place."],
  },
  {
    id: 4,
    title: "Meeting notes",
    group: "Personal",
    tint: "tone-neutral",
    blocks: ["Sync with the team happens every Monday at 10am."],
  },
  {
    id: 5,
    title: "Ideas backlog",
    group: "Personal",
    tint: "tone-red",
    blocks: ["A place to capture half-formed ideas before they evaporate."],
  },
];

const groups = ["Workspace", "Personal"];

export function DocsView() {
  const [selected, setSelected] = useState(docs[0]);

  const groupMap = groups.map((g) => ({
    name: g,
    items: docs.filter((d) => d.group === g),
  }));

  return (
    <div>
      <ViewHeader title="Docs" subtitle="Shared and personal pages, like a lightweight wiki." />
      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="h-fit">
          <header className="flex items-center gap-2">
            <ReaderIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">
              Pages
            </h2>
          </header>
          <div className="mt-3 space-y-4">
            {groupMap.map((g) => (
              <div key={g.name}>
                <p className="px-1 text-xs font-semibold t-faint">
                  {g.name}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className={`flex w-full items-center gap-2 rounded-[0.6rem] px-2 py-1.5 text-left text-sm transition-colors ${
                          selected.id === d.id
                            ? "accent-text bg-[var(--accent-tint)] font-semibold"
                            : "t-soft hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span className={`rounded p-0.5 ${d.tint}`}>
                          <FileTextIcon width={14} height={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <header className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <span className={`rounded p-1 ${selected.tint}`}>
              <FileTextIcon width={16} height={16} />
            </span>
            <h2 className="font-display text-xl font-bold t-ink">
              {selected.title}
            </h2>
          </header>
          <div className="mt-4 space-y-3">
            {selected.blocks.map((b, i) => (
              <p
                key={i}
                className="rounded-md px-2 py-1 text-sm leading-relaxed t-ink"
              >
                {b}
              </p>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-1 text-xs t-faint">
            <ChevronRightIcon width={12} height={12} />
            Live editing, comments, and sharing are coming soon.
          </p>
        </Panel>
      </div>
    </div>
  );
}