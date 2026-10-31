import {assertInventoryWritable} from '../billing/SubscriptionLifecycle';
import crypto from "node:crypto";
import {InventoryMovementRepository} from "../inventory/InventoryMovementRepository";
import {verifyPin} from "../auth/PinSecurityService";
import { MenuRepository } from '../pos/MenuRepository';
import { IngredientRepository } from '../inventory/IngredientRepository';
import { RecipeRepository } from '../inventory/RecipeRepository';
import { StaffRepository } from '../staff/StaffRepository';
import { OrderRepository } from '../pos/OrderRepository';
import { CustomerRepository } from '../crm/CustomerRepository';
import { PurchaseRepository } from '../inventory/PurchaseRepository';
import { ShiftRepository } from '../staff/ShiftRepository';
import { SettingsRepository } from './SettingsRepository';
import { Database,OptimisticLockConflictError } from './database';
import { realtimeService } from './RealtimeService';
import { validateEntity,validateSettings,customerProfile } from './validation';
export class SyncService {
  private db=Database.getInstance();
  constructor(private menuRepo:MenuRepository,private ingredientRepo:IngredientRepository,private recipeRepo:RecipeRepository,private staffRepo:StaffRepository,private orderRepo:OrderRepository,private customerRepo:CustomerRepository,private purchaseRepo:PurchaseRepository,private shiftRepo:ShiftRepository,private settingsRepo:SettingsRepository) {}
  async getFullState(tenantId:string):Promise<any> {
    const values=await Promise.all([this.menuRepo.getAll(tenantId),this.ingredientRepo.getAll(tenantId),this.recipeRepo.getAll(tenantId),this.staffRepo.getAll(tenantId),this.orderRepo.getAll(tenantId),this.customerRepo.getAll(tenantId),this.purchaseRepo.getAll(tenantId),this.shiftRepo.getAll(tenantId),this.settingsRepo.get(tenantId),this.db.getObject<Record<string,any>>(tenantId,'order_service_state')]);
    values[4]=(values[4] as any[] || []).map(order=>({...order,...((values[9] as any)?.[order.id] || {})}));
    return Object.fromEntries(['menuItems','ingredients','recipes','staffList','orders','customers','purchases','shifts','settings'].map((k,i)=>[k,values[i]]));
  }
  /** Sync contains versioned management changes only. Financial mutations are commands. */
  async saveFullState(tenantId:string,payload:any,staffId?:string):Promise<any> {
    if(!payload || typeof payload!=='object') throw Object.assign(new Error('Invalid sync payload.'),{status:400});
    if(['orders','purchases','shifts'].some(k=>payload[k]!==undefined)) throw Object.assign(new Error('Use business command endpoints for orders, purchases and shifts.'),{status:400,code:'BUSINESS_COMMAND_REQUIRED'});
    const repos:any={menuItems:this.menuRepo,ingredients:this.ingredientRepo,recipes:this.recipeRepo,staffList:this.staffRepo,customers:this.customerRepo};
    await this.db.runTransaction(tenantId,async trx=>{
      if(["ingredients","recipes"].some(k=>payload[k]!==undefined || payload.deletions?.[k])) await assertInventoryWritable(tenantId);
      for(const [key,repo] of Object.entries(repos) as any[]) {
        if(payload[key]===undefined && !payload.deletions?.[key]) continue;
        if(payload[key]!==undefined && !Array.isArray(payload[key])) throw Object.assign(new Error('Invalid sync array.'),{status:400});
        const existing=(await repo.getAll(tenantId)) || [],idKey=key==='recipes'?'menuItemId':'id';
        const merged=new Map<string,any>(existing.map((r:any)=>[r[idKey],r]));
        for(const input of payload[key] || []) {
          const previous=merged.get(input[idKey]);
          validateEntity(key,input,!previous);
          const incoming={...previous,...input};
          if(key==='staffList' && (!input.pin || (previous?.pin && await verifyPin(input.pin,previous.pin)))) incoming.pin=previous?.pin;
          if(key==='staffList') incoming.passwordHash=previous?.passwordHash;
          if(key==='customers') Object.assign(incoming,customerProfile(input,previous));
          const comparable=(r:any)=>{const {version,updated_at,updatedAt,tenantId,branchId,deviceId,createdAt,...rest}=r;return JSON.stringify(Object.entries(rest).sort());};
          if(previous && comparable(incoming)===comparable(previous)) continue;
          if(previous && input.version !== (previous.version || 1)) throw new OptimisticLockConflictError(undefined,{entityId:input[idKey],expectedVersion:input.version,currentVersion:previous.version || 1});
          if(key==='ingredients' && previous && input.currentStock!==undefined && input.currentStock!==previous.currentStock) {
            const movementRepo=new InventoryMovementRepository();
            await movementRepo.add(tenantId,{id:crypto.randomUUID(),ingredientId:input.id,movementType:"MANUAL_ADJUSTMENT",quantityDelta:input.currentStock-previous.currentStock,previousStock:previous.currentStock,newStock:input.currentStock,reason:"Manual inventory adjustment",performedBy:staffId},trx);
          }
          if(key==='recipes') {
            const menu=await this.menuRepo.getById(tenantId,input.menuItemId),ingredients=(await this.ingredientRepo.getAll(tenantId)) || [];
            if(!menu || input.ingredients.some((i:any)=>!ingredients.some(ing=>ing.id===i.ingredientId))) throw Object.assign(new Error('Recipe references a missing or foreign item.'),{status:400,code:'INVALID_RECIPE'});
          }
          merged.set(input[idKey],{...incoming,version:previous?(previous.version || 1)+1:1,updated_at:new Date().toISOString()});
        }
        for(const deletion of payload.deletions?.[key] || []) {
          const previous=merged.get(deletion.id);if(!previous) continue;
          if(deletion.version !== (previous.version || 1)) throw new OptimisticLockConflictError(undefined,{entityId:deletion.id,expectedVersion:deletion.version,currentVersion:previous.version || 1});
          if(key==='staffList' && previous.role==='Owner') throw Object.assign(new Error('The owner account cannot be deleted.'),{status:400});
          if(key==='staffList') {merged.set(deletion.id,{...previous,status:'inactive',version:(previous.version || 1)+1,updated_at:new Date().toISOString()});continue;}
          if(key==='ingredients') await this.recipeRepo.unlinkIngredient(tenantId,deletion.id);
          if(key==='menuItems') {const recipes=(await this.recipeRepo.getAll(tenantId)) || [];await this.recipeRepo.saveAll(tenantId,recipes.filter(r=>r.menuItemId!==deletion.id),trx);}
          merged.delete(deletion.id);
        }
        if(key==='staffList' && existing.some((r:any)=>r.role==='Owner') && ![...merged.values()].some(r=>r.role==='Owner' && !['inactive','suspended'].includes(r.status))) throw Object.assign(new Error('Keep an active owner account.'),{status:400});
        if(key==='staffList') await this.staffRepo.assertActiveCapacity(tenantId,[...merged.values()]);
        await repo.saveAll(tenantId,[...merged.values()],trx);
      }
      if(payload.settings!==undefined) {validateSettings(payload.settings);const existing:any=(await this.settingsRepo.get(tenantId)) || {};if(existing.version && payload.settings.version !== existing.version) throw new OptimisticLockConflictError(undefined,{entityId:"settings",expectedVersion:payload.settings.version,currentVersion:existing.version});await this.settingsRepo.save(tenantId,{...existing,...payload.settings},trx);}
    });
    realtimeService.broadcastSyncUpdate(tenantId,'all');return this.getFullState(tenantId);
  }
}
