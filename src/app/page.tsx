"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CustomerExperience } from "./customer-experience";
import { MenuManagement, type MenuItem } from "./menu-management";
import { defaultRestaurantProfile, RestaurantProfile, type RestaurantProfileData } from "./restaurant-profile";
import { StaffTracker } from "./staff-tracker";
import { DeveloperDashboard } from "./developer-dashboard";
import { WaiterPage } from "./waiter-page";
import { buildCustomerUrl } from "../lib/tenant";

type Workspace = "customer" | "admin" | "waiter" | "cook" | "cashier" | "developer";
type AdminPage = "Overview" | "Staff tracker" | "M-Pesa log" | "Restaurant profile" | "Menu";
type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type BusinessDay = { enabled: boolean; open: string; close: string };
type Schedule = Record<DayName, BusinessDay>;
type CustomerFeedback = { id: string; type: "recommendation" | "complaint"; message: string; orderNumber: string | null; createdAt: string };
type RestaurantOption = Pick<RestaurantProfileData, "name" | "slug">;
type WaiterOption = { id: string; name: string };

function parseCustomerFeedback(value: unknown): CustomerFeedback | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("id" in value) || typeof value.id !== "string"
    || !("type" in value) || (value.type !== "recommendation" && value.type !== "complaint")
    || !("message" in value) || typeof value.message !== "string"
    || !("createdAt" in value) || typeof value.createdAt !== "string") return null;
  const orderNumber = "orderNumber" in value && typeof value.orderNumber === "string" ? value.orderNumber : null;
  return { id: value.id, type: value.type, message: value.message, orderNumber, createdAt: value.createdAt };
}

function isRestaurantOption(value: unknown): value is RestaurantOption {
  return typeof value === "object"
    && value !== null
    && "name" in value
    && typeof value.name === "string"
    && "slug" in value
    && typeof value.slug === "string";
}

function parseMenuItem(value: unknown): MenuItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (!("id" in value) || typeof value.id !== "string"
    || !("name" in value) || typeof value.name !== "string"
    || !("price" in value) || typeof value.price !== "number"
    || !("category" in value) || typeof value.category !== "string"
    || !("mealPeriod" in value) || typeof value.mealPeriod !== "string") return null;
  const images = "images" in value && Array.isArray(value.images) && value.images.every((image) => typeof image === "string")
    ? value.images
    : [];
  const specifications = "specifications" in value && Array.isArray(value.specifications) && value.specifications.every((item) => typeof item === "string")
    ? value.specifications
    : [];
  const description = "description" in value && typeof value.description === "string" ? value.description : "";
  const image = "image" in value && typeof value.image === "string" ? value.image : images[0] ?? "";
  const orderCount = "orderCount" in value && typeof value.orderCount === "number" ? value.orderCount : 0;
  const available = "available" in value && typeof value.available === "boolean" ? value.available : true;
  return {
    id: value.id,
    name: value.name,
    price: value.price,
    description,
    image,
    images,
    specifications,
    available,
    category: value.category,
    mealPeriod: value.mealPeriod,
    orderCount,
  };
}

function responseError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

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
  const [passwordRole, setPasswordRole] = useState<"admin" | "developer">("admin");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [detailPanel, setDetailPanel] = useState<"recommendations" | "complaints" | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfileData>(defaultRestaurantProfile);
  const [tableNumber, setTableNumber] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState<CustomerFeedback[]>([]);
  const [isServerDataReady, setIsServerDataReady] = useState(false);
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantLookupLoading, setRestaurantLookupLoading] = useState(true);
  const [restaurantLookupError, setRestaurantLookupError] = useState("");
  const [restaurantLookupAttempt, setRestaurantLookupAttempt] = useState(0);
  const [restaurantName, setRestaurantName] = useState("");
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState("");
  const [restaurantSuspended, setRestaurantSuspended] = useState(false);
  const [adminRestaurantOptions, setAdminRestaurantOptions] = useState<RestaurantOption[]>([]);
  const [selectedAdminRestaurantSlug, setSelectedAdminRestaurantSlug] = useState("");
  const [showAdminRestaurantPicker, setShowAdminRestaurantPicker] = useState(false);
  const [showWaiterLogin, setShowWaiterLogin] = useState(false);
  const [selectedWaiterRestaurantSlug, setSelectedWaiterRestaurantSlug] = useState("");
  const [waiterRestaurantId, setWaiterRestaurantId] = useState("");
  const [waiterOptions, setWaiterOptions] = useState<WaiterOption[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState("");
  const [waiterSecurityKey, setWaiterSecurityKey] = useState("");
  const [waiterSignInError, setWaiterSignInError] = useState("");
  const [waiterSignInSubmitting, setWaiterSignInSubmitting] = useState(false);

  const loadRestaurantOptions = useCallback(async () => {
    setRestaurantLookupLoading(true);
    setRestaurantLookupError("");
    try {
      const response = await fetch("/api/restaurants", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load restaurants.");

      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("restaurants" in payload) || !Array.isArray(payload.restaurants)) {
        throw new Error("The restaurant list response was invalid.");
      }

      setRestaurants(payload.restaurants.filter(isRestaurantOption));
    } catch {
      setRestaurantLookupError("We couldn’t load the restaurant list. Please try again.");
    } finally {
      setRestaurantLookupLoading(false);
    }
  }, []);

  const loadRestaurantData = useCallback(async (slug: string) => {
    setIsServerDataReady(false);
    try {
      const response = await fetch(`/api/restaurants/${encodeURIComponent(slug)}`);
      if (!response.ok) {
        setRestaurantProfile(defaultRestaurantProfile);
        setMenuItems([]);
        setCustomerFeedback([]);
        setRestaurantSuspended(response.status === 403);
        return;
      }

      setRestaurantSuspended(false);
      const result = await response.json();
      const restaurantData = result.restaurant ?? {};
      const restaurantId = restaurantData.id;
      setRestaurantProfile({
        ...defaultRestaurantProfile,
        ...restaurantData,
        slug: restaurantData.slug ?? slug,
        logo: restaurantData.logo ?? "",
        phone: restaurantData.phone ?? "",
        email: restaurantData.email ?? "",
        address: restaurantData.address ?? "",
        mapsUrl: restaurantData.mapsUrl ?? "",
        welcomeMessage: restaurantData.welcomeMessage ?? "",
        famousDish: restaurantData.famousDish ?? "",
        photos: Array.isArray(restaurantData.photos) ? restaurantData.photos : [],
        paymentMethod: restaurantData.paymentMethod ?? defaultRestaurantProfile.paymentMethod,
        paymentNumber: restaurantData.paymentNumber ?? "",
        tableCount: restaurantData.tableCount ?? defaultRestaurantProfile.tableCount,
      });

      if (restaurantId) {
        const [menuResponse, feedbackResponse] = await Promise.all([
          fetch(`/api/menu?restaurantId=${encodeURIComponent(restaurantId)}`),
          fetch(`/api/feedback?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        if (menuResponse.ok) {
          const menuJson: unknown = await menuResponse.json();
          const menuRows: unknown[] = typeof menuJson === "object" && menuJson !== null && "menu" in menuJson && Array.isArray(menuJson.menu)
            ? menuJson.menu
            : [];
          const menu = menuRows.map(parseMenuItem).filter((item): item is MenuItem => item !== null);
          setMenuItems(menu);
        } else {
          setMenuItems([]);
        }
        if (feedbackResponse.ok) {
          const feedbackJson: unknown = await feedbackResponse.json();
          const feedbackRows: unknown[] = typeof feedbackJson === "object" && feedbackJson !== null && "feedback" in feedbackJson && Array.isArray(feedbackJson.feedback)
            ? feedbackJson.feedback
            : [];
          setCustomerFeedback(feedbackRows.map(parseCustomerFeedback).filter((entry): entry is CustomerFeedback => entry !== null));
        } else {
          setCustomerFeedback([]);
        }
      } else {
        setMenuItems([]);
        setCustomerFeedback([]);
      }
    } catch {
      setRestaurantProfile(defaultRestaurantProfile);
      setMenuItems([]);
      setCustomerFeedback([]);
    } finally {
      setIsServerDataReady(true);
    }
  }, []);

  useEffect(() => {
    if (workspace !== "admin" || !restaurantProfile.id) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/feedback?restaurantId=${encodeURIComponent(restaurantProfile.id ?? "")}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (typeof payload === "object" && payload !== null && "feedback" in payload && Array.isArray(payload.feedback) && active) {
          const rows: unknown[] = payload.feedback;
          setCustomerFeedback(rows.map(parseCustomerFeedback).filter((entry): entry is CustomerFeedback => entry !== null));
        }
      } catch {
        if (active) setCustomerFeedback([]);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [restaurantProfile.id, workspace]);

  useEffect(() => {
    const initialization = window.setTimeout(async () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("restaurant") ?? "";
      const table = params.get("table") ?? "";
      setRestaurantSlug(slug);
      setTableNumber(table);

      if (!slug) {
        setIsServerDataReady(true);
        await loadRestaurantOptions();
        return;
      }

      void loadRestaurantData(slug);
    }, 0);
    return () => window.clearTimeout(initialization);
  }, [loadRestaurantData, loadRestaurantOptions, restaurantLookupAttempt]);

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

    if (nextWorkspace === "admin" && !restaurantSlug) {
      setSelectedAdminRestaurantSlug("");
      setPasswordError("");
      setShowAdminRestaurantPicker(true);
      void (async () => {
        try {
          const response = await fetch("/api/admin/restaurant-options", { cache: "no-store" });
          const payload: unknown = await response.json();
          if (!response.ok || typeof payload !== "object" || payload === null || !("restaurants" in payload) || !Array.isArray(payload.restaurants)) {
            throw new Error("Could not load registered restaurants.");
          }
          setAdminRestaurantOptions(payload.restaurants.filter(isRestaurantOption));
        } catch {
          setPasswordError("Could not load registered restaurants. Please try again.");
        }
      })();
      return;
    }

    if (nextWorkspace === "admin" || nextWorkspace === "developer") {
      setPasswordRole(nextWorkspace);
      setPassword("");
      setPasswordError("");
      setShowPassword(true);
      return;
    }
    if (nextWorkspace === "waiter") {
      setSelectedWaiterRestaurantSlug(restaurantSlug);
      setWaiterRestaurantId("");
      setWaiterOptions([]);
      setSelectedWaiterId("");
      setWaiterSecurityKey("");
      setWaiterSignInError("");
      setShowWaiterLogin(true);
      if (!restaurantSlug) void loadRestaurantOptions();
      return;
    }
    if (nextWorkspace === "customer" && !restaurantSlug) void loadRestaurantOptions();
    setWorkspace(nextWorkspace);
    setAdminPage("Overview");
  }

  useEffect(() => {
    if (!showWaiterLogin || !selectedWaiterRestaurantSlug) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setWaiterSignInError("");
      try {
        const response = await fetch(`/api/waiter/login?slug=${encodeURIComponent(selectedWaiterRestaurantSlug)}`, { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok || typeof payload !== "object" || payload === null
          || !("restaurantId" in payload) || typeof payload.restaurantId !== "string"
          || !("waiters" in payload) || !Array.isArray(payload.waiters)) {
          throw new Error(responseError(payload, "Could not load this restaurant’s waiters."));
        }
        const options = payload.waiters.filter((waiter): waiter is WaiterOption =>
          typeof waiter === "object" && waiter !== null && "id" in waiter && typeof waiter.id === "string"
          && "name" in waiter && typeof waiter.name === "string");
        if (active) {
          setWaiterRestaurantId(payload.restaurantId);
          setWaiterOptions(options);
          setSelectedWaiterId(options[0]?.id ?? "");
        }
      } catch (loadError) {
        if (active) setWaiterSignInError(loadError instanceof Error ? loadError.message : "Could not load this restaurant’s waiters.");
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedWaiterRestaurantSlug, showWaiterLogin]);

  async function enterWaiterWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!waiterRestaurantId || !selectedWaiterId || !waiterSecurityKey) {
      setWaiterSignInError("Select your name and enter your security key.");
      return;
    }
    setWaiterSignInSubmitting(true);
    setWaiterSignInError("");
    try {
      const response = await fetch("/api/waiter/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: waiterRestaurantId, staffId: selectedWaiterId, securityKey: waiterSecurityKey }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload, "Waiter sign in failed."));
      if (selectedWaiterRestaurantSlug && selectedWaiterRestaurantSlug !== restaurantSlug) {
        setRestaurantSlug(selectedWaiterRestaurantSlug);
        void loadRestaurantData(selectedWaiterRestaurantSlug);
      }
      setShowWaiterLogin(false);
      setWaiterSecurityKey("");
      setWorkspace("waiter");
    } catch (loginError) {
      setWaiterSignInError(loginError instanceof Error ? loginError.message : "Waiter sign in failed.");
    } finally {
      setWaiterSignInSubmitting(false);
    }
  }

  async function signOutWaiter() {
    const response = await fetch("/api/waiter/logout", { method: "POST" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    setWorkspace("customer");
  }

  function continueToAdminSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const restaurant = adminRestaurantOptions.find((option) => option.slug === selectedAdminRestaurantSlug);
    if (!restaurant) {
      setPasswordError("Select a restaurant to continue.");
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("restaurant", restaurant.slug);
    window.history.replaceState(null, "", url);
    setRestaurantSlug(restaurant.slug);
    setShowAdminRestaurantPicker(false);
    setPasswordRole("admin");
    setPassword("");
    setPasswordError("");
    setShowPassword(true);
  }

  async function enterRestrictedWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setPasswordError(`Enter the ${passwordRole} password.`);
      return;
    }
    if (passwordRole === "admin" && !restaurantSlug) {
      setPasswordError("Open the restaurant-specific link before signing in as its admin.");
      return;
    }

    setPasswordSubmitting(true);
    setPasswordError("");
    try {
      const response = await fetch(passwordRole === "developer" ? "/api/developer/login" : "/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordRole === "developer" ? { password } : { password, slug: restaurantSlug }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Could not sign in to the ${passwordRole} workspace.`;
        throw new Error(message);
      }
      if (passwordRole === "admin") await loadRestaurantData(restaurantSlug);
      setShowPassword(false);
      setPassword("");
      setWorkspace(passwordRole);
      setAdminPage("Overview");
    } catch (loginError) {
      setPasswordError(loginError instanceof Error ? loginError.message : `Could not sign in to the ${passwordRole} workspace.`);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function saveRestaurantProfile(profile: RestaurantProfileData) {
    if (!profile.id) throw new Error("This restaurant profile is not linked to a registered restaurant.");
    const response = await fetch("/api/restaurants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Could not save the restaurant profile.";
      throw new Error(message);
    }
    setRestaurantProfile(profile);
  }

  function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchedule(draftSchedule);
    setManualStatus(null);
    setShowHours(false);
  }

  async function addMenuItem(item: Omit<MenuItem, "id">) {
    if (!restaurantProfile.id) throw new Error("This restaurant is not linked to a registered account.");
    const response = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, restaurantId: restaurantProfile.id }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(responseError(payload, "Could not add this menu item."));
    const created = typeof payload === "object" && payload !== null && "item" in payload ? parseMenuItem(payload.item) : null;
    if (!created) throw new Error("The menu response was invalid.");
    setMenuItems((current) => [...current, created]);
    return created;
  }

  async function saveMenuItems(updatedItems: MenuItem[]) {
    if (!restaurantProfile.id) throw new Error("This restaurant is not linked to a registered account.");
    const savedItems = await Promise.all(updatedItems.map(async (item) => {
      const response = await fetch(`/api/menu/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, restaurantId: restaurantProfile.id }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload, `Could not save ${item.name}.`));
      const saved = typeof payload === "object" && payload !== null && "item" in payload ? parseMenuItem(payload.item) : null;
      if (!saved) throw new Error(`The saved menu response for ${item.name} was invalid.`);
      return saved;
    }));
    const updates = new Map(savedItems.map((item) => [item.id, item]));
    setMenuItems((current) => current.map((item) => updates.get(item.id) ?? item));
  }

  async function deleteMenuItem(id: string) {
    if (!restaurantProfile.id) throw new Error("This restaurant is not linked to a registered account.");
    const response = await fetch(`/api/menu/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: restaurantProfile.id }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(responseError(payload, "Could not delete this menu item."));
    setMenuItems((current) => current.filter((item) => item.id !== id));
  }

  function moveChart(direction: number) {
    setChartIndex((current) => (current + direction + chartPeriods.length) % chartPeriods.length);
  }

  const workspaceLabel = workspace === "developer" ? "Developer" : workspace[0].toUpperCase() + workspace.slice(1);
  const period = chartPeriods[chartIndex];
  const recommendations = customerFeedback.filter((entry) => entry.type === "recommendation");
  const complaints = customerFeedback.filter((entry) => entry.type === "complaint");
  const normalizedRestaurantName = restaurantName.trim().toLowerCase();
  const exactRestaurantMatches = restaurants.filter((restaurant) => restaurant.name.trim().toLowerCase() === normalizedRestaurantName);
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.slug === selectedRestaurantSlug)
    ?? (exactRestaurantMatches.length === 1 ? exactRestaurantMatches[0] : undefined);
  const matchingRestaurants = restaurants.filter((restaurant) => restaurant.name.toLowerCase().includes(normalizedRestaurantName));

  function openSelectedRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRestaurant) return;
    window.location.assign(buildCustomerUrl(window.location.origin, selectedRestaurant.slug, tableNumber));
  }

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
      {expanded && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setExpanded(false)} />}

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-context">
            <button className="mobile-nav-trigger" type="button" aria-label={expanded ? "Close navigation" : "Open navigation"} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}><span /><span /><span /></button>
            <span className="context-dot" />
            <span>{workspaceLabel} workspace</span>
          </div>
          <div className="topbar-meta">
            <span className="topbar-date">Live service</span>
            {workspace !== "waiter" && (restaurantProfile.logo ? <Image src={restaurantProfile.logo} alt="" className="user-avatar profile-avatar-image" width={32} height={32} unoptimized /> : <span className="user-avatar" aria-label="Restaurant profile">R</span>)}
          </div>
        </header>

        {!restaurantSlug && workspace === "customer" ? (
          <main className="page-content customer-content">
            <section className="panel restaurant-lookup-panel">
              <p className="eyebrow">RESTAURANT LOOKUP</p>
              <h1>Which restaurant are you visiting?</h1>
              <p className="restaurant-lookup-copy">Enter the restaurant name to open its menu. Scanning a restaurant QR code takes you directly there.</p>
              {restaurantLookupLoading ? (
                <p className="restaurant-lookup-status" role="status">Loading restaurants…</p>
              ) : restaurantLookupError ? (
                <div className="restaurant-lookup-error">
                  <p role="alert">{restaurantLookupError}</p>
                  <button className="secondary-button" type="button" onClick={() => setRestaurantLookupAttempt((attempt) => attempt + 1)}>Try again</button>
                </div>
              ) : restaurants.length === 0 ? (
                <div className="restaurant-lookup-error">
                  <p className="restaurant-lookup-status" role="status">No restaurants are currently available.</p>
                  <button className="secondary-button" type="button" onClick={() => void loadRestaurantOptions()}>Refresh list</button>
                </div>
              ) : (
                <form className="restaurant-lookup-form" onSubmit={openSelectedRestaurant}>
                  <label className="profile-field restaurant-lookup-field" htmlFor="restaurant-name">
                    <span>Restaurant name</span>
                    <input
                      id="restaurant-name"
                      autoComplete="off"
                      type="search"
                      placeholder="Start typing a restaurant name"
                      value={restaurantName}
                      onChange={(event) => {
                        setRestaurantName(event.target.value);
                        setSelectedRestaurantSlug("");
                      }}
                    />
                  </label>
                  <div className="restaurant-lookup-options" role="group" aria-label="Available restaurants">
                    {matchingRestaurants.length > 0 ? matchingRestaurants.map((restaurant) => (
                      <button
                        className={`restaurant-lookup-option${selectedRestaurantSlug === restaurant.slug ? " is-selected" : ""}`}
                        key={restaurant.slug}
                        type="button"
                        aria-pressed={selectedRestaurantSlug === restaurant.slug}
                        onClick={() => {
                          setRestaurantName(restaurant.name);
                          setSelectedRestaurantSlug(restaurant.slug);
                        }}
                      >
                        <span>{restaurant.name}</span>
                        <span aria-hidden="true">{selectedRestaurantSlug === restaurant.slug ? "✓" : "→"}</span>
                      </button>
                    )) : (
                      <p className="restaurant-lookup-status">No restaurant found by that name.</p>
                    )}
                  </div>
                  <button className="primary-button restaurant-lookup-submit" type="submit" disabled={!selectedRestaurant}>Open restaurant <span aria-hidden="true">→</span></button>
                </form>
              )}
            </section>
          </main>
        ) : workspace === "admin" ? (
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
                    <div className="feedback-copy"><p className="eyebrow">CUSTOMER VOICE</p><h2>Recommendations <span>{isServerDataReady ? recommendations.length : 0}</span></h2><p>{recommendations.length ? recommendations.at(-1)?.message : "None received yet."}</p></div>
                    <button className="secondary-button" type="button" disabled={!recommendations.length} onClick={() => setDetailPanel("recommendations")}>View recommendations</button>
                  </section>
                  <section className="feedback-panel complaints-panel">
                    <div className="feedback-symbol complaint-symbol">!</div>
                    <div className="feedback-copy"><p className="eyebrow">CUSTOMER VOICE</p><h2>Complaints <span>{isServerDataReady ? complaints.length : 0}</span></h2><p>{complaints.length ? complaints.at(-1)?.message : "None received yet."}</p></div>
                    <button className="secondary-button" type="button" disabled={!complaints.length} onClick={() => setDetailPanel("complaints")}>View complaints</button>
                  </section>
                </div>
              </>
            ) : adminPage === "Menu" ? (
              <MenuManagement
                items={menuItems}
                onAddItem={addMenuItem}
                onSaveItems={saveMenuItems}
                onDeleteItem={deleteMenuItem}
              />
            ) : adminPage === "Restaurant profile" ? (
              isServerDataReady ? (
                <RestaurantProfile initialProfile={restaurantProfile} onSave={saveRestaurantProfile} />
              ) : (
                <section className="panel placeholder-panel"><p className="eyebrow">RESTAURANT SETUP</p><h2>Loading profile</h2></section>
              )
            ) : adminPage === "Staff tracker" ? (
              <StaffTracker profile={restaurantProfile} />
            ) : (
              <section className="panel placeholder-panel">
                <p className="eyebrow">ADMIN WORKSPACE</p>
                <h2>{adminPage}</h2>
                <p>This page is ready to be built next. Its restaurant data will appear here once we add the workflow.</p>
              </section>
            )}
          </main>
        ) : workspace === "waiter" ? (
          <WaiterPage onSignOut={signOutWaiter} />
        ) : workspace === "developer" ? (
          <DeveloperDashboard />
        ) : workspace === "customer" && restaurantSuspended ? (
          <main className="page-content customer-content"><section className="panel restaurant-suspended-panel"><p className="eyebrow">RESTAURANT UNAVAILABLE</p><h1>This restaurant is temporarily unavailable</h1><p>Customer access has been paused. Please contact the restaurant directly for assistance.</p></section></main>
        ) : workspace === "customer" ? (
          <CustomerExperience items={menuItems} profile={restaurantProfile} isOpen={restaurantIsOpen} tableNumber={tableNumber} />
        ) : (
          <main className="page-content role-placeholder-content">
            <section className="placeholder-panel">
              <p className="eyebrow">{workspaceLabel.toUpperCase()} WORKSPACE</p>
              <h1>{workspaceLabel} tools are coming next.</h1>
              <p>This area is reserved for the {workspace} workflow. We&apos;ll build it after the admin foundation.</p>
            </section>
          </main>
        )}
      </div>

      {showAdminRestaurantPicker && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAdminRestaurantPicker(false)}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="admin-restaurant-title">
            <button className="dialog-close" type="button" onClick={() => setShowAdminRestaurantPicker(false)} aria-label="Close restaurant selection">×</button>
            <div className="dialog-mark">A</div>
            <p className="eyebrow">RESTAURANT ADMIN</p>
            <h2 id="admin-restaurant-title">Choose your restaurant</h2>
            <p className="dialog-description">Select a restaurant, then enter its admin password.</p>
            {adminRestaurantOptions.length === 0 ? (
              <p className="restaurant-lookup-status" role="status">No restaurants are registered yet, or the list could not be loaded. Close this window and try again.</p>
            ) : (
              <form className="restaurant-lookup-form" onSubmit={continueToAdminSignIn}>
                <label className="profile-field restaurant-lookup-field" htmlFor="admin-restaurant">
                  <span>Restaurant</span>
                  <select id="admin-restaurant" value={selectedAdminRestaurantSlug} onChange={(event) => setSelectedAdminRestaurantSlug(event.target.value)}>
                    <option value="">Select a restaurant</option>
                    {adminRestaurantOptions.map((restaurant) => <option value={restaurant.slug} key={restaurant.slug}>{restaurant.name}</option>)}
                  </select>
                </label>
                {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
                <button className="primary-button dialog-submit" type="submit" disabled={!selectedAdminRestaurantSlug}>Continue <span aria-hidden="true">→</span></button>
              </form>
            )}

            {showWaiterLogin && (
              <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowWaiterLogin(false)}>
                <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="waiter-login-title">
                  <button className="dialog-close" type="button" onClick={() => setShowWaiterLogin(false)} aria-label="Close waiter sign in">×</button>
                  <div className="dialog-mark">W</div>
                  <p className="eyebrow">WAITER SIGN IN</p>
                  <h2 id="waiter-login-title">Open your service board</h2>
                  <p className="dialog-description">Choose your restaurant and staff profile, then enter the security key set in the staff tracker.</p>
                  <form onSubmit={(event) => void enterWaiterWorkspace(event)}>
                    {!restaurantSlug && (
                      <label className="profile-field restaurant-lookup-field" htmlFor="waiter-restaurant">
                        <span>Restaurant</span>
                        <select id="waiter-restaurant" value={selectedWaiterRestaurantSlug} onChange={(event) => {
                          setSelectedWaiterRestaurantSlug(event.target.value);
                          setWaiterOptions([]);
                          setWaiterRestaurantId("");
                          setSelectedWaiterId("");
                        }}>
                          <option value="">Select a restaurant</option>
                          {restaurants.map((restaurant) => <option value={restaurant.slug} key={restaurant.slug}>{restaurant.name}</option>)}
                        </select>
                      </label>
                    )}
                    {!restaurantSlug && restaurantLookupError && <p className="field-error" role="alert">{restaurantLookupError}</p>}
                    {restaurantSlug && <p className="waiter-login-restaurant">{restaurantProfile.name}</p>}
                    <label className="profile-field restaurant-lookup-field" htmlFor="waiter-name">
                      <span>Waiter</span>
                      <select id="waiter-name" value={selectedWaiterId} onChange={(event) => setSelectedWaiterId(event.target.value)} disabled={!waiterOptions.length}>
                        <option value="">{waiterOptions.length ? "Select your staff profile" : "No waiter profiles available"}</option>
                        {waiterOptions.map((waiter) => <option value={waiter.id} key={waiter.id}>{waiter.name}</option>)}
                      </select>
                    </label>
                    {selectedWaiterRestaurantSlug && !waiterOptions.length && !waiterSignInError && <p className="restaurant-lookup-status">No waiter profiles are set up for this restaurant yet.</p>}
                    <label className="profile-field waiter-key-field" htmlFor="waiter-security-key"><span>Security key</span><input id="waiter-security-key" type="password" autoComplete="current-password" value={waiterSecurityKey} onChange={(event) => setWaiterSecurityKey(event.target.value)} /></label>
                    {waiterSignInError && <p className="field-error" role="alert">{waiterSignInError}</p>}
                    <button className="primary-button dialog-submit" type="submit" disabled={waiterSignInSubmitting || !waiterOptions.length}>{waiterSignInSubmitting ? "Signing in…" : "Continue to waiter page"} <span aria-hidden="true">→</span></button>
                  </form>
                </section>
              </div>
            )}
          </section>
        </div>
      )}

      {showPassword && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPassword(false)}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <button className="dialog-close" type="button" onClick={() => setShowPassword(false)} aria-label="Close password dialog">×</button>
            <div className="dialog-mark">A</div>
            <p className="eyebrow">RESTRICTED WORKSPACE</p>
            <h2 id="password-title">{passwordRole === "developer" ? "Developer sign in" : "Admin sign in"}</h2>
            <p className="dialog-description">{passwordRole === "developer" ? "Enter the developer password to manage restaurant accounts." : "Enter this restaurant’s admin password."}</p>
            <form onSubmit={enterRestrictedWorkspace}>
              <label className="field-label" htmlFor="admin-password">{passwordRole === "developer" ? "Developer password" : "Admin password"}</label>
              <input id="admin-password" className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
              {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
              {passwordRole === "developer" && <p className="prototype-note">Developer password is configured in the server code.</p>}
              <button className="primary-button dialog-submit" type="submit" disabled={passwordSubmitting}>{passwordSubmitting ? "Signing in…" : `Continue to ${passwordRole}`} <span aria-hidden="true">→</span></button>
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
            <div className="feedback-list-modal">{(detailPanel === "recommendations" ? recommendations : complaints).length === 0 ? <div className="empty-feedback"><span className="empty-icon">0</span><strong>None received yet</strong><p>New customer {detailPanel} will appear here.</p></div> : [...(detailPanel === "recommendations" ? recommendations : complaints)].reverse().map((entry) => <article className="feedback-message-row" key={entry.id}><p>{entry.message}</p><div><span>{entry.orderNumber ? `Order ${entry.orderNumber}` : "Customer feedback"}</span><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</time></div></article>)}</div>
            <button className="secondary-button full-button" type="button" onClick={() => setDetailPanel(null)}>Close</button>
          </section>
        </div>
      )}
    </div>
  );
}
