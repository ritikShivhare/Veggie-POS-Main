import type {RequestHandler} from 'express';
import {createClient} from '@supabase/supabase-js';
import type {UserSession} from './SessionService';

export interface SuperAdminIdentity {
  subject: string;
  assurance: 'aal2';
  expiresAt: number;
}

export function isTrustedSuperAdminSession(session: UserSession | null | undefined): boolean {
  const approved = process.env.SUPER_ADMIN_USER_ID?.trim();
  const identity = session?.superAdminIdentity;
  return Boolean(approved && session?.tenantId === 'saas-admin' && session.role === 'SaaS Owner'
    && session.userId === `supabase:${approved}` && identity?.subject === approved
    && identity.assurance === 'aal2' && Number.isFinite(identity.expiresAt) && identity.expiresAt > Date.now());
}

/** Only a provider-verified token can mint evidence for a backend admin session.
 * Sessions cannot outlive that token, even when normal idle expiry is refreshed. */
export async function verifySupabaseSuperAdmin(token: string) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const approved = process.env.SUPER_ADMIN_USER_ID?.trim();
  if (!url || !key || !approved) throw new Error('ADMIN_AUTH_NOT_CONFIGURED');
  const client = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data, error} = await client.auth.getUser(token);
  const user = data?.user;
  if (error || !user || user.id !== approved || user.app_metadata?.role !== 'SUPER_ADMIN') return null;
  const {data:verified, error:claimError} = await client.auth.getClaims(token);
  const claims = verified?.claims;
  if (claimError || claims?.sub !== user.id || claims?.aal !== 'aal2'
    || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null;
  return {user, identity:{subject:user.id,assurance:'aal2',expiresAt:claims.exp*1000} as SuperAdminIdentity};
}

export function createRequireSuperAdmin(service: {validateAndTouchSession:(tenantId:string,id:string)=>Promise<UserSession|null>}): RequestHandler {
  return async (req,res,next) => {
    const header = req.headers['x-session-id'];
    const bearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim() : undefined;
    const id = typeof header === 'string' ? header : bearer;
    if (!id) {res.status(401).json({success:false,error:'ADMIN_SESSION_REQUIRED'}); return;}
    const cookie = req.cookies?.veggiepos_session;
    if (cookie && cookie !== id) {res.status(401).json({success:false,error:'SESSION_MISMATCH'}); return;}
    try {
      const session = await service.validateAndTouchSession('saas-admin',id);
      if (!isTrustedSuperAdminSession(session)) {res.status(403).json({success:false,error:'ADMIN_FORBIDDEN'}); return;}
      (req as any).session=session;
      (req as any).tenantId='saas-admin';
      (req as any).user={id:session!.userId,name:session!.userName,role:session!.role,permissions:['super_admin']};
      next();
    } catch {res.status(503).json({success:false,error:'ADMIN_SESSION_UNAVAILABLE'});}
  };
}
