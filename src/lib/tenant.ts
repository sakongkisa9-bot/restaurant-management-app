export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "restaurant";
}

export function buildCustomerUrl(baseUrl: string, restaurantSlug: string, tableNumber?: string | number | null) {
  const url = new URL(baseUrl);
  url.searchParams.set("restaurant", restaurantSlug || "restaurant");
  if (tableNumber !== null && tableNumber !== undefined && tableNumber !== "") url.searchParams.set("table", String(tableNumber));
  return url.toString();
}
