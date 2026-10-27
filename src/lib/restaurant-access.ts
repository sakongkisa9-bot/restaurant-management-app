type RestaurantBillingStatus = {
  installationFee: number | null;
  monthlyFee: number | null;
  installationPaid: boolean | null;
  monthlyPaid: boolean | null;
  autoSuspendIfUnpaid: boolean | null;
};

export function isRestaurantOperating(restaurant: RestaurantBillingStatus) {
  const installationSettled = !restaurant.installationFee || restaurant.installationPaid;
  const monthlySettled = !restaurant.monthlyFee || restaurant.monthlyPaid;
  return !restaurant.autoSuspendIfUnpaid || (installationSettled && monthlySettled);
}
