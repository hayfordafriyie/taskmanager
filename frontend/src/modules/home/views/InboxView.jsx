import { useState } from "react";
import {
  EnvelopeOpenIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  TargetIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";

const tabs = ["All", "Mentions", "Assigned"];

const groups = [
  {
    label: "Today",
    items: [
      { id: 1, Icon: ChatBubbleIcon, text: "Ama commented on “Q3 roadmap”", time: "10:24 AM", tint: "text-indigo-600 dark:text-indigo-400" },
      { id: 2, Icon: CheckCircledIcon, text: "Kojo completed “Fix Select focus ring”", time: "9:02 AM", tint: "text-emerald-600 dark:text-emerald-400" },
      { id: 3, Icon: PersonIcon, text: "You were invited to “Mobile App”", time: "8:47 AM", tint: "text-amber-600 dark:text-amber-400" },
    ],
  },
  {
    label: "Yesterday",
    items: [
      { id: 4, Icon: TargetIcon, text: "New goal assigned: “Ship Task Manager v2”", time: "4:15 PM", tint: "text-red-600 dark:text-red-400" },
      { id: 5, Icon: ChatBubbleIcon, text: "Kojo mentioned you in “API rate limits”", time: "11:08 AM", tint: "text-indigo-600 dark:text-indigo-400" },
    ],
  },
];

export function InboxView() {
  const [tab, setTab] = useState("All");

  const visible = groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (tab === "Mentions") return i.Icon === ChatBubbleIcon;
      if (tab === "Assigned") return i.Icon === PersonIcon || i.Icon === TargetIcon;
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <ViewHeader title="Inbox" subtitle="Activity, mentions, and assignments across your workspace." />
      <div className="seg mt-6">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className="seg-btn"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {visible.map((g) => (
          <div key={g.label}>
            <p className="px-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {g.label}
            </p>
            <Panel className="mt-2">
              <ul className="divide-soft">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 py-3">
                    <span className="chip h-8 w-8">{<i.Icon width={16} height={16} className={i.tint} />}</span>
                    <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {i.text}
                    </p>
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {i.time}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <EnvelopeOpenIcon width={14} height={14} />
        Marking notifications as read is coming soon.
      </p>
    </div>
  );
}