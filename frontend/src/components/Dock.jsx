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
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-3">
      <div className="dock-bar" role="navigation" aria-label="Workspace views">
        {items.map(({ label, Icon }) => {
          const active = activeView === label;
          return (
            <Tooltip key={label} content={label}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => setActiveView(label)}
                className="dock-item"
              >
                <Icon width={19} height={19} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default Dock;
