/**
 * SHIPMENT SERVICE
 * Background processing after a shipment is created.
 * NOTE: In the current architecture, shipments go through the
 * optimization engine manually (warehouse triggers POST /:id/optimize).
 * This service is kept for any future auto-assignment flows.
 */

const { prisma } = require('../config/db');
const logger = require('../config/logger');

class ShipmentService {
  /**
   * Called after shipment creation to do any async setup.
   * Currently a no-op placeholder — optimization is triggered manually.
   */
  async onShipmentCreated(shipmentId) {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { warehouse: { select: { id: true, name: true } } },
      });
      if (!shipment) return;

      logger.info(`Shipment ${shipmentId} ready for optimization by ${shipment.warehouse.name}`);
    } catch (err) {
      logger.error(`ShipmentService.onShipmentCreated failed for ${shipmentId}: ${err.message}`);
    }
  }
}

module.exports = new ShipmentService();
