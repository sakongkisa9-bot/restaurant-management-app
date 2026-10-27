"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type WaiterProfile = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  passportPhoto: string | null;
};
type Food = { id: string; name: string; category: string; price: number; image: string | null };
type OrderLine = { name: string; quantity: number };
type ActiveOrder = {
  id: string;
  tableNumber: number;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  billRequested: boolean;
  billRequestResolved: boolean;
  waiterCalled: boolean;
  waiterCallResolved: boolean;
  waiterCallReason: string;
  waiterCallDetails: string;
  assignedWaiterId: string | null;
  waiterCancellationResolved: boolean;
  cookCancellationResolved: boolean;
  lines: OrderLine[];
};
type DashboardData = {
  waiter: WaiterProfile;
  restaurant: { id: string; name: string };
  availableTables: number[];
  availableFoods: Food[];
  orders: ActiveOrder[];
};
type WaiterPageProps = { onSignOut: () => Promise<void> };
type Notification = {
  id: string;
  order: ActiveOrder;
  kind: "order" | "call" | "bill" | "cancelled";
  title: string;
  description: string;
};

function isDashboardData(value: unknown): value is DashboardData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const isStringOrNull = (field: unknown) => typeof field === "string" || field === null;
  const isProfile = (profile: unknown): profile is WaiterProfile => typeof profile === "object" && profile !== null
    && "id" in profile && typeof profile.id === "string"
    && "name" in profile && typeof profile.name === "string"
    && "phone" in profile && isStringOrNull(profile.phone)
    && "email" in profile && isStringOrNull(profile.email)
    && "passportPhoto" in profile && isStringOrNull(profile.passportPhoto);
  const isFood = (food: unknown): food is Food => typeof food === "object" && food !== null
    && "id" in food && typeof food.id === "string"
    && "name" in food && typeof food.name === "string"
    && "category" in food && typeof food.category === "string"
    && "price" in food && typeof food.price === "number"
    && "image" in food && isStringOrNull(food.image);
  const isOrder = (order: unknown): order is ActiveOrder => typeof order === "object" && order !== null
    && "id" in order && typeof order.id === "string"
    && "tableNumber" in order && typeof order.tableNumber === "number"
    && "orderNumber" in order && typeof order.orderNumber === "string"
    && "status" in order && typeof order.status === "string"
    && "total" in order && typeof order.total === "number"
    && "createdAt" in order && typeof order.createdAt === "string"
    && "billRequested" in order && typeof order.billRequested === "boolean"
    && "billRequestResolved" in order && typeof order.billRequestResolved === "boolean"
    && "waiterCalled" in order && typeof order.waiterCalled === "boolean"
    && "waiterCallResolved" in order && typeof order.waiterCallResolved === "boolean"
    && "waiterCallReason" in order && typeof order.waiterCallReason === "string"
    && "waiterCallDetails" in order && typeof order.waiterCallDetails === "string"
    && "assignedWaiterId" in order && isStringOrNull(order.assignedWaiterId)
    && "waiterCancellationResolved" in order && typeof order.waiterCancellationResolved === "boolean"
    && "cookCancellationResolved" in order && typeof order.cookCancellationResolved === "boolean"
    && "lines" in order && Array.isArray(order.lines) && order.lines.every((line) => typeof line === "object" && line !== null
      && "name" in line && typeof line.name === "string"
      && "quantity" in line && typeof line.quantity === "number");
  return "waiter" in value && isProfile(value.waiter)
    && "restaurant" in value && typeof value.restaurant === "object" && value.restaurant !== null
    && "id" in value.restaurant && typeof value.restaurant.id === "string"
    && "name" in value.restaurant && typeof value.restaurant.name === "string"
    && "availableTables" in value && Array.isArray(value.availableTables) && value.availableTables.every((table) => typeof table === "number")
    && "availableFoods" in value && Array.isArray(value.availableFoods) && value.availableFoods.every(isFood)
    && "orders" in value && Array.isArray(value.orders) && value.orders.every(isOrder);
}

function responseError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

async function fetchDashboard() {
  const response = await fetch("/api/waiter", { cache: "no-store" });
  const body = await response.text();
  let payload: unknown;
  try {
    payload = body.trim() ? JSON.parse(body) : null;
  } catch {
    throw new Error(`Waiter service returned an invalid response (HTTP ${response.status}). Please try again or contact the administrator.`);
  }
  if (!body.trim() && !response.ok) {
    throw new Error(`Waiter service could not load the dashboard (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(responseError(payload, "Could not load waiter workspace."));
  if (!isDashboardData(payload)) throw new Error("The waiter workspace response was invalid.");
  return payload;
}

export function WaiterPage({ onSignOut }: WaiterPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileDraft, setProfileDraft] = useState({ name: "", phone: "", email: "", password: "" });
  const [showAllTables, setShowAllTables] = useState(false);
  const [showAllFoods, setShowAllFoods] = useState(false);
  const [busyNotification, setBusyNotification] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const current = await fetchDashboard();
      setData(current);
      setProfileDraft((draft) => draft.name ? draft : {
        name: current.waiter.name,
        phone: current.waiter.phone ?? "",
        email: current.waiter.email ?? "",
        password: "",
      });
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load waiter workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const notifications = useMemo<Notification[]>(() => {
    if (!data) return [];
    return data.orders.flatMap((order) => {
      const notificationsForOrder: Notification[] = [];
      if (order.status === "cancelled" && !order.waiterCancellationResolved) {
        notificationsForOrder.push({
          id: `${order.id}-cancelled`,
          order,
          kind: "cancelled",
          title: `Order cancelled · Table ${order.tableNumber}`,
          description: `${order.orderNumber} · ${order.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ")}`,
        });
      }
      if (order.status === "confirmed" && !order.assignedWaiterId) {
        notificationsForOrder.push({
          id: `${order.id}-order`,
          order,
          kind: "order",
          title: `New order · Table ${order.tableNumber}`,
          description: `${order.orderNumber} · ${order.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ")}`,
        });
      }
      if (order.status !== "cancelled" && order.waiterCalled && !order.waiterCallResolved
        && (!order.assignedWaiterId || order.assignedWaiterId === data.waiter.id)) {
        notificationsForOrder.push({
          id: `${order.id}-call`,
          order,
          kind: "call",
          title: `Waiter called · Table ${order.tableNumber}`,
          description: [order.waiterCallReason, order.waiterCallDetails].filter(Boolean).join(" · "),
        });
      }
      if (order.status !== "cancelled" && order.billRequested && !order.billRequestResolved
        && (!order.assignedWaiterId || order.assignedWaiterId === data.waiter.id)) {
        notificationsForOrder.push({
          id: `${order.id}-bill`,
          order,
          kind: "bill",
          title: `Bill requested · Table ${order.tableNumber}`,
          description: `Order ${order.orderNumber} · KSh ${order.total.toLocaleString("en-KE")}`,
        });
      }
      return notificationsForOrder;
    }).sort((left, right) => right.order.createdAt.localeCompare(left.order.createdAt));
  }, [data]);

  async function handleNotification(notification: Notification) {
    setBusyNotification(notification.id);
    setError("");
    try {
      const response = await fetch(`/api/waiter/orders/${encodeURIComponent(notification.order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: notification.kind === "order" ? "approve"
            : notification.kind === "cancelled" ? "resolve-cancelled"
              : `resolve-${notification.kind}`,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload, "Could not update this notification."));
      if (notification.kind === "order" && typeof payload === "object" && payload !== null
        && "assignedToMe" in payload && payload.assignedToMe === false) {
        await refresh();
        setError("Another waiter accepted this order first.");
        return;
      }
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update this notification.");
    } finally {
      setBusyNotification("");
    }
  }

  function openProfile() {
    if (!data) return;
    setProfileDraft({
      name: data.waiter.name,
      phone: data.waiter.phone ?? "",
      email: data.waiter.email ?? "",
      password: "",
    });
    setProfileError("");
    setProfileMessage("");
    setProfileOpen(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await fetch("/api/waiter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDraft),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload, "Could not save your profile."));
      await refresh();
      setProfileDraft((current) => ({ ...current, password: "" }));
      setProfileMessage("Your contact details were saved.");
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setProfileSaving(false);
    }

  }

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await onSignOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return <main className="page-content waiter-content"><section className="panel waiter-loading"><p className="eyebrow">WAITER WORKSPACE</p><h1>Preparing your service board</h1></section></main>;
  }
  if (!data) {
    return <main className="page-content waiter-content"><section className="panel waiter-loading"><p className="eyebrow">WAITER WORKSPACE</p><h1>Could not open your waiter workspace</h1><p role="alert">{error || "Please sign in again."}</p><button className="primary-button" type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Back to sign in"}</button></section></main>;
  }

  const displayedTables = showAllTables ? data.availableTables : data.availableTables.slice(0, 6);
  const displayedFoods = showAllFoods ? data.availableFoods : data.availableFoods.slice(0, 6);
  const photo = data.waiter.passportPhoto;
  const initials = data.waiter.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <main className="page-content waiter-content">
      <header className="waiter-page-heading">
        <div><p className="eyebrow">SERVICE FLOOR</p><h1>Welcome, {data.waiter.name.split(" ")[0]}</h1><p className="page-subtitle">You&apos;re serving at {data.restaurant.name}.</p></div>
        <div className="waiter-user-actions">
          <button className="waiter-profile-trigger" type="button" onClick={openProfile} aria-label="Open your waiter profile">
            {photo ? <Image src={photo} alt="" width={42} height={42} unoptimized /> : <span>{initials || "W"}</span>}
          </button>
          <button className="text-button waiter-signout" type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button>
        </div>
      </header>

      {error && <p className="waiter-error" role="alert">{error}</p>}

      <section className="waiter-notification-frame" aria-labelledby="waiter-notifications-title">
        <div className="waiter-section-heading">
          <div><p className="eyebrow">LIVE SERVICE</p><h2 id="waiter-notifications-title">Notifications</h2></div>
          <span className="waiter-notification-count">{notifications.length} {notifications.length === 1 ? "notification" : "notifications"}</span>
        </div>
        <div className="waiter-notification-list" aria-live="polite">
          {notifications.length ? notifications.map((notification) => (
            <article className={`waiter-notification-card notification-${notification.kind}`} key={notification.id}>
              <span className="waiter-notification-mark" aria-hidden="true">{notification.kind === "order" ? "O" : notification.kind === "call" ? "!" : notification.kind === "bill" ? "$" : "×"}</span>
              <div className="waiter-notification-copy"><strong>{notification.title}</strong><p>{notification.description || "A customer needs assistance."}</p><small>{new Date(notification.order.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</small></div>
              <button className="primary-button waiter-notification-action" type="button" disabled={busyNotification === notification.id} onClick={() => void handleNotification(notification)}>
                {busyNotification === notification.id ? "Updating…" : notification.kind === "order" ? "Approve & assign to me" : notification.kind === "cancelled" ? "Acknowledge" : "Mark handled"}
              </button>
            </article>
          )) : <div className="waiter-notification-empty"><span aria-hidden="true">✓</span><strong>You&apos;re all caught up</strong><p>New orders and customer requests will appear here.</p></div>}
        </div>
      </section>

      <section className="waiter-lower-grid">
        <section className="panel waiter-list-panel">
          <div className="waiter-section-heading"><div><p className="eyebrow">FLOOR STATUS</p><h2>Available tables</h2></div><button className="text-button" type="button" onClick={() => setShowAllTables((current) => !current)}>{showAllTables ? "Show less" : "View all"} <span aria-hidden="true">→</span></button></div>
          {displayedTables.length ? <div className="waiter-table-grid">{displayedTables.map((table) => <article className="waiter-table-card" key={table}><span className="waiter-table-icon">T</span><div><strong>Table {table}</strong><small>Ready for guests</small></div><i className="status-dot available-dot" /></article>)}</div> : <div className="waiter-small-empty">All restaurant tables are currently occupied.</div>}
        </section>
        <section className="panel waiter-list-panel">
          <div className="waiter-section-heading"><div><p className="eyebrow">MENU STATUS</p><h2>Available foods</h2></div><button className="text-button" type="button" onClick={() => setShowAllFoods((current) => !current)}>{showAllFoods ? "Show less" : "View all"} <span aria-hidden="true">→</span></button></div>
          {displayedFoods.length ? <div className="waiter-food-list">{displayedFoods.map((food) => <article className="waiter-food-row" key={food.id}><div className="waiter-food-initial">{food.name.slice(0, 1).toUpperCase()}</div><div><strong>{food.name}</strong><small>{food.category}</small></div><span>KSh {food.price.toLocaleString("en-KE")}</span></article>)}</div> : <div className="waiter-small-empty">No foods are currently marked available.</div>}
        </section>
      </section>

      {profileOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}>
          <section className="dialog-card waiter-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="waiter-profile-title">
            <button className="dialog-close" type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile">×</button>
            <p className="eyebrow">MY STAFF PROFILE</p><h2 id="waiter-profile-title">Update your details</h2>
            <p className="dialog-description">Changes to your name and contact details are reflected in the restaurant staff tracker. Employment details stay managed by the restaurant admin.</p>
            <form className="waiter-profile-form" onSubmit={(event) => void saveProfile(event)}>
              <label className="profile-field"><span>Full name</span><input required maxLength={120} value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="profile-field"><span>Phone</span><input type="tel" maxLength={40} value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className="profile-field"><span>Email</span><input type="email" maxLength={254} value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} /></label>
              <label className="profile-field"><span>New password <small>Leave blank to keep current</small></span><input type="password" autoComplete="new-password" minLength={8} value={profileDraft.password} onChange={(event) => setProfileDraft((current) => ({ ...current, password: event.target.value }))} /></label>
              <p className="waiter-protected-details">Salary, role, staff code, and performance records are protected and cannot be changed here.</p>
              {profileError && <p className="field-error" role="alert">{profileError}</p>}
              {profileMessage && <p className="waiter-success-message" role="status">{profileMessage}</p>}
              <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Close</button><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
