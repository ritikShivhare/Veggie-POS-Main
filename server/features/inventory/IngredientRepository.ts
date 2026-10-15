import { BaseRepository,DatabaseTransaction } from "../shared/BaseRepository";
import { Ingredient } from "../../../src/features/shared/types";
import {operationalAlerts} from '../notifications/OperationalAlerts';
export class IngredientRepository extends BaseRepository<Ingredient> {
 protected sliceKey = "ingredients";
 async saveAll(tenant:string,items:Ingredient[],trx?:DatabaseTransaction):Promise<void>{
  if(!trx)return this.db.runTransaction(tenant,tx=>this.saveAll(tenant,items,tx));
  await super.saveAll(tenant,items,trx);await operationalAlerts.stock(tenant,items);
 }
 async update(tenant:string,item:Ingredient,expectedVersion?:number,trx?:DatabaseTransaction):Promise<Ingredient>{
  if(!trx)return this.db.runTransaction(tenant,tx=>this.update(tenant,item,expectedVersion,tx));
  const updated=await super.update(tenant,item,expectedVersion,trx);
  await operationalAlerts.stock(tenant,[updated]);return updated;
 }
}
