const { prisma } = require('../config/db');


class ShipmentService {
  async processNewShipment(shipmentId) {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { customer: true },
      });

      if (!shipment) return;


      const recommendedType = shipment.weightKg > 15000 ? 'CONTAINER_32FT' : 'CONTAINER_20FT';

      const truck = await prisma.truck.findFirst({
        where: {
          status: 'AVAILABLE',
          type: recommendedType,
        },
      });

      if (!truck) {
        console.warn(`No available ${recommendedType} truck for shipment ${shipmentId}`);
        return;
      }

      const fakeRoute = {
        distanceKm: 420,
        durationMin: 480,
        polyline: 'fake_encoded_polyline_here',
      };

      await prisma.$transaction(async (tx) => {
        const route = await tx.route.create({
          data: {
            shipmentId,
            truckId: truck.id,
            distanceKm: fakeRoute.distanceKm,
            durationMin: fakeRoute.durationMin,
            polyline: fakeRoute.polyline,
          },
        });

        await tx.delivery.create({
          data: {
            shipmentId,
            routeId: route.id,
            truckId: truck.id,
            status: 'ASSIGNED',

          },
        });

        await tx.truck.update({
          where: { id: truck.id },
          data: { status: 'ASSIGNED' },
        });

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: 'ASSIGNED' },
        });
      });

      console.log(`Shipment ${shipmentId} assigned to truck ${truck.registrationNo}`);
    } catch (err) {
      console.error('Shipment processing failed:', err);
    }
  }
}

module.exports = new ShipmentService();