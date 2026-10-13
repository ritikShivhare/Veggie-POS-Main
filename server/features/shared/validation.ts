import { validPin } from './security';
const fail=(message:string):never=>{throw Object.assign(new Error(message),{status:400,code:'INVALID_DATA'});};
export function finiteAmount(value:any,name:string,min=0,max=1e9):number {
  if(typeof value!=='number' || !Number.isFinite(value) || value<min || value>max) fail(`${name} must be a finite number between ${min} and ${max}.`);
  return value;
}
export function validateEntity(type:string,item:any,creating=false):void {
  if(!item || typeof item!=='object' || Array.isArray(item)) fail('Invalid record.');
  const id=type==='recipes'?item.menuItemId:item.id;
  if(typeof id!=='string' || !id.trim() || id.length>180) fail('Valid record identifier required.');
  if(item.version!==undefined && (!Number.isInteger(item.version) || item.version<1)) fail('Invalid version.');
  for(const field of ['name','nameHindi','supplier','invoiceNumber','phone','email']) if(item[field]!==undefined && (typeof item[field]!=='string' || item[field].length>240)) fail(`Invalid ${field}.`);
  const numeric:Record<string,string[]>={menuItems:['price'],ingredients:['currentStock','minStock','costPerUnit'],purchases:['quantity','cost']};
  for(const field of numeric[type] || []) if(item[field]!==undefined) finiteAmount(item[field],field,field==='quantity'?0.000001:0);
  if(type==='staffList') {
    if(!['Owner','Manager','Cashier','Waiter','Chef','Staff'].includes(item.role)) fail('Invalid staff role.');
    if(creating && !validPin(item.pin)) fail('A 4–6 digit PIN is required.');
    if(item.pin!==undefined && item.pin!=='' && !validPin(item.pin)) fail('PIN must contain 4–6 digits.');
    if(!Array.isArray(item.permissions) || item.permissions.some((p:any)=>typeof p!=='string')) fail('Invalid permissions.');
    if(item.passwordHash!==undefined || item.password!==undefined) fail('Password changes require the owner password endpoint.');
  }
  if(type==='recipes') {
    if(!Array.isArray(item.ingredients) || item.ingredients.length>200) fail('Invalid recipe ingredients.');
    for(const i of item.ingredients) {if(typeof i.ingredientId!=='string') fail('Invalid ingredient reference.'); finiteAmount(i.quantity,'Recipe quantity',0.000001);}
  }
}
export function validateSettings(settings:any):void {
  if(!settings || typeof settings!=='object' || Array.isArray(settings)) fail('Invalid settings.');
  if(['managerPin','pin','password','passwordHash'].some(k=>Object.hasOwn(settings,k))) fail('Credentials must use the authenticated credential endpoint.');
  for(const key of ['autoDeductStock','blockOrdersIfInsufficient','managerCanAddPurchases','managerCanEditRecipes','kdsSoundAlerts','quickPinRequired']) if(settings[key]!==undefined && typeof settings[key]!=='boolean') fail(`Invalid ${key}.`);
  if(settings.gstPercentage!==undefined) finiteAmount(settings.gstPercentage,'GST',0,30);
  if(settings.maxDiscountPercentage!==undefined) finiteAmount(settings.maxDiscountPercentage,'Maximum discount',0,100);
  if(settings.slackWebhookUrl || settings.sentryDsn || settings.emailAlertAddress) fail('Global integrations must be configured by the SaaS administrator on the server.');
  if(settings.upiVpa && (typeof settings.upiVpa!=='string' || !/^[\w.\-]+@[\w.\-]+$/.test(settings.upiVpa))) fail('Invalid UPI address.');
}
export function customerProfile(input:any,existing?:any):any {
  const result={...existing};
  for(const k of ['id','name','phone','email','dob','anniversary','gstin']) if(input[k]!==undefined) result[k]=input[k];
  if(!existing) Object.assign(result,{loyaltyPoints:0,totalSpend:0,totalVisits:0,maxBillAmount:0,minBillAmount:0,comingSince:new Date().toISOString(),lastVisited:''});
  validateEntity('customers',result);
  if(!result.name || !/^[+\d ()\-]{7,20}$/.test(result.phone || '')) fail('Customer name and valid phone are required.');
  return result;
}
