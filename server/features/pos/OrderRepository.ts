import { BaseRepository } from "../shared/BaseRepository";
import { Order } from "../../../src/features/shared/types";

export class OrderRepository extends BaseRepository<Order> {
  protected sliceKey = "orders";
}

