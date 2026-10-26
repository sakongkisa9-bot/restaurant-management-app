export async function resolveRestaurantFromUrl() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const restaurantSlug = params.get("restaurant") || "";
  const table = params.get("table") || "";

  if (!restaurantSlug) {
    return { restaurantSlug: "", tableNumber: table || "", needsRestaurantSelection: true };
  }

  return { restaurantSlug, tableNumber: table || "", needsRestaurantSelection: false };
}
