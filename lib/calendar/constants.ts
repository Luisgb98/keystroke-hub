export const HOURS_IN_DAY = 24;
export const MINUTES_IN_DAY = HOURS_IN_DAY * 60;
/** Height of one hour row in the day/week time grid — matches Tailwind's `h-16` (4rem). */
export const HOUR_HEIGHT_REM = 4;
export const DAY_GRID_HEIGHT_REM = HOURS_IN_DAY * HOUR_HEIGHT_REM;
/** Month cells show up to this many event chips before collapsing into a "+n" overflow. */
export const MONTH_CELL_MAX_CHIPS = 3;
