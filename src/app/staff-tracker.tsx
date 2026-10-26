"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { RestaurantProfileData } from "./restaurant-profile";

type StaffRole = "Waiter" | "Head chef" | "Cook" | "Manager" | "Security" | "Cashier" | "Other";
type PaymentStatus = "Paid" | "Pending";
type StaffMember = {
  id: string;
  staffCode: string;
  name: string;
  role: StaffRole;
  passportPhoto: string;
  phone: string;
  email: string;
  salary: number | null;
  salaryPayments: Record<string, PaymentStatus>;
  ordersTaken: number;
  revenueGenerated: number;
};
type StaffTrackerProps = { profile: RestaurantProfileData };
type StaffForm = Omit<StaffMember, "id" | "staffCode" | "ordersTaken" | "revenueGenerated">;

const staffRoles: StaffRole[] = ["Waiter", "Head chef", "Cook", "Manager", "Security", "Cashier", "Other"];
const paymentStatuses: PaymentStatus[] = ["Pending", "Paid"];
const fileLimit = 350 * 1024;

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function emptyForm(role: StaffRole = "Waiter"): StaffForm {
  return {
    name: "",
    role,
    passportPhoto: "",
    phone: "",
    email: "",
    salary: null,
    salaryPayments: {},
  };
}

function monthLabel(month: string) {
  if (!month) return "Current month";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

export function StaffTracker({ profile }: StaffTrackerProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [form, setForm] = useState<StaffForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, StaffMember>>({});
  const [showAllWaiters, setShowAllWaiters] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState("");
  const [error, setError] = useState("");
  const [printMember, setPrintMember] = useState<StaffMember | null>(null);

  useEffect(() => {
    const load = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("room.staff.v1");
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed)) setStaff(parsed as StaffMember[]);
        }
      } catch {
        window.localStorage.removeItem("room.staff.v1");
      }
      setSalaryMonth(getCurrentMonth());
      setStaffLoaded(true);
    }, 0);
    return () => window.clearTimeout(load);
  }, []);

  useEffect(() => {
    if (!staffLoaded) return;
    try {
      window.localStorage.setItem("room.staff.v1", JSON.stringify(staff));
    } catch {
      return;
    }
  }, [staff, staffLoaded]);

  const month = salaryMonth || getCurrentMonth();
  const waiters = useMemo(() => staff.filter((member) => member.role === "Waiter").sort((left, right) => right.ordersTaken - left.ordersTaken), [staff]);
  const cooks = staff.filter((member) => member.role === "Head chef" || member.role === "Cook");
  const otherWorkers = staff.filter((member) => !["Waiter", "Head chef", "Cook"].includes(member.role));
  const monthlyPayroll = staff.reduce((total, member) => total + (member.salary ?? 0), 0);

  function updateForm<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function openAdd(role: StaffRole) {
    setForm(emptyForm(role));
    setError("");
    setView("form");
  }

  async function readPassport(event: ChangeEvent<HTMLInputElement>, target: "form" | "inline", memberId?: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the staff ID photo.");
      return;
    }
    if (file.size > fileLimit) {
      setError("Staff photos must be 350 KB or smaller in this browser preview.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      if (target === "form") updateForm("passportPhoto", reader.result);
      else if (memberId) setInlineDrafts((current) => ({ ...current, [memberId]: { ...current[memberId], passportPhoto: reader.result as string } }));
    });
    reader.readAsDataURL(file);
  }

  function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Enter the staff member’s name.");
      return;
    }
    if (form.phone && !/^[+\d][\d\s()-]{6,}$/.test(form.phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (form.salary !== null && (!Number.isFinite(form.salary) || form.salary < 0)) {
      setError("Salary must be zero or more.");
      return;
    }

    const staffCode = `ST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    setStaff((current) => [...current, { ...form, id: crypto.randomUUID(), staffCode, name: form.name.trim(), ordersTaken: 0, revenueGenerated: 0 }]);
    setView("list");
    setError("");
  }

  function beginInlineEdit(member: StaffMember) {
    setEditingId(member.id);
    setInlineDrafts((current) => ({ ...current, [member.id]: { ...member, salaryPayments: { ...(member.salaryPayments ?? {}) } } }));
    setError("");
  }

  function updateInline<Key extends keyof StaffMember>(member: StaffMember, key: Key, value: StaffMember[Key]) {
    setInlineDrafts((current) => ({ ...current, [member.id]: { ...(current[member.id] ?? member), [key]: value } }));
  }

  function saveInline(member: StaffMember) {
    const draft = inlineDrafts[member.id];
    if (!draft?.name.trim()) {
      setError("Staff name cannot be empty.");
      return;
    }
    setStaff((current) => current.map((item) => item.id === member.id ? { ...draft, name: draft.name.trim() } : item));
    setEditingId(null);
    setInlineDrafts((current) => {
      const next = { ...current };
      delete next[member.id];
      return next;
    });
    setError("");
  }

  function deleteMember(member: StaffMember) {
    if (!window.confirm(`Delete ${member.name} from the staff list?`)) return;
    setStaff((current) => current.filter((item) => item.id !== member.id));
    setError("");
  }

  function updateMonthlyPayment(member: StaffMember, status: PaymentStatus) {
    const draft = inlineDrafts[member.id] ?? member;
    updateInline(member, "salaryPayments", { ...draft.salaryPayments, [month]: status });
  }

  function openPrintCard(member: StaffMember) {
    setPrintMember(member);
  }

  function printId() {
    window.print();
  }

  const topWaiters = showAllWaiters ? waiters : waiters.slice(0, 3);

  function renderStaffSection(title: string, eyebrow: string, members: StaffMember[], role: StaffRole, showWaiterColumns = false) {
    return (
      <section className="staff-section">
        <div className="staff-section-heading">
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}<span className="staff-count">{members.length}</span></h2><p>{showWaiterColumns ? "Ranked by orders taken. Revenue and order totals fill in when checkout connects." : "Manage team details, monthly salary, and printed staff IDs."}</p></div>
          <div className="staff-section-actions">
            {showWaiterColumns && <button className="text-button" type="button" disabled={members.length <= 3} onClick={() => setShowAllWaiters((current) => !current)}>{showAllWaiters ? "Show top three" : "View all"} <span aria-hidden="true">→</span></button>}
            <button className="primary-button" type="button" onClick={() => openAdd(role)}><span className="button-symbol">+</span>{role === "Waiter" ? "Add waiter" : role === "Cook" ? "Add cook" : "Add worker"}</button>
          </div>
        </div>
        {members.length === 0 ? <div className="staff-empty-state"><span className="empty-icon">{role === "Waiter" ? "W" : role === "Cook" ? "C" : "S"}</span><strong>No {title.toLowerCase()} added yet</strong><p>Add team members to build the restaurant directory.</p></div> : <div className="staff-table-wrap"><div className={`staff-table-head${showWaiterColumns ? " waiter-columns" : ""}`}><span>Staff member</span><span>Contact</span>{showWaiterColumns && <><span>Orders</span><span>Revenue</span></>}<span>Monthly salary</span><span>{monthLabel(month)} payment</span><span>Access</span><span>Actions</span></div>{(showWaiterColumns ? topWaiters : members).map((member) => {
          const isEditing = editingId === member.id;
          const draft = inlineDrafts[member.id] ?? member;
          const paymentStatus = (draft.salaryPayments ?? {})[month] ?? "Pending";
          return <div className={`staff-row${isEditing ? " is-editing" : ""}${showWaiterColumns ? " waiter-columns" : ""}`} key={member.id}>
            <div className="staff-identity-cell"><label className="staff-avatar-upload">{draft.passportPhoto ? <Image src={draft.passportPhoto} alt={`${draft.name} staff photo`} width={42} height={42} unoptimized /> : <span>{draft.name.slice(0, 1).toUpperCase() || "S"}</span>}{isEditing && <input type="file" accept="image/*" aria-label={`Change ${member.name} passport photo`} onChange={(event) => readPassport(event, "inline", member.id)} />}</label><div className="staff-identity-copy">{isEditing ? <><input className="staff-row-input staff-name-input" aria-label={`${member.name} name`} value={draft.name} onChange={(event) => updateInline(member, "name", event.target.value)} /><select className="staff-row-select" aria-label={`${member.name} role`} value={draft.role} onChange={(event) => updateInline(member, "role", event.target.value as StaffRole)}>{staffRoles.map((option) => <option key={option}>{option}</option>)}</select></> : <><strong>{member.name}</strong><span>{member.role} · {member.staffCode}</span></>}</div></div>
            <div className="staff-contact-cell">{isEditing ? <><input className="staff-row-input" aria-label={`${member.name} phone`} value={draft.phone} onChange={(event) => updateInline(member, "phone", event.target.value)} /><input className="staff-row-input" aria-label={`${member.name} email`} value={draft.email} onChange={(event) => updateInline(member, "email", event.target.value)} /></> : <><span>{member.phone || "No phone"}</span><span>{member.email || "No email"}</span></>}</div>
            {showWaiterColumns && <><strong className="staff-stat-cell">{isEditing ? <span>{member.ordersTaken}</span> : member.ordersTaken}</strong><strong className="staff-stat-cell">KSh {member.revenueGenerated.toLocaleString("en-KE")}</strong></>}
            <div className="staff-salary-cell">{isEditing ? <input className="staff-row-input salary-row-input" aria-label={`${member.name} monthly salary`} min="0" type="number" value={draft.salary ?? ""} onChange={(event) => updateInline(member, "salary", event.target.value ? Number(event.target.value) : null)} /> : <strong>{member.salary === null ? "Not set" : `KSh ${member.salary.toLocaleString("en-KE")}`}</strong>}</div>
            <div className="staff-payment-cell">{isEditing ? <select className="staff-row-select" aria-label={`${member.name} payment status`} value={paymentStatus} onChange={(event) => updateMonthlyPayment(member, event.target.value as PaymentStatus)}>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select> : <span className={`staff-payment-badge${paymentStatus === "Paid" ? " is-paid" : ""}`}>{paymentStatus}</span>}</div>
            <span className="staff-access-note">Set up later</span>
            <div className="staff-row-actions"><button className="row-action" type="button" onClick={() => isEditing ? setEditingId(null) : beginInlineEdit(member)}>{isEditing ? "Cancel" : "Edit"}</button><button className="row-action save-row-action" type="button" disabled={!isEditing} onClick={() => saveInline(member)}>Save</button><button className="row-action delete-row-action" type="button" onClick={() => deleteMember(member)}>Delete</button><button className="row-action print-id-action" type="button" onClick={() => openPrintCard(member)}>Print ID</button></div>
          </div>;
        })}</div>}
      </section>
    );
  }

  if (view === "form") {
    return <div className="staff-workspace"><section className="staff-form-panel"><div className="staff-form-heading"><div><p className="eyebrow">STAFF TRACKER / NEW MEMBER</p><h2>Add {form.role.toLowerCase()}</h2><p>Add the information needed for the team directory and printed ID.</p></div><button className="secondary-button" type="button" onClick={() => { setView("list"); setError(""); }}>Back to staff</button></div><form className="staff-form" onSubmit={saveForm}><label className="staff-photo-upload">{form.passportPhoto ? <Image src={form.passportPhoto} alt="Passport photo preview" width={72} height={72} unoptimized /> : <span>{form.name.slice(0, 1).toUpperCase() || "+"}</span>}<div><strong>{form.passportPhoto ? "Change passport photo" : "Add passport photo"}</strong><small>Photo for printed staff ID · up to 350 KB</small></div><input type="file" accept="image/*" onChange={(event) => readPassport(event, "form")} /></label><div className="staff-form-grid"><label className="staff-field"><span>Full name <i>*</i></span><input autoFocus maxLength={90} placeholder="Staff member name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></label><label className="staff-field"><span>Role</span><select value={form.role} onChange={(event) => updateForm("role", event.target.value as StaffRole)}>{staffRoles.map((roleOption) => <option key={roleOption}>{roleOption}</option>)}</select></label><label className="staff-field"><span>Phone</span><input autoComplete="tel" inputMode="tel" placeholder="+254 7XX XXX XXX" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} /></label><label className="staff-field"><span>Email</span><input autoComplete="email" placeholder="name@example.com" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} /></label><label className="staff-field"><span>Monthly salary <small>Optional · KSh</small></span><input inputMode="decimal" min="0" placeholder="Not set" type="number" value={form.salary ?? ""} onChange={(event) => updateForm("salary", event.target.value ? Number(event.target.value) : null)} /></label><label className="staff-field"><span>{monthLabel(month)} salary status</span><select value={form.salaryPayments[month] ?? "Pending"} onChange={(event) => updateForm("salaryPayments", { ...form.salaryPayments, [month]: event.target.value as PaymentStatus })}>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><div className="staff-access-warning"><span>!</span><p>Login passwords aren’t stored in this preview. Secure staff access will be configured with authentication later.</p></div>{error && <p className="staff-error" role="alert">{error}</p>}<div className="staff-form-actions"><button className="secondary-button" type="button" onClick={() => setView("list")}>Cancel</button><button className="primary-button" type="submit">Save staff member</button></div></form></section></div>;
  }

  return <div className="staff-workspace"><div className="staff-summary-grid"><article><span>Waiters</span><strong>{waiters.length}</strong><small>In the staff directory</small></article><article><span>Kitchen team</span><strong>{cooks.length}</strong><small>Head chefs and cooks</small></article><article><span>Monthly payroll</span><strong>KSh {monthlyPayroll.toLocaleString("en-KE")}</strong><small>{monthLabel(month)} · optional salaries</small></article><label className="staff-month-picker"><span>Payment month</span><input aria-label="Payment month" type="month" value={month} onChange={(event) => setSalaryMonth(event.target.value)} /></label></div><p className="staff-access-note"><span>i</span>Staff records are stored in this browser preview. Passwords and live order/revenue totals require secure account and order services.</p>{error && <p className="staff-error" role="alert">{error}</p>}{renderStaffSection("Waiters", "SERVICE TEAM", waiters, "Waiter", true)}{renderStaffSection("Kitchen team", "KITCHEN", cooks, "Cook")}{renderStaffSection("Other staff", "RESTAURANT TEAM", otherWorkers, "Other")}
    {printMember && <div className="modal-backdrop staff-print-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPrintMember(null)}><section className="staff-id-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-id-dialog-title"><div className="staff-id-dialog-toolbar"><div><p className="eyebrow">STAFF ID PREVIEW</p><h2 id="staff-id-dialog-title">Print staff ID</h2></div><button className="dialog-close" type="button" aria-label="Close staff ID" onClick={() => setPrintMember(null)}>×</button></div><article className="staff-id-print-surface"><header>{profile.logo ? <Image src={profile.logo} alt="" width={42} height={42} unoptimized /> : <span className="staff-id-logo-placeholder">{profile.name.slice(0, 1).toUpperCase() || "R"}</span>}<div><strong>{profile.name || "Restaurant name"}</strong><span>TEAM IDENTIFICATION</span></div></header><div className="staff-id-body">{printMember.passportPhoto ? <Image className="staff-id-photo" src={printMember.passportPhoto} alt={`${printMember.name} passport photo`} width={110} height={130} unoptimized /> : <span className="staff-id-photo-placeholder">{printMember.name.slice(0, 1).toUpperCase()}</span>}<div><p className="eyebrow">AUTHORIZED STAFF</p><h3>{printMember.name}</h3><strong>{printMember.role}</strong><span className="staff-id-code">{printMember.staffCode}</span>{printMember.phone && <span>{printMember.phone}</span>}</div></div><footer><span>{profile.address || "Restaurant staff identification"}</span><span>VALID STAFF ID</span></footer></article><div className="staff-id-dialog-actions"><button className="secondary-button" type="button" onClick={() => setPrintMember(null)}>Close</button><button className="primary-button" type="button" onClick={printId}>Print ID</button></div></section></div>}
  </div>;
}