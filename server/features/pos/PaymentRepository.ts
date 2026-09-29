import { BaseRepository } from "../shared/BaseRepository";
import { Payment } from "../../../src/features/shared/types";

export class PaymentRepository extends BaseRepository<Payment> {
  protected sliceKey = "payments";
}
