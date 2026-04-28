import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const ML_URL = import.meta.env.VITE_ML_URL || "http://localhost:8000";

export const roles = ["ADMIN", "WAREHOUSE", "DEALER"];
export const truckTypes = [
  "SMALL_VAN",
  "CONTAINER_20FT",
  "CONTAINER_32FT",
  "FLATBED_TRAILER",
  "REEFER",
];
export const bookingStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];
export const activeBookingFlow = [
  "REQUESTED",
  "APPROVED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
];
export const shipmentStatuses = [
  "PENDING",
  "OPTIMIZED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];
export const invoiceStatuses = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
export const trafficConditions = ["LIGHT", "MODERATE", "HEAVY", "SEVERE"];
export const weatherConditions = ["CLEAR", "CLOUDY", "RAIN", "STORM", "FOG", "SNOW"];
export const priorities = ["NORMAL", "URGENT", "EXPRESS"];
export const timeOfDayOptions = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];
export const cargoTypes = ["GENERAL", "REFRIGERATED", "HAZARDOUS", "FRAGILE"];

export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function statusTone(status) {
  const map = {
    REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    ASSIGNED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
    PICKED_UP: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
    IN_TRANSIT: "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    BOOKED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    MAINTENANCE: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    OPTIMIZED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    OVERDUE: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  };
  return map[status] || "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
}

export function labelize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(value, pattern = "dd MMM yyyy, HH:mm") {
  if (!value) return "—";
  return format(typeof value === "string" ? parseISO(value) : value, pattern);
}

export function formatAgo(value) {
  if (!value) return "—";
  return formatDistanceToNowStrict(typeof value === "string" ? parseISO(value) : value, {
    addSuffix: true,
  });
}

export function formatCurrency(value, currency = "INR") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatNumber(value, maximumFractionDigits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(Number(value));
}

export function percent(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(digits)}%`;
}

export function getInitials(name) {
  return String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((item) => item.message).join(", ");
  }
  if (data?.detail?.message) return data.detail.message;
  if (data?.message) return data.message;
  return error?.message || "Something went wrong";
}

export function paginateResult(payload, key) {
  return {
    items: payload?.[key] || [],
    total: Number(payload?.total || 0),
    page: Number(payload?.page || 1),
    limit: Number(payload?.limit || 20),
  };
}
