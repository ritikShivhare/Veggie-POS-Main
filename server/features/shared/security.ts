import crypto from 'node:crypto';

export function publicStaff(member: any) {
  if (!member) return member;
  const { pin, passwordHash, password, ...safe } = member;
  return safe;
}

export function publicTenant(tenant: any) {
  if (!tenant) return tenant;
  const { ownerPin, initialPassword, passwordHash, staffQrSecret, ...safe } = tenant;
  return safe;
}

export function publicSettings(settings: any) {
  if (!settings) return settings;
  const { managerPin, pin, password, passwordHash, slackWebhookUrl, sentryDsn, emailAlertAddress, ...safe } = settings;
  return safe;
}

export function publicState(state: any, role: string, permissions:string[] = [], userId?:string) {
  if (!state) return state;
  const result = { ...state, staffList: (state.staffList || []).filter((s:any)=>s.status!=='inactive').map(publicStaff),
    orders: (state.orders || []).map(({ managerPin, ...order }: any) => order) };
  if (result.settings) result.settings = publicSettings(result.settings);
  if (!['Owner', 'Manager', 'SaaS Owner'].includes(role)) {
    const day=(value:any)=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    const today=day(Date.now());
    result.orders = result.orders.filter((o: any) => o.date && day(o.date) === today);
    result.purchases = permissions.includes('inventory') ? result.purchases : [];
    result.customers = permissions.includes('billing') ? result.customers : [];
    result.shifts = (result.shifts || []).filter((s:any)=>s.staffId===userId);
    result.staffList=result.staffList.map(({phone,...s}:any)=>s);
    if(!permissions.includes('inventory')) result.ingredients=(result.ingredients || []).map(({costPerUnit,...i}:any)=>({...i,costPerUnit:0}));
  }
  return result;
}

export function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function validPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4,6}$/.test(value);
}

// bcrypt accepts only 72 UTF-8 bytes; reject inputs it would silently truncate.
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
