import { BaseRepository } from "../shared/BaseRepository";
import { Ingredient } from "../../../src/features/shared/types";

export class IngredientRepository extends BaseRepository<Ingredient> {
  protected sliceKey = "ingredients";
}

