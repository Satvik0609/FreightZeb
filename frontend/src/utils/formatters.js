import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function formatCurrency(amount, currency = 'INR') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date, fmt = 'dd MMM yyyy') {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, fmt)
  } catch {
    return '—'
  }
}

export function formatDateTime(date) {
  return formatDate(date, 'dd MMM yyyy, HH:mm')
}

export function formatRelative(date) {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatWeight(kg) {
  if (kg == null) return '—'
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg} kg`
}

export function formatDistance(km) {
  if (km == null) return '—'
  return `${Number(km).toLocaleString('en-IN')} km`
}

export function formatVolume(m3) {
  if (m3 == null) return '—'
  return `${m3} m³`
}

export function formatPercent(val, decimals = 1) {
  if (val == null) return '—'
  return `${Number(val).toFixed(decimals)}%`
}

export function formatNumber(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-IN')
}

export function formatTruckType(type) {
  const map = {
    SMALL_VAN: 'Small Van',
    CONTAINER_20FT: 'Container 20ft',
    CONTAINER_32FT: 'Container 32ft',
    FLATBED_TRAILER: 'Flatbed Trailer',
    REEFER: 'Reefer',
  }
  return map[type] || type
}

export function formatStatus(status) {
  return status?.replace(/_/g, ' ') ?? '—'
}
