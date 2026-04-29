const logger = require('../config/logger');
const dealerMlAutomationService = require('../services/dealerMlAutomationService');
let Queue = null;
let Worker = null;
try {
  ({ Queue, Worker } = require('bullmq'));
} catch (_err) {
  logger.warn('BullMQ not installed; ML queue will fall back to inline execution.');
}

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const queueName = 'dealer-ml-jobs';
const mlQueue = Queue ? new Queue(queueName, { connection }) : null;

function queueMlPredictionJob(payload = {}) {
  if (!mlQueue) return Promise.reject(new Error('ML queue unavailable'));
  return mlQueue.add('generate-shipment-predictions', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 200,
    jobId: `pred:${payload.shipmentId}:${payload.truckId}`,
  });
}

function queueNewTruckAutomation(payload = {}) {
  if (!mlQueue) return Promise.reject(new Error('ML queue unavailable'));
  return mlQueue.add('new-truck-automation', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 200,
    jobId: `truck:${payload.truckId}`,
  });
}

function startMlWorker(io) {
  if (process.env.ML_QUEUE_DISABLED === 'true') return null;
  if (!Worker || !mlQueue) return null;
  const worker = new Worker(queueName, async (job) => {
    if (job.name === 'generate-shipment-predictions') {
      await dealerMlAutomationService.generateShipmentTruckPredictions(
        job.data.shipmentId,
        job.data.truckId,
        job.data.requestId,
        io,
      );
      return { success: true };
    }
    if (job.name === 'new-truck-automation') {
      await dealerMlAutomationService.generateForNewTruck(
        job.data.truckId,
        job.data.dealerId,
        job.data.requestId,
      );
      return { success: true };
    }
    return { success: false, ignored: true };
  }, { connection });

  worker.on('failed', (job, err) => {
    logger.error('ML queue job failed', { jobId: job?.id, name: job?.name, error: err.message });
  });
  return worker;
}

module.exports = {
  queueMlPredictionJob,
  queueNewTruckAutomation,
  startMlWorker,
};
