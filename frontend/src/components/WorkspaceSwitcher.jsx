import { Popover } from "radix-ui";
import { CheckIcon, ChevronDownIcon, PersonIcon } from "@radix-ui/react-icons";
import { useMyTeams, useSwitchTeam } from "../modules/invite/hooks";
import { useToast } from "./Toast";
import { initialsOf } from "../modules/home/ui";

/**
 * Workspace switcher: a user keeps a workspace of their own and can belong to
 * other teams, so the header needs a way to move between them. Switching swaps
 * the active team server-side and clears the query cache, so no data from one
 * workspace can appear inside another.
 *
 * Renders nothing while there is a single workspace (nothing to switch to).
 */
export default function WorkspaceSwitcher() {
  const { data: teams, isPending } = useMyTeams();
  const switchTeam = useSwitchTeam();
  const toast = useToast();

  const list = teams ?? [];
  if (isPending || list.length < 2) return null;

  const active = list.find((t) => t.isActive) ?? list[0];

  async function handleSwitch(team) {
    if (team.id === active?.id) return;
    try {
      const res = await switchTeam.mutateAsync(team.id);
      const result = res?.data?.switchTeam;
      if (result?.success) {
        toast.success(result.message || `Now working in ${team.name}`);
      } else {
        toast.error(result?.message || "Unable to switch workspace.");
      }
    } catch (err) {
      toast.error(err?.message || "Unable to switch workspace.");
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Workspace: ${active?.name ?? "none"}. Switch workspace`}
        className="control flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2.5 text-left text-xs sm:text-sm"
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 text-[10px] font-semibold text-white"
        >
          {initialsOf({ firstName: active?.name }, "?")}
        </span>
        <span className="hidden min-w-0 max-w-[8rem] truncate sm:inline" title={active?.name}>
          {active?.name}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide t-faint">
          {active?.isOwner ? "Owner" : active?.role}
        </span>
        <ChevronDownIcon width={12} height={12} className="shrink-0 opacity-60" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="glass-pop z-[140] w-[17rem] rounded-xl p-1"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide t-faint">
            Workspaces
          </p>
          <ul>
            {list.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(team)}
                  aria-label={`Switch to ${team.name}`}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--accent-tint)]"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 text-[10px] font-semibold text-white"
                  >
                    {initialsOf({ firstName: team.name }, "?")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm t-ink" title={team.name}>
                      {team.name}
                    </span>
                    <span className="block text-[11px] t-faint">
                      {team.isOwner ? "My workspace" : `${team.role} · ${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  {team.isActive && <CheckIcon width={13} height={13} className="shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] t-faint">
            <PersonIcon width={11} height={11} />
            Each workspace keeps its own tasks, goals and members.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
