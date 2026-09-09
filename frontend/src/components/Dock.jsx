import {
  DashboardIcon,
  PaperPlaneIcon,
  ListBulletIcon,
  CalendarIcon,
  ColumnsIcon,
  TargetIcon,
  ReaderIcon,
  ChatBubbleIcon,
  StopwatchIcon,
  BarChartIcon,
} from "@radix-ui/react-icons";
import Tooltip from "./Tooltip";
import { useWorkspace } from "../modules/home/WorkspaceContext";

const items = [
  { label: "Dashboard", Icon: DashboardIcon },
  { label: "My tasks", Icon: ListBulletIcon },
  { label: "Board", Icon: ColumnsIcon },
  { label: "Calendar", Icon: CalendarIcon },
  { label: "Inbox", Icon: ChatBubbleIcon },
  { label: "Goals", Icon: TargetIcon },
  { label: "Docs", Icon: ReaderIcon },
  { label: "Time", Icon: StopwatchIcon },
  { label: "Reports", Icon: BarChartIcon },
  { label: "Invite", Icon: PaperPlaneIcon },
];

export function Dock() {
  const { activeView, setActiveView } = useWorkspace();

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-3 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/80">
        {items.map(({ label, Icon }) => {
          const active = activeView === label;
          return (
            <Tooltip key={label} content={label}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => setActiveView(label)}
                className={`rounded-full p-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  active
                    ? "-translate-y-2 bg-indigo-100 text-indigo-700 shadow-md dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-zinc-500 hover:-translate-y-2 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                }`}
              >
                <Icon width={20} height={20} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default Dock;