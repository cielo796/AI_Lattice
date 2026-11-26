import type { AppView } from "@/types/app";

export function moveAppSwitcherIndex(index: number, count: number, direction: -1 | 1) {
  return count ? (index + direction + count) % count : -1;
}

export function getAppViewLinks(
  views: Pick<AppView, "id" | "name">[],
  pathname: string,
  searchParams: URLSearchParams
) {
  const currentViewId = searchParams.get("viewId")?.trim() || views[0]?.id;
  const items = views.length > 0 ? views : [{ id: "", name: "一覧" }];

  return items.map(({ id, name }) => {
    const params = new URLSearchParams(searchParams);
    if (id) {
      params.set("viewId", id);
    } else {
      params.delete("viewId");
    }
    const query = params.toString();
    return {
      id,
      name,
      href: query ? `${pathname}?${query}` : pathname,
      active: views.length === 0 || id === currentViewId,
    };
  });
}
