/** Theme types shared by the hook and the layouts. */

/** The two themes the app supports. */
export type Theme = "light" | "dark";

/** What `useTheme()` returns. */
export interface UseThemeResult {
  theme: Theme;
  toggleTheme: () => void;
}
