"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MenuManagement, type MenuItem } from "./menu-management";
import { defaultRestaurantProfile, getMapsHref, RestaurantProfile, type RestaurantProfileData } from "./restaurant-profile";

type Workspace = "customer" | "admin" | "waiter" | "cook" | "cashier" | "developer";
type AdminPage = "Overview" | "Staff tracker" | "M-Pesa log" | "Restaurant profile" | "Menu";
type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type BusinessDay = { enabled: boolean; open: string; close: string };
type Schedule = Record<DayName, BusinessDay>;

const days: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const adminPages: AdminPage[] = ["Overview", "Menu", "Restaurant profile", "Staff tracker", "M-Pesa log"];

const navigation: { id: Workspace; label: string; mark: string }[] = [
  { id: "customer", label: "Customer", mark: "CU" },
  { id: "admin", label: "Admin", mark: "AD" },
  { id: "waiter", label: "Waiter", mark: "WA" },
  { id: "cook", label: "Cook", mark: "CK" },
  { id: "cashier", label: "Cashier", mark: "CA" },
];

const defaultSchedule: Schedule = {
  Monday: { enabled: true, open: "08:00", close: "17:00" },
  Tuesday: { enabled: true, open: "08:00", close: "17:00" },
  Wednesday: { enabled: true, open: "08:00", close: "17:00" },
  Thursday: { enabled: true, open: "08:00", close: "17:00" },
  Friday: { enabled: true, open: "08:00", close: "17:00" },
  Saturday: { enabled: true, open: "10:00", close: "15:00" },
  Sunday: { enabled: false, open: "10:00", close: "15:00" },
};

const chartPeriods = [
  { title: "This week", labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
  { title: "This year", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] },
  { title: "Yearly", labels: ["2021", "2022", "2023", "2024", "2025", "2026"] },
];

function isOpenAt(date: Date, schedule: Schedule) {
  const day = days[(date.getDay() + 6) % 7];
  const hours = schedule[day];
  if (!hours.enabled) return false;

  const minutes = date.getHours() * 60 + date.getMinutes();
  const opening = Number(hours.open.slice(0, 2)) * 60 + Number(hours.open.slice(3));
  const closing = Number(hours.close.slice(0, 2)) * 60 + Number(hours.close.slice(3));
  return minutes >= opening && minutes < closing;
}

function getNextScheduleBoundary(from: Date, schedule: Schedule) {
  let nextBoundary: Date | null = null;

  for (let offset = 0; offset < 8; offset += 1) {
    const dayDate = new Date(from);
    dayDate.setDate(from.getDate() + offset);
    const day = days[(dayDate.getDay() + 6) % 7];
    const hours = schedule[day];
    if (!hours.enabled) continue;

    for (const time of [hours.open, hours.close]) {
      const [hour, minute] = time.split(":").map(Number);
      const boundary = new Date(dayDate);
      boundary.setHours(hour, minute, 0, 0);
      if (boundary > from && (!nextBoundary || boundary < nextBoundary)) {
        nextBoundary = boundary;
      }
    }
  }

  return nextBoundary;
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("customer");
  const [expanded, setExpanded] = useState(false);
  const [adminPage, setAdminPage] = useState<AdminPage>("Overview");
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
  const [draftSchedule, setDraftSchedule] = useState<Schedule>(defaultSchedule);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<boolean | null>(null);
  const [chartIndex, setChartIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [detailPanel, setDetailPanel] = useState<"recommendations" | "complaints" | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfileData>(defaultRestaurantProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [tableNumber, setTableNumber] = useState("");

  useEffect(() => {
    const loadMenu = window.setTimeout(() => {
      try {
        const storedItems = window.localStorage.getItem("room.menu.v1");
        if (storedItems) {
          const parsedItems: unknown = JSON.parse(storedItems);
          if (Array.isArray(parsedItems)) setMenuItems(parsedItems as MenuItem[]);
        }
      } catch {
        window.localStorage.removeItem("room.menu.v1");
      }
      setMenuLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadMenu);
  }, []);

  useEffect(() => {
    if (!menuLoaded) return;
    try {
      window.localStorage.setItem("room.menu.v1", JSON.stringify(menuItems));
    } catch {
      return;
    }
  }, [menuItems, menuLoaded]);

  useEffect(() => {
    const loadProfile = window.setTimeout(() => {
      try {
        const storedProfile = window.localStorage.getItem("room.restaurant-profile.v1");
        if (storedProfile) {
          const parsedProfile: unknown = JSON.parse(storedProfile);
          if (parsedProfile && typeof parsedProfile === "object") {
            setRestaurantProfile({ ...defaultRestaurantProfile, ...(parsedProfile as Partial<RestaurantProfileData>) });
          }
        }
      } catch {
        window.localStorage.removeItem("room.restaurant-profile.v1");
      }
      setProfileLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadProfile);
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    try {
      window.localStorage.setItem("room.restaurant-profile.v1", JSON.stringify(restaurantProfile));
    } catch {
      return;
    }
  }, [profileLoaded, restaurantProfile]);

  useEffect(() => {
    const readTableNumber = window.setTimeout(() => {
      setTableNumber(new URLSearchParams(window.location.search).get("table") ?? "");
    }, 0);
    return () => window.clearTimeout(readTableNumber);
  }, []);

  useEffect(() => {
    const updateScheduleStatus = () => setScheduledOpen(isOpenAt(new Date(), schedule));
    const initialUpdate = window.setTimeout(updateScheduleStatus, 0);

    const timer = window.setInterval(updateScheduleStatus, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, [schedule]);

  useEffect(() => {
    if (manualStatus === null) return;

    const nextBoundary = getNextScheduleBoundary(new Date(), schedule);
    if (!nextBoundary) return;

    const timeout = window.setTimeout(() => {
      setScheduledOpen(isOpenAt(new Date(), schedule));
      setManualStatus(null);
    }, Math.max(0, nextBoundary.getTime() - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [manualStatus, schedule]);

  const restaurantIsOpen = manualStatus ?? scheduledOpen;

  function selectWorkspace(nextWorkspace: Workspace) {
    if (window.matchMedia("(max-width: 650px)").matches) setExpanded(false);

    if (nextWorkspace === "admin") {
      setPassword("");
      setPasswordError("");
      setShowPassword(true);
      return;
    }
    setWorkspace(nextWorkspace);
    setAdminPage("Overview");
  }

  function enterAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      setPasswordError("Enter a password to open the preview.");
      return;
    }
    setShowPassword(false);
    setWorkspace("admin");
    setAdminPage("Overview");
  }

  function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchedule(draftSchedule);
    setManualStatus(null);
    setShowHours(false);
  }

  function saveMenuItems(updatedItems: MenuItem[]) {
    const updates = new Map(updatedItems.map((item) => [item.id, item]));
    setMenuItems((current) => current.map((item) => updates.get(item.id) ?? item));
  }

  function moveChart(direction: number) {
    setChartIndex((current) => (current + direction + chartPeriods.length) % chartPeriods.length);
  }

  const workspaceLabel = workspace === "developer" ? "Developer" : workspace[0].toUpperCase() + workspace.slice(1);
  const period = chartPeriods[chartIndex];

  return (
    <div className="app-shell">
      <aside className={`side-nav${expanded ? " is-expanded" : ""}`}>
        <div className="side-nav-top">
          <button
            className="brand-button"
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            title={expanded ? "Collapse navigation" : "Expand navigation"}
          >
            <span className="brand-mark">R</span>
            {expanded && <span className="brand-copy"><strong>ROOM</strong><small>RESTAURANT OS</small></span>}
          </button>
          <div className="nav-divider" />
          <nav className="role-navigation" aria-label="Workspaces">
            {navigation.map((item) => (
              <button
                className={`nav-item${workspace === item.id ? " is-active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => selectWorkspace(item.id)}
                aria-current={workspace === item.id ? "page" : undefined}
                title={expanded ? undefined : item.label}
              >
                <span className="nav-mark">{item.mark}</span>
                {expanded && <span className="nav-label">{item.label}</span>}
                {expanded && item.id === "admin" && <span className="nav-lock">LOCKED</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="side-nav-bottom">
          <button
            className={`nav-item developer-link${workspace === "developer" ? " is-active" : ""}`}
            type="button"
            onClick={() => selectWorkspace("developer")}
            aria-current={workspace === "developer" ? "page" : undefined}
            title={expanded ? undefined : "Developer"}
          >
            <span className="nav-mark">DV</span>
            {expanded && <span className="nav-label">Developer</span>}
          </button>
          <div className="sidebar-footnote">{expanded ? "BUILD 0.1 · PREVIEW" : "0.1"}</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-context">
            <span className="context-dot" />
            <span>{workspaceLabel} workspace</span>
          </div>
          <div className="topbar-meta">
            <span className="topbar-date">Live service</span>
            {restaurantProfile.logo ? <Image src={restaurantProfile.logo} alt="" className="user-avatar profile-avatar-image" width={32} height={32} unoptimized /> : <span className="user-avatar" aria-label="Restaurant profile">R</span>}
          </div>
        </header>

        {workspace === "admin" ? (
          <main className="page-content admin-content">
            <div className="page-heading admin-heading">
              <div>
                <p className="eyebrow">RESTAURANT MANAGEMENT</p>
                <h1>{adminPage}</h1>
                <p className="page-subtitle">A clear view of today&apos;s service and restaurant activity.</p>
              </div>
              {adminPage === "Overview" && (
                <div className="service-controls">
                  <button
                    className={`open-toggle${restaurantIsOpen ? " is-open" : ""}`}
                    type="button"
                    role="switch"
                    aria-checked={restaurantIsOpen}
                    onClick={() => setManualStatus(!restaurantIsOpen)}
                  >
                    <span className="toggle-track"><span /></span>
                    <span className="toggle-copy"><small>RESTAURANT</small><strong>{restaurantIsOpen ? "Open" : "Closed"}</strong></span>
                  </button>
                  <button
                    className="secondary-button hours-button"
                    type="button"
                    onClick={() => {
                      setDraftSchedule(schedule);
                      setShowHours(true);
                    }}
                  >
                    <span className="button-symbol">+</span> Set hours
                  </button>
                </div>
              )}
            </div>

            <nav className="admin-tabs" aria-label="Admin pages">
              {adminPages.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`admin-tab${adminPage === page ? " is-current" : ""}`}
                  onClick={() => setAdminPage(page)}
                  aria-current={adminPage === page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
            </nav>

            {adminPage === "Overview" ? (
              <>
                <section className="metric-grid" aria-label="Today's restaurant metrics">
                  <article className="metric-card revenue-metric">
                    <div className="metric-topline"><span className="metric-label">Total revenue</span><span className="metric-mark">KSh</span></div>
                    <strong className="metric-value">KSh 0</strong>
                    <span className="metric-note">Today so far</span>
                  </article>
                  <article className="metric-card orders-metric">
                    <div className="metric-topline"><span className="metric-label">Orders</span><span className="metric-mark">01</span></div>
                    <strong className="metric-value">0</strong>
                    <span className="metric-note">No orders recorded today</span>
                  </article>
                  <article className="metric-card tables-metric">
                    <div className="metric-topline"><span className="metric-label">Active tables</span><span className="metric-mark">12</span></div>
                    <strong className="metric-value">0 <small>/ 12</small></strong>
                    <span className="metric-note">Tables currently in service</span>
                  </article>
                </section>

                <section className="panel occupancy-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">FLOOR STATUS <span className="preview-tag">PREVIEW</span></p>
                      <h2>Table occupancy</h2>
                    </div>
                    <button className="text-button" type="button" onClick={() => setAdminPage("Staff tracker")}>View all <span aria-hidden="true">→</span></button>
                  </div>
                  <div className="occupancy-summary"><span><i className="status-dot occupied-dot" />Occupied</span><strong>2</strong><span><i className="status-dot available-dot" />Available</span><strong>4</strong><span className="occupancy-hint">Sample layout only</span></div>
                  <div className="table-preview-grid" aria-label="Example table layout">
                    {[{ number: "01", occupied: true }, { number: "02", occupied: false }, { number: "03", occupied: true }, { number: "04", occupied: false }, { number: "05", occupied: false }, { number: "06", occupied: false }].map((table) => (
                      <div className="table-preview" key={table.number}>
                        <span className="table-number">T{table.number}</span>
                        <span className="table-status"><i className={`status-dot ${table.occupied ? "occupied-dot" : "available-dot"}`} />{table.occupied ? "Occupied" : "Available"}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel chart-panel">
                  <div className="section-heading chart-heading">
                    <div>
                      <p className="eyebrow">SALES PERFORMANCE</p>
                      <h2>Revenue <span className="heading-light">/ {period.title}</span></h2>
                    </div>
                    <div className="chart-controls" aria-label="Revenue chart period">
                      <button className="chart-arrow" type="button" onClick={() => moveChart(-1)} aria-label="Previous period">‹</button>
                      <div className="chart-dots">
                        {chartPeriods.map((item, index) => (
                          <button
                            className={`chart-dot${chartIndex === index ? " is-selected" : ""}`}
                            key={item.title}
                            type="button"
                            onClick={() => setChartIndex(index)}
                            aria-label={`Show ${item.title} revenue`}
                            aria-pressed={chartIndex === index}
                          />
                        ))}
                      </div>
                      <button className="chart-arrow" type="button" onClick={() => moveChart(1)} aria-label="Next period">›</button>
                    </div>
                  </div>
                  <div className="chart-legend"><span className="legend-swatch" />Revenue <span className="chart-empty-label">No revenue data yet</span></div>
                  <div className="revenue-chart" role="img" aria-label={`${period.title} revenue chart. No revenue data yet.`}>
                    <div className="y-axis-labels"><span>KSh 10k</span><span>KSh 7.5k</span><span>KSh 5k</span><span>KSh 2.5k</span><span>KSh 0</span></div>
                    <div className="chart-plot">
                      <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
                      <div className="chart-columns" style={{ gridTemplateColumns: `repeat(${period.labels.length}, minmax(0, 1fr))` }}>
                        {period.labels.map((label) => <div className="chart-column" key={label}><div className="bar-space" /><span>{label}</span></div>)}
                      </div>
                      <div className="chart-empty-message"><span className="empty-spark">+</span><strong>Your revenue trend starts here</strong><span>Completed orders will appear in this chart.</span></div>
                    </div>
                  </div>
                </section>

                <div className="overview-lists">
                  <section className="panel list-panel">
                    <div className="section-heading">
                      <div><p className="eyebrow">MENU PERFORMANCE</p><h2>Top-selling items</h2></div>
                      <button className="text-button" type="button" onClick={() => setAdminPage("Menu")}>View all <span aria-hidden="true">→</span></button>
                    </div>
                    <div className="empty-list-state"><span className="empty-icon">01</span><div><strong>No items ranked yet</strong><p>Popular dishes will appear after orders come in.</p></div></div>
                  </section>
                  <section className="panel list-panel">
                    <div className="section-heading">
                      <div><p className="eyebrow">SERVICE ACTIVITY</p><h2>Waiter service</h2></div>
                      <button className="text-button" type="button" onClick={() => setAdminPage("Staff tracker")}>View all <span aria-hidden="true">→</span></button>
                    </div>
                    <div className="empty-list-state"><span className="empty-icon waiter-empty">W</span><div><strong>No service activity yet</strong><p>Tables served by each waiter will show here.</p></div></div>
                  </section>
                </div>

                <div className="feedback-grid">
                  <section className="feedback-panel recommendations-panel">
                    <div className="feedback-symbol">R</div>
                    <div className="feedback-copy"><p className="eyebrow">CUSTOMER VOICE</p><h2>Recommendations <span>0</span></h2><p>None received yet.</p></div>
                    <button className="secondary-button" type="button" onClick={() => setDetailPanel("recommendations")}>View recommendations</button>
                  </section>
                  <section className="feedback-panel complaints-panel">
                    <div className="feedback-symbol complaint-symbol">!</div>
                    <div className="feedback-copy"><p className="eyebrow">CUSTOMER VOICE</p><h2>Complaints <span>0</span></h2><p>None received yet.</p></div>
                    <button className="secondary-button" type="button" onClick={() => setDetailPanel("complaints")}>View complaints</button>
                  </section>
                </div>
              </>
            ) : adminPage === "Menu" ? (
              <MenuManagement
                items={menuItems}
                onAddItem={(item) => setMenuItems((current) => [...current, item])}
                onSaveItems={saveMenuItems}
                onDeleteItem={(id) => setMenuItems((current) => current.filter((item) => item.id !== id))}
              />
            ) : adminPage === "Restaurant profile" ? (
              profileLoaded ? (
                <RestaurantProfile initialProfile={restaurantProfile} onSave={setRestaurantProfile} />
              ) : (
                <section className="panel placeholder-panel"><p className="eyebrow">RESTAURANT SETUP</p><h2>Loading profile</h2></section>
              )
            ) : (
              <section className="panel placeholder-panel">
                <p className="eyebrow">ADMIN WORKSPACE</p>
                <h2>{adminPage}</h2>
                <p>This page is ready to be built next. Its restaurant data will appear here once we add the workflow.</p>
              </section>
            )}
          </main>
        ) : workspace === "customer" ? (
          <main className="page-content customer-content">
            <div className="customer-kicker"><span className="eyebrow">YOUR RESTAURANT, AT A GLANCE</span><span className={`customer-open-state${restaurantIsOpen ? " is-open" : ""}`}><i className="status-dot" />{restaurantIsOpen ? "Open now" : "Currently closed"}</span></div>
            <section className="customer-welcome">
              <div className="customer-welcome-copy"><p className="eyebrow">{restaurantProfile.name || "WELCOME"}</p><h1>{restaurantProfile.name || "A good meal is closer than you think."}</h1><p>{restaurantProfile.welcomeMessage || "The restaurant menu and online ordering will appear here once they&apos;re set up."}</p>{restaurantProfile.famousDish && <div className="customer-famous-dish"><span>HOUSE FAVORITE</span><strong>{restaurantProfile.famousDish}</strong></div>}<button className="primary-button" type="button" onClick={() => selectWorkspace("admin")}>Restaurant team <span aria-hidden="true">→</span></button></div>
              <div className="customer-visual" aria-hidden="true"><div className="plate plate-back" /><div className="plate plate-front"><span className="plate-center" /></div><span className="visual-leaf leaf-one" /><span className="visual-leaf leaf-two" /><span className="visual-dot dot-one" /><span className="visual-dot dot-two" /><span className="visual-caption">MADE FRESH<br />SERVED WITH CARE</span></div>
            </section>
            {tableNumber && <p className="customer-table-notice">You&apos;re viewing table {tableNumber}.</p>}
            {menuItems.length > 0 ? (
              <section className="customer-menu-section">
                <div className="customer-menu-heading"><div><p className="eyebrow">THE MENU</p><h2>Made fresh for you.</h2></div><span>{menuItems.length} {menuItems.length === 1 ? "dish" : "dishes"}</span></div>
                <div className="customer-menu-grid">
                  {menuItems.map((item) => (
                    <article className="customer-food-card" key={item.id}>
                      {item.image ? <Image src={item.image} alt={item.name} className="customer-food-image" width={500} height={320} unoptimized /> : <div className="customer-food-placeholder" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</div>}
                      <div className="customer-food-copy"><div className="food-card-tags"><span>{item.category}</span><span>{item.mealPeriod}</span></div><h3>{item.name}</h3><p>{item.description}</p><strong>KSh {item.price.toLocaleString("en-KE")}</strong></div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="customer-menu-empty">
                <div><p className="eyebrow">THE MENU</p><h2>Something delicious is on its way.</h2><p>Check back soon to explore dishes, drinks, and today&apos;s specials.</p></div>
                <div className="menu-empty-stamp">MENU<br />COMING<br />SOON</div>
              </section>
            )}
            {restaurantProfile.photos.length > 0 && <section className="customer-gallery"><div><p className="eyebrow">AT THE RESTAURANT</p><h2>A place to settle in.</h2></div><div className="customer-gallery-grid">{restaurantProfile.photos.map((photo, index) => <div className="customer-gallery-photo" key={`${photo.slice(0, 30)}-${index}`}><Image src={photo} alt={`${restaurantProfile.name || "Restaurant"} interior ${index + 1}`} fill sizes="(max-width: 650px) 100vw, 33vw" unoptimized /></div>)}</div></section>}
            {(restaurantProfile.phone || restaurantProfile.email || restaurantProfile.address) && <section className="customer-contact-strip"><div><p className="eyebrow">PLAN YOUR VISIT</p><h2>We&apos;d love to see you.</h2></div><div className="customer-contact-details">{restaurantProfile.address && <span>{restaurantProfile.address}</span>}{restaurantProfile.phone && <a href={`tel:${restaurantProfile.phone}`}>{restaurantProfile.phone}</a>}{restaurantProfile.email && <a href={`mailto:${restaurantProfile.email}`}>{restaurantProfile.email}</a>}{getMapsHref(restaurantProfile) && <a className="customer-maps-link" href={getMapsHref(restaurantProfile)} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>}</div></section>}
          </main>
        ) : (
          <main className="page-content role-placeholder-content">
            <section className="placeholder-panel">
              <p className="eyebrow">{workspaceLabel.toUpperCase()} WORKSPACE</p>
              <h1>{workspaceLabel} tools are coming next.</h1>
              <p>This area is reserved for the {workspace} workflow. We&apos;ll build it after the admin foundation.</p>
              {workspace === "developer" && <span className="placeholder-note">Developer setup is not configured yet.</span>}
            </section>
          </main>
        )}
      </div>

      {showPassword && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPassword(false)}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <button className="dialog-close" type="button" onClick={() => setShowPassword(false)} aria-label="Close password dialog">×</button>
            <div className="dialog-mark">A</div>
            <p className="eyebrow">RESTRICTED WORKSPACE</p>
            <h2 id="password-title">Admin sign in</h2>
            <p className="dialog-description">Enter a password to preview the admin workspace.</p>
            <form onSubmit={enterAdmin}>
              <label className="field-label" htmlFor="admin-password">Admin password</label>
              <input id="admin-password" className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
              {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
              <p className="prototype-note">Preview only: password verification will be connected to Developer setup later.</p>
              <button className="primary-button dialog-submit" type="submit">Continue to admin <span aria-hidden="true">→</span></button>
            </form>
          </section>
        </div>
      )}

      {showHours && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowHours(false)}>
          <section className="dialog-card hours-dialog" role="dialog" aria-modal="true" aria-labelledby="hours-title">
            <button className="dialog-close" type="button" onClick={() => setShowHours(false)} aria-label="Close opening hours">×</button>
            <p className="eyebrow">RESTAURANT SCHEDULE</p>
            <h2 id="hours-title">Opening hours</h2>
            <p className="dialog-description">The open indicator follows these hours unless manually overridden.</p>
            <form onSubmit={saveSchedule}>
              <div className="schedule-list">
                {days.map((day) => (
                  <div className={`schedule-row${draftSchedule[day].enabled ? "" : " is-disabled"}`} key={day}>
                    <label className="day-checkbox"><input type="checkbox" checked={draftSchedule[day].enabled} onChange={() => setDraftSchedule((current) => ({ ...current, [day]: { ...current[day], enabled: !current[day].enabled } }))} /><span>{day}</span></label>
                    <input className="time-input" aria-label={`${day} opening time`} type="time" value={draftSchedule[day].open} disabled={!draftSchedule[day].enabled} onChange={(event) => setDraftSchedule((current) => ({ ...current, [day]: { ...current[day], open: event.target.value } }))} />
                    <span className="time-separator">to</span>
                    <input className="time-input" aria-label={`${day} closing time`} type="time" value={draftSchedule[day].close} disabled={!draftSchedule[day].enabled} onChange={(event) => setDraftSchedule((current) => ({ ...current, [day]: { ...current[day], close: event.target.value } }))} />
                  </div>
                ))}
              </div>
              <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setShowHours(false)}>Cancel</button><button className="primary-button" type="submit">Save schedule</button></div>
            </form>
          </section>
        </div>
      )}

      {detailPanel && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailPanel(null)}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <button className="dialog-close" type="button" onClick={() => setDetailPanel(null)} aria-label="Close customer feedback">×</button>
            <p className="eyebrow">CUSTOMER VOICE</p>
            <h2 id="feedback-title">{detailPanel === "recommendations" ? "Recommendations" : "Complaints"}</h2>
            <div className="empty-feedback"><span className="empty-icon">0</span><strong>None received yet</strong><p>New customer {detailPanel} will appear here.</p></div>
            <button className="secondary-button full-button" type="button" onClick={() => setDetailPanel(null)}>Close</button>
          </section>
        </div>
      )}
    </div>
  );
}
