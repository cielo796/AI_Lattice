export const GLOBAL_RAIL_WIDTH = 80;
export const APP_NAV_WIDTH = 240;

export function getShellContentOffset(isAppNavShown: boolean): number {
  return GLOBAL_RAIL_WIDTH + (isAppNavShown ? APP_NAV_WIDTH : 0);
}
