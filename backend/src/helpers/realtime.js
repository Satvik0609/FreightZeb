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

  io.to(`warehouse:${payload.warehouseId}`).emit('shipment:predictionsUpdated', {
    shipmentId: payload.shipmentId,
    predictions: payload.predictions || [],
    source: payload.source || 'backend',
    trigger: payload.trigger || null,
  });
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
  emitShipmentStatusUpdate,
  emitShipmentPredictionsUpdated,
  emitShipmentOptimized,
};
