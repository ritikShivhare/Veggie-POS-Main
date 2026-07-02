import { BaseRepository } from "../shared/BaseRepository";
import { MenuItem } from "../../../src/features/shared/types";

export class MenuRepository extends BaseRepository<MenuItem> {
  protected sliceKey = "menuItems";
}

