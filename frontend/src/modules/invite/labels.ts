/**
 * Human labels for workspaces.
 *
 * Every account's private workspace is created as "Personal Workspace", so a
 * joined team is labelled with its owner's name instead — otherwise the switcher
 * would list several identical entries with no way to tell them apart.
 *
 * Kept out of the switcher component file so that file only exports components.
 */
import type { TeamSummary } from "../../types/invite";

/** The name shown for a workspace in the switcher. */
export function workspaceLabel(team?: TeamSummary | null): string {
  if (!team) return "";
  if (team.isOwner) return team.name;
  if (team.ownerName) return `${team.ownerName}'s workspace`;
  return team.name;
}
