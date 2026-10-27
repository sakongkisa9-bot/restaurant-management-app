"use client";

import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildCustomerUrl } from "../lib/tenant";

type ManagedRestaurant = {
  id: string;
  slug: string;
  name: string;
  installationFee: number;
  monthlyFee: number;
  installationPaid: boolean;
  monthlyPaid: boolean;
  autoSuspendIfUnpaid: boolean;
  tableCount: number | null;
  createdAt: string | null;
};

type RestaurantForm = {
  name: string;
  installationFee: string;
  monthlyFee: string;
  installationPaid: boolean;
  monthlyPaid: boolean;
  autoSuspendIfUnpaid: boolean;
  adminPassword: string;
};

const emptyForm: RestaurantForm = {
  name: "",
  installationFee: "0",
  monthlyFee: "0",
  installationPaid: false,
  monthlyPaid: false,
  autoSuspendIfUnpaid: false,
  adminPassword: "",
};

function isManagedRestaurant(value: unknown): value is ManagedRestaurant {
  return typeof value === "object"
    && value !== null
    && "id" in value && typeof value.id === "string"
    && "slug" in value && typeof value.slug === "string"
    && "name" in value && typeof value.name === "string"
    && "installationFee" in value && typeof value.installationFee === "number"
    && "monthlyFee" in value && typeof value.monthlyFee === "number"
    && "installationPaid" in value && typeof value.installationPaid === "boolean"
    && "monthlyPaid" in value && typeof value.monthlyPaid === "boolean"
    && "autoSuspendIfUnpaid" in value && typeof value.autoSuspendIfUnpaid === "boolean"
    && "tableCount" in value && (typeof value.tableCount === "number" || value.tableCount === null)
    && "createdAt" in value
    && (typeof value.createdAt === "string" || value.createdAt === null);
}

export function DeveloperDashboard() {
  const [restaurants, setRestaurants] = useState<ManagedRestaurant[]>([]);
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrRestaurant, setQrRestaurant] = useState<ManagedRestaurant | null>(null);
  const [qrOrigin, setQrOrigin] = useState("");
  const [qrSelection, setQrSelection] = useState("general");

  async function loadRestaurants() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/developer/restaurants", { signal: AbortSignal.timeout(15_000) });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not load restaurants.";
        throw new Error(message);
      }
      if (typeof payload !== "object" || payload === null || !("restaurants" in payload) || !Array.isArray(payload.restaurants)) {
        throw new Error("The restaurant list response was invalid.");
      }
      setRestaurants(payload.restaurants.filter(isManagedRestaurant));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRestaurants(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function editRestaurant(restaurant: ManagedRestaurant) {
    setEditingId(restaurant.id);
    setForm({
      name: restaurant.name,
      installationFee: String(restaurant.installationFee),
      monthlyFee: String(restaurant.monthlyFee),
      installationPaid: restaurant.installationPaid,
      monthlyPaid: restaurant.monthlyPaid,
      autoSuspendIfUnpaid: restaurant.autoSuspendIfUnpaid,
      adminPassword: "",
    });
    setError("");
    setNotice("");
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function saveRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const body = {
      name: form.name,
      installationFee: Number(form.installationFee),
      monthlyFee: Number(form.monthlyFee),
      installationPaid: form.installationPaid,
      monthlyPaid: form.monthlyPaid,
      autoSuspendIfUnpaid: form.autoSuspendIfUnpaid,
      ...(editingId
        ? { id: editingId, newAdminPassword: form.adminPassword }
        : { adminPassword: form.adminPassword }),
    };

    try {
      const response = await fetch("/api/developer/restaurants", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not save this restaurant.";
        throw new Error(message);
      }
      resetForm();
      setNotice(editingId ? "Restaurant details saved." : "Restaurant registered.");
      await loadRestaurants();
    } catch (saveError) {
      setError(saveError instanceof DOMException && saveError.name === "TimeoutError"
        ? "The request timed out. Refresh the restaurant list before retrying to check whether the save completed."
        : saveError instanceof Error ? saveError.message : "Could not save this restaurant.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRestaurant(restaurant: ManagedRestaurant) {
    if (!window.confirm(`Permanently delete ${restaurant.name} and its restaurant data? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/developer/restaurants?id=${encodeURIComponent(restaurant.id)}`, { method: "DELETE" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not delete this restaurant.";
        throw new Error(message);
      }
      if (editingId === restaurant.id) resetForm();
      setNotice(`${restaurant.name} was deleted.`);
      await loadRestaurants();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this restaurant.");
    }
  }

  const tableNumbers = qrRestaurant
    ? Array.from({ length: qrRestaurant.tableCount ?? 12 }, (_, index) => index + 1)
    : [];
  const qrCards = !qrRestaurant ? [] : qrSelection === "all"
    ? tableNumbers.map((table) => ({
      label: `TABLE ${String(table).padStart(2, "0")}`,
      url: buildCustomerUrl(qrOrigin, qrRestaurant.slug, table),
    }))
    : qrSelection === "general"
      ? [{ label: "RESTAURANT MENU", url: buildCustomerUrl(qrOrigin, qrRestaurant.slug) }]
      : [{
        label: `TABLE ${String(Number(qrSelection)).padStart(2, "0")}`,
        url: buildCustomerUrl(qrOrigin, qrRestaurant.slug, Number(qrSelection)),
      }];

  return (
    <main className="page-content admin-content developer-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLATFORM MANAGEMENT</p>
          <h1>Developer dashboard</h1>
          <p className="page-subtitle">Register restaurants, manage plans, and review payment status.</p>
        </div>
      </div>

      <div className="developer-dashboard-grid">
        <section className="panel developer-register-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingId ? "UPDATE ACCOUNT" : "NEW ACCOUNT"}</p>
              <h2>{editingId ? "Edit restaurant" : "Register a restaurant"}</h2>
            </div>
          </div>
          <form className="developer-form" onSubmit={saveRestaurant}>
            <label className="profile-field"><span>Restaurant name</span><input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <div className="developer-fee-grid">
              <label className="profile-field"><span>Installation fee (KSh)</span><input required min="0" step="1" type="number" value={form.installationFee} onChange={(event) => setForm((current) => ({ ...current, installationFee: event.target.value }))} /></label>
              <label className="profile-field"><span>Monthly fee (KSh)</span><input required min="0" step="1" type="number" value={form.monthlyFee} onChange={(event) => setForm((current) => ({ ...current, monthlyFee: event.target.value }))} /></label>
            </div>
            <label className="profile-field">
              <span>{editingId ? "New admin password (optional)" : "Initial admin password"}</span>
              <input required={!editingId} minLength={8} autoComplete="new-password" type="password" value={form.adminPassword} onChange={(event) => setForm((current) => ({ ...current, adminPassword: event.target.value }))} />
              <small>At least 8 characters. Restaurant admins can change this in their profile.</small>
            </label>
            <div className="developer-payment-checks">
              <label><input type="checkbox" checked={form.installationPaid} onChange={(event) => setForm((current) => ({ ...current, installationPaid: event.target.checked }))} /><span>Installation fee paid</span></label>
              <label><input type="checkbox" checked={form.monthlyPaid} onChange={(event) => setForm((current) => ({ ...current, monthlyPaid: event.target.checked }))} /><span>Monthly fee paid</span></label>
            </div>
            <label className="developer-switch-row"><input type="checkbox" checked={form.autoSuspendIfUnpaid} onChange={(event) => setForm((current) => ({ ...current, autoSuspendIfUnpaid: event.target.checked }))} /><span><strong>Automatically stop customer access if unpaid</strong><small>Customer menu and ordering stop until all non-zero fees are marked paid. Admin access stays available.</small></span></label>
            {error && <p className="field-error" role="alert">{error}</p>}
            {notice && <p className="developer-notice" role="status">{notice}</p>}
            <div className="developer-form-actions">
              {editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button>}
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save restaurant" : "Register restaurant"}</button>
            </div>
          </form>
        </section>

        <section className="panel developer-list-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RESTAURANT ACCOUNTS</p>
              <h2>Registered restaurants <span className="restaurant-count">{restaurants.length}</span></h2>
            </div>
            <button className="text-button" type="button" onClick={() => void loadRestaurants()} disabled={loading}>Refresh</button>
          </div>
          {loading ? <p className="developer-list-empty" role="status">Loading restaurants…</p> : restaurants.length === 0 ? (
            <p className="developer-list-empty">No restaurants registered yet.</p>
          ) : (
            <div className="developer-restaurant-list">
              {restaurants.map((restaurant) => {
                const installationPaid = restaurant.installationFee === 0 || restaurant.installationPaid;
                const monthlyPaid = restaurant.monthlyFee === 0 || restaurant.monthlyPaid;
                const paid = installationPaid && monthlyPaid;
                const suspended = restaurant.autoSuspendIfUnpaid && !paid;
                return (
                  <article className="developer-restaurant-card" key={restaurant.id}>
                    <div className="developer-restaurant-heading">
                      <div><h3>{restaurant.name}</h3><span className="developer-restaurant-slug">/{restaurant.slug}</span></div>
                      <span className={`billing-status${paid ? " is-paid" : " is-unpaid"}`}>{paid ? "Paid" : "Unpaid"}</span>
                    </div>
                    <div className="developer-billing-summary">
                      <span>Install: KSh {restaurant.installationFee.toLocaleString()} · {restaurant.installationFee === 0 ? "No fee" : restaurant.installationPaid ? "Paid" : "Unpaid"}</span>
                      <span>Monthly: KSh {restaurant.monthlyFee.toLocaleString()} · {restaurant.monthlyFee === 0 ? "No fee" : restaurant.monthlyPaid ? "Paid" : "Unpaid"}</span>
                    </div>
                    {suspended && <p className="developer-suspended-note">Customer access stopped until payment is marked paid.</p>}
                    <div className="developer-restaurant-actions">
                      <button className="secondary-button" type="button" onClick={() => { setQrOrigin(window.location.origin); setQrRestaurant(restaurant); setQrSelection("general"); }}>QR codes</button>
                      <button className="secondary-button" type="button" onClick={() => editRestaurant(restaurant)}>Edit</button>
                      <button className="secondary-button developer-delete-button" type="button" onClick={() => void deleteRestaurant(restaurant)}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {qrRestaurant && (
        <div className="modal-backdrop qr-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setQrRestaurant(null)}>
          <section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="developer-qr-title">
            <div className="qr-dialog-heading">
              <div><p className="eyebrow">CUSTOMER ACCESS</p><h2 id="developer-qr-title">{qrRestaurant.name} QR codes</h2><p>Scan a code to open this restaurant&apos;s customer menu.</p></div>
              <button className="dialog-close" type="button" aria-label="Close QR codes" onClick={() => setQrRestaurant(null)}>×</button>
            </div>
            <div className="qr-toolbar">
              <label className="qr-select-field"><span>Show</span><select value={qrSelection} onChange={(event) => setQrSelection(event.target.value)}><option value="general">Restaurant menu</option><option value="all">All {tableNumbers.length} tables</option>{tableNumbers.map((table) => <option value={table} key={table}>Table {table}</option>)}</select></label>
              <button className="secondary-button" type="button" onClick={() => window.print()}>Print codes</button>
            </div>
            <div className="qr-grid">{qrCards.map((card) => <article className="qr-table-card" key={card.label}><QRCodeSVG value={card.url} size={112} level="M" includeMargin /><strong>{card.label}</strong><span>{card.url}</span></article>)}</div>
          </section>
        </div>
      )}
    </main>
  );
}
