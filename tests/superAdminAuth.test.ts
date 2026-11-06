import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import http from 'node:http';

const identity = vi.hoisted(() => ({getUser: vi.fn(), getClaims: vi.fn()}));
vi.mock('@supabase/supabase-js', () => ({createClient: () => ({auth: identity})}));
import {app} from '../server';
import {sessionService} from '../server/context';

let server: http.Server, base: string;
const uid = '11111111-1111-4111-8111-111111111111';
async function exchange(token = 'signed-provider-token') {
  return fetch(base + '/api/saas-admin/exchange', {method:'POST', headers:{authorization:`Bearer ${token}`}});
}
describe('Supabase super-admin exchange and authorization', () => {
  beforeAll(async () => {
    server=http.createServer(app);
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    base=`http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r()));});
  beforeEach(() => {
    vi.stubEnv('SUPER_ADMIN_USER_ID',uid);
    vi.stubEnv('SUPABASE_URL','https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-test-key');
    identity.getUser.mockReset().mockResolvedValue({data:{user:{id:uid,app_metadata:{role:'SUPER_ADMIN'}}},error:null});
    identity.getClaims.mockReset().mockResolvedValue({data:{claims:{sub:uid,aal:'aal2',exp:Math.floor(Date.now()/1000)+600}},error:null});
  });
  it('exchanges a verified allowlisted MFA identity for a working server session',async()=>{
    const r=await exchange(); expect(r.status).toBe(200);
    const body=await r.json();
    expect(body.user.id).toBe(`supabase:${uid}`);
    expect(body.user.permissions).toEqual(['super_admin']);
    expect(r.headers.get('set-cookie')).toContain('HttpOnly');
    const admin=await fetch(base+'/api/admin/tenants',{headers:{'x-session-id':body.session.sessionId}});
    expect(admin.status).toBe(200);
  });
  it.each(['aal1',null])('rejects assurance %s',async aal=>{
    identity.getClaims.mockResolvedValue({data:{claims:{sub:uid,aal,exp:Math.floor(Date.now()/1000)+600}},error:null});
    expect((await exchange()).status).toBe(403);
  });
  it('rejects a different UID even when its role is SUPER_ADMIN',async()=>{
    identity.getUser.mockResolvedValue({data:{user:{id:'another-user',app_metadata:{role:'SUPER_ADMIN'}}},error:null});
    expect((await exchange()).status).toBe(403);
  });
  it('ignores user-editable role metadata',async()=>{
    identity.getUser.mockResolvedValue({data:{user:{id:uid,user_metadata:{role:'SUPER_ADMIN'},app_metadata:{role:'Owner'}}},error:null});
    expect((await exchange()).status).toBe(403);
  });
  it.each([{sub:'another-user',aal:'aal2',exp:9999999999},{sub:uid,aal:'aal2',exp:1}])('rejects invalid signed claims',async claims=>{
    identity.getClaims.mockResolvedValue({data:{claims},error:null});
    expect((await exchange()).status).toBe(403);
  });
  it('rejects an invalid provider token',async()=>{
    identity.getUser.mockResolvedValue({data:{user:null},error:{message:'invalid token'}});
    expect((await exchange()).status).toBe(403);
  });
  it('fails closed when the configured UID is missing',async()=>{
    vi.stubEnv('SUPER_ADMIN_USER_ID',''); expect((await exchange()).status).toBe(503);
  });
  it('does not expose provider error details',async()=>{
    identity.getUser.mockRejectedValue(new Error('secret provider internals'));
    const r=await exchange(); expect(r.status).toBe(503); expect(await r.text()).not.toContain('secret provider internals');
  });
  it('rejects legacy SaaS Owner sessions without verified identity evidence',async()=>{
    const old=await sessionService.createSession('saas-admin','s-saas-owner','Owner','SaaS Owner','','');
    expect((await fetch(base+'/api/admin/tenants',{headers:{'x-session-id':old.sessionId}})).status).toBe(403);
  });
  it('requires matching header and cookie sessions',async()=>{
    const body=await (await exchange()).json();
    const r=await fetch(base+'/api/admin/tenants',{headers:{'x-session-id':body.session.sessionId,cookie:'veggiepos_session=different'}});
    expect(r.status).toBe(401);
  });
  it.each(['login','google-login','resend-otp'])('disables the legacy %s admin entry point',async path=>{
    const r=await fetch(base+'/api/saas-admin/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    expect(r.status).toBe(410);
  });
});
