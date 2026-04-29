import { formatStatus, formatTruckType } from './formatters'

export function locationLabel(location) {
  if (!location) return '—'
  return location.city || location.address || [location.lat, location.lng].filter(Boolean).join(', ') || '—'
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toNum = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalizePair = (lat, lng) => {
    let nLat = toNum(lat)
    let nLng = toNum(lng)
    if (nLat === null || nLng === null) return null

    // Auto-correct only when lat is clearly invalid and lng is lat-like.
    if (Math.abs(nLat) > 90 && Math.abs(nLng) <= 90) {
      ;[nLat, nLng] = [nLng, nLat]
    }
    if (Math.abs(nLat) > 90 || Math.abs(nLng) > 180) return null

    return { lat: nLat, lng: nLng }
  }

  const calc = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180
    const earthRadiusKm = 6371
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  }

  const a = normalizePair(lat1, lng1)
  const b = normalizePair(lat2, lng2)
  if (!a || !b) return null

  // Deterministic result from normalized coordinates only.
  const distance = calc(a, b)
  if (!Number.isFinite(distance) || distance < 0) return null
  return Number(distance.toFixed(1))
}

export function normalizeNotification(notification = {}) {
  const meta = notification.meta || {}
  return {
    ...notification,
    read: notification.read ?? notification.isRead ?? false,
    isRead: notification.isRead ?? notification.read ?? false,
    priority: notification.priority || meta.priority || 'info',
    actionUrl: notification.actionUrl || meta.actionUrl || null,
  }
}

export function normalizeTruck(truck = {}) {
  const currentLocation = truck.currentLocation || null
  return {
    ...truck,
    registrationNumber: truck.registrationNumber || truck.registrationNo || '—',
    capacityWeight: truck.capacityWeight ?? truck.capacityKg ?? null,
    capacityVolume: truck.capacityVolume ?? truck.capacityM3 ?? null,
    currentLocation,
    lastLatitude: truck.lastLatitude ?? currentLocation?.lat ?? null,
    lastLongitude: truck.lastLongitude ?? currentLocation?.lng ?? null,
  }
}

export function normalizeShipment(shipment = {}) {
  const pickupLocation = shipment.pickupLocation || shipment.origin || null
  const destination = shipment.destination || null
  const requirements = shipment.requirements || {}

  return {
    ...shipment,
    pickupLocation,
    destination,
    origin: shipment.origin || locationLabel(pickupLocation),
    destinationLabel: shipment.destinationLabel || locationLabel(destination),
    weight: shipment.weight ?? shipment.weightKg ?? null,
    weightKg: shipment.weightKg ?? shipment.weight ?? null,
    volume: shipment.volume ?? shipment.volumeM3 ?? null,
    volumeM3: shipment.volumeM3 ?? shipment.volume ?? null,
    cargoType:
      shipment.cargoType ||
      (requirements.tempControlled ? 'PERISHABLE' : requirements.hazardous ? 'HAZARDOUS' : requirements.fragile ? 'FRAGILE' : 'GENERAL'),
    priority: shipment.priority || (shipment.deadline ? 'URGENT' : 'NORMAL'),
    specialInstructions: shipment.specialInstructions || shipment.description || '',
    originLat: pickupLocation?.lat ?? null,
    originLng: pickupLocation?.lng ?? null,
    destinationLat: destination?.lat ?? null,
    destinationLng: destination?.lng ?? null,
    routeText: `${locationLabel(pickupLocation)} → ${locationLabel(destination)}`,
  }
}

export function normalizePrediction(prediction = {}) {
  const type = prediction.predictionType || prediction.type || 'UNKNOWN'
  return {
    ...prediction,
    predictionType: type,
    result:
      prediction.result ||
      (type === 'ETA_HOURS'
        ? { estimated_hours: prediction.value }
        : type === 'DELAY_RISK_PERCENT'
          ? { delay_probability: prediction.value, risk_level: prediction.value >= 70 ? 'CRITICAL' : prediction.value >= 45 ? 'HIGH' : prediction.value >= 20 ? 'MODERATE' : 'LOW' }
          : type === 'FUEL_ESTIMATE_LITERS'
            ? { fuel_liters: prediction.value }
            : type === 'CO2_KG'
              ? { co2_kg: prediction.value }
              : type === 'RECOMMENDED_TRUCK_SCORE'
                ? { score: prediction.value }
                : { value: prediction.value }),
    fallback: prediction.modelVersion?.includes('fallback') || false,
  }
}

export function normalizeBooking(booking = {}) {
  const shipment = normalizeShipment(booking.shipment || {})
  const truck = normalizeTruck(booking.truck || {})
  const invoice = booking.invoice ? normalizeInvoice(booking.invoice) : null
  const pricing = booking.pricing || invoice?.pricing || {}

  return {
    ...booking,
    shipment,
    truck,
    invoice,
    totalAmount: booking.totalAmount ?? pricing.total ?? null,
    pickupDate: booking.pickupDate || booking.pickedUpAt || null,
    deliveryDate: booking.deliveryDate || booking.deliveredAt || booking.estimatedEta || null,
  }
}

export function normalizeInvoice(invoice = {}) {
  const pricing = invoice.pricing || invoice.breakdown || {}
  return {
    ...invoice,
    invoiceNumber: invoice.invoiceNumber || invoice.invoiceNo || '—',
    amount: invoice.amount ?? pricing.total ?? pricing.subtotal ?? null,
    breakdown: invoice.breakdown || pricing,
    createdAt: invoice.createdAt || invoice.issuedAt || null,
    pricing,
    booking: invoice.booking ? normalizeBooking(invoice.booking) : null,
  }
}

export function normalizeTrackingLog(log = {}) {
  return {
    ...log,
    lat: log.lat ?? log.latitude ?? log.location?.lat ?? null,
    lng: log.lng ?? log.longitude ?? log.location?.lng ?? null,
  }
}

export function normalizeAnalytics(role, payload = {}) {
  const analytics = payload.analytics || payload.data || payload.stats || {}

  if (role === 'ADMIN') {
    const usersByRole = analytics.users?.byRole || {}
    const shipmentsByStatus = analytics.shipments?.byStatus || {}
    const trucksByStatus = analytics.trucks?.byStatus || {}
    const bookingsByStatus = analytics.bookings?.byStatus || {}

    const revenueByMonth = payload.revenueByMonth || []
    const totalRevenue = revenueByMonth.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0)

    return {
      stats: {
        totalUsers: analytics.users?.total || 0,
        totalShipments: analytics.shipments?.total || 0,
        totalTrucks: analytics.trucks?.total || 0,
        totalBookings: analytics.bookings?.total || 0,
        totalRevenue,
        pendingShipments: shipmentsByStatus.PENDING || 0,
        inTransitShipments: shipmentsByStatus.IN_TRANSIT || 0,
        deliveredShipments: shipmentsByStatus.DELIVERED || 0,
        cancelledShipments: shipmentsByStatus.CANCELLED || 0,
        activeTrucks: (analytics.trucks?.total || 0) - (trucksByStatus.MAINTENANCE || 0),
      },
      recentBookings: payload.recentBookings || [],
      usersByRole,
      bookingsByStatus,
      revenueByMonth,
      shipmentTrend: payload.shipmentTrend || [],
      fleetUtilization: payload.fleetUtilization || Object.entries(trucksByStatus).map(([type, count]) => ({ type, count })),
    }
  }

  if (role === 'DEALER') {
    const trucksByStatus = analytics.trucksByStatus || {}
    const bookingsByStatus = analytics.bookingsByStatus || {}
    const revenueByMonth = payload.revenueByMonth || []
    const totalRevenue = revenueByMonth.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0)
    return {
      stats: {
        totalRevenue,
        totalTrucks: analytics.totalTrucks || 0,
        availableTrucks: trucksByStatus.AVAILABLE || 0,
        onTripTrucks: (trucksByStatus.BOOKED || 0) + (trucksByStatus.IN_TRANSIT || 0),
        maintenanceTrucks: trucksByStatus.MAINTENANCE || 0,
        pendingBookings: bookingsByStatus.REQUESTED || 0,
        activeDeliveries: (bookingsByStatus.ASSIGNED || 0) + (bookingsByStatus.PICKED_UP || 0) + (bookingsByStatus.IN_TRANSIT || 0),
        completedDeliveries: bookingsByStatus.DELIVERED || 0,
        fleetUtilization: analytics.fleetUtilizationPct || 0,
      },
      fleetUtilization: Object.entries(trucksByStatus).map(([name, value]) => ({ name, value })),
      bookingsByStatus,
      revenueByMonth,
      deliveriesByMonth: payload.deliveriesByMonth || [],
    }
  }

  const byStatus = analytics.byStatus || {}
  const monthlySpend = payload.monthlySpend || []
  const totalSpend = monthlySpend.reduce((sum, row) => sum + (Number(row?.spend) || 0), 0)
  return {
    stats: {
      totalShipments: analytics.totalShipments || 0,
      pendingShipments: byStatus.PENDING || 0,
      deliveredShipments: byStatus.DELIVERED || 0,
      activeBookings: analytics.deliveredCount || 0,
      totalSpend,
      avgDeliveryDays: analytics.avgEtaHours ? Number((analytics.avgEtaHours / 24).toFixed(1)) : null,
      co2Saved: analytics.totalCo2SavedKg || 0,
    },
    shipmentTrend: payload.shipmentTrend || [],
    monthlySpend,
  }
}
