import { BaseRepository } from "../shared/BaseRepository";
import { OrderItem } from "../../../src/features/shared/types";

export class OrderItemRepository extends BaseRepository<OrderItem> {
  protected sliceKey = "order_items";
}
