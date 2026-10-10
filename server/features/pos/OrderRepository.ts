import { BaseRepository, DatabaseTransaction } from "../shared/BaseRepository";
import { Order } from "../../../src/features/shared/types";

export class OrderDeletionProhibitedError extends Error {
  public code = "ORDER_DELETION_PROHIBITED";
  public status = 405;
  public statusCode = 405;

  constructor(message: string = "Direct hard-deletion of order records is prohibited to preserve fiscal audit trails and prevent inventory drift. Orders must be voided or cancelled via FinancialTransactionService.") {
    super(message);
    this.name = "OrderDeletionProhibitedError";
  }
}

export class OrderRepository extends BaseRepository<Order> {
  protected sliceKey = "orders";

  /**
   * Guard against accidental hard-deletion:
   * Orders represent legal tax invoices and inventory deductions.
   * Direct deletion breaks double-entry reconciliation and leaves inventory leaked.
   */
  async delete(tenantId: string, id: string, trx?: DatabaseTransaction): Promise<void> {
    throw new OrderDeletionProhibitedError(
      `Permanent hard-deletion of order '${id}' for tenant '${tenantId}' is prohibited. Please cancel or void the order using FinancialTransactionService.executeOrderCancellation.`
    );
  }

  /**
   * System-internal purge method strictly for tenant account teardown or database testing.
   */
  async purge(tenantId: string, id: string, trx?: DatabaseTransaction): Promise<void> {
    return super.delete(tenantId, id, trx);
  }
}

