import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { NotFoundError } from '../errors/domain-errors';
import { Shipment, ShipmentTrackingEvent } from '../models/domain-models.types';
import { ShipmentStatus } from '../enums/entity.enums';
import { ShipmentRepository } from '../repositories/shipment.repository';
import { ShipmentTrackingEventRepository } from '../repositories/shipment-tracking-event.repository';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens } from '../providers/container.provider';

export interface ShipmentService {
  createShipmentPlaceholder(orderId: string, courierName?: string): Promise<Result<Shipment, AppError>>;
  getShipmentByOrderId(orderId: string): Promise<Result<Shipment, AppError>>;
  getTrackingTimeline(shipmentId: string): Promise<Result<{ shipment: Shipment; events: ShipmentTrackingEvent[] }, AppError>>;
  updateShipmentStatus(shipmentId: string, status: ShipmentStatus, location?: string, description?: string): Promise<Result<Shipment, AppError>>;
}

export class ShipmentServiceImpl implements ShipmentService {
  private shipmentRepo: ShipmentRepository;
  private eventRepo: ShipmentTrackingEventRepository;

  constructor(shipmentRepo?: ShipmentRepository, eventRepo?: ShipmentTrackingEventRepository) {
    this.shipmentRepo = shipmentRepo || container.resolve<ShipmentRepository>(RepositoryTokens.ShipmentRepository);
    this.eventRepo = eventRepo || container.resolve<ShipmentTrackingEventRepository>(RepositoryTokens.ShipmentTrackingEventRepository);
  }

    public async createShipmentPlaceholder(orderId: string, courierName?: string): Promise<Result<Shipment, AppError>> {
    logger.info(`[ShipmentService.createShipmentPlaceholder] Creating shipment placeholder for order ${orderId}`);
    return this.shipmentRepo.create({
      order_id: orderId,
      provider: 'dtdc',
      courier_name: courierName || 'DTDC',
      status: 'created' as ShipmentStatus,
      raw_response: {},
    } as Partial<Shipment>);
  }

  public async getShipmentByOrderId(orderId: string): Promise<Result<Shipment, AppError>> {
    const res = await this.shipmentRepo.findByOrderId(orderId);
    if (!res.success) return res;
    if (!res.value) {
      return failure(new NotFoundError(`No shipment record found for order ${orderId}`));
    }
    return success(res.value);
  }

  public async getTrackingTimeline(shipmentId: string): Promise<Result<{ shipment: Shipment; events: ShipmentTrackingEvent[] }, AppError>> {
    const shipmentRes = await this.shipmentRepo.findById(shipmentId);
    if (!shipmentRes.success) return failure(shipmentRes.error);
    if (!shipmentRes.value) {
      return failure(new NotFoundError(`Shipment ID ${shipmentId} not found`));
    }

    const eventsRes = await this.eventRepo.findByShipmentId(shipmentId);
    if (!eventsRes.success) return failure(eventsRes.error);

    return success({
      shipment: shipmentRes.value,
      events: eventsRes.value,
    });
  }

  public async updateShipmentStatus(
    shipmentId: string,
    status: ShipmentStatus,
    location?: string,
    description?: string
  ): Promise<Result<Shipment, AppError>> {
    logger.info(`[ShipmentService.updateShipmentStatus] Updating shipment ${shipmentId} status to ${status}`);
    const shipmentRes = await this.shipmentRepo.findById(shipmentId);
    if (!shipmentRes.success) return shipmentRes;
    if (!shipmentRes.value) {
      return failure(new NotFoundError(`Shipment ID ${shipmentId} not found`));
    }

    // The deployed shipments table stores status and provider metadata only;
    // shipped_at/delivered_at are not part of that live schema.
    const updateData: Partial<Shipment> = { status };

    const updateRes = await this.shipmentRepo.update(shipmentId, updateData);
    if (!updateRes.success) return updateRes;

    await this.eventRepo.create({
      order_id: updateRes.value.order_id,
      status,
    });

    return success(updateRes.value);
  }
}
