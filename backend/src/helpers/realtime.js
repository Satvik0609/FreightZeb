function emitShipmentCreated(io, payload) {
  if (!io || !payload?.shipmentId || !payload?.warehouseId) return;

  io.to(`warehouse:${payload.warehouseId}`).emit('shipment:created', {
    shipmentId: payload.shipmentId,
    shipment: payload.shipment || null,
    source: payload.source || 'backend',
  });
}

function emitShipmentStatusUpdate(io, payload) {
  if (!io || !payload?.shipmentId || !payload?.warehouseId || !payload?.status) return;

  const event = {
    shipmentId: payload.shipmentId,
    status: payload.status,
    bookingId: payload.bookingId || null,
    previousStatus: payload.previousStatus || null,
    source: payload.source || 'backend',
  };

  io.to(`warehouse:${payload.warehouseId}`).emit('shipment:statusUpdate', event);

  if (payload.bookingId) {
    io.to(`booking:${payload.bookingId}`).emit('shipment:statusUpdate', event);
  }
}

function emitShipmentPredictionsUpdated(io, payload) {
  if (!io || !payload?.shipmentId || !payload?.warehouseId) return;

  const event = {
    shipmentId: payload.shipmentId,
    predictions: payload.predictions || [],
    source: payload.source || 'backend',
    trigger: payload.trigger || null,
  };

  // Notify warehouse owner
  io.to(`warehouse:${payload.warehouseId}`).emit('shipment:predictionsUpdated', event);
  // Also broadcast to anyone watching this shipment (dealers, admins)
  io.to(`shipment:${payload.shipmentId}`).emit('shipment:predictionsUpdated', event);
}

function emitShipmentOptimized(io, payload) {
  if (!io || !payload?.shipmentId || !payload?.warehouseId) return;

  io.to(`warehouse:${payload.warehouseId}`).emit('shipment:optimized', {
    shipmentId: payload.shipmentId,
    predictions: payload.predictions || [],
    results: payload.results || [],
  });
}

module.exports = {
  emitShipmentCreated,
  emitShipmentStatusUpdate,
  emitShipmentPredictionsUpdated,
  emitShipmentOptimized,
};
