import { BaseRepository } from "../shared/BaseRepository";
import { Customer } from "../../../src/features/shared/types";

export class CustomerRepository extends BaseRepository<Customer> {
  protected sliceKey = "customers";
}

