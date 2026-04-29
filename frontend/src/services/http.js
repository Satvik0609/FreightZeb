import { api } from "../lib/axios";
import { paginateResult } from "../lib/utils";

export async function get(path, config) {
  const { data } = await api.get(path, config);
  return data;
}

export async function post(path, payload, config) {
  const { data } = await api.post(path, payload, config);
  return data;
}

export async function patch(path, payload, config) {
  const { data } = await api.patch(path, payload, config);
  return data;
}

export async function del(path, config) {
  const { data } = await api.delete(path, config);
  return data;
}

export function normalizeList(payload, key) {
  // Handle { data: [...], pagination: {...} } shape from paginatedResponse
  if (Array.isArray(payload?.data)) {
    return {
      items: payload.data,
      total: payload.pagination?.total ?? payload.data.length,
      page: payload.pagination?.page ?? 1,
      limit: payload.pagination?.limit ?? 20,
    };
  }
  // Handle { [key]: [...], total, page, limit } shape
  return paginateResult(payload, key);
}

export function normalizeEntity(payload, key) {
  return payload?.[key] || null;
}
