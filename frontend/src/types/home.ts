/**
 * Types for the workspace shell and its presentational helpers
 * (`modules/home/ui`, `modules/home/index`).
 */
import type { ReactNode } from "react";
import type { IconComponent } from "./ui";

/** Tone token accepted by `PolicyBadge` (maps to a `tone-*` class). */
export type BadgeTone =
  | "zinc"
  | "indigo"
  | "amber"
  | "emerald"
  | "red"
  | "To do"
  | "In progress"
  | "Review"
  | "Done"
  | "On track"
  | "At risk"
  | "Behind"
  | "Member"
  | "Guest"
  | "Admin"
  | (string & {});

export interface PolicyBadgeProps {
  children?: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export interface PriorityBadgeProps {
  children?: ReactNode;
  className?: string;
}

export interface SectionTitleProps {
  title: ReactNode;
  icon?: IconComponent;
}

export interface ViewHeaderProps {
  title: ReactNode;
  subtitle?: string;
}

export interface AvatarProps {
  initial?: ReactNode;
  className?: string;
}

/** Any object carrying the name fields the helpers can format. */
export interface PersonNameFields {
  firstName?: string | null;
  surname?: string | null;
}
