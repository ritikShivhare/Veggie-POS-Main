import {afterEach,expect,it,vi} from 'vitest';
import {ApiClient} from '../src/features/shared/services/api';
afterEach(()=>{vi.unstubAllGlobals();ApiClient.setSessionId(null);});
const reply=()=>new Response(JSON.stringify({success:true,initialized:true,data:{}}),{headers:{'content-type':'application/json'}});
function deferred(){let resolve!:(response:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
it('coalesces simultaneous polling and realtime reads until the body finishes, then permits another read',async()=>{
 const pending=deferred();const fetch=vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(reply());vi.stubGlobal('fetch',fetch);ApiClient.setSessionId('session-a');
 const first=ApiClient.getTenantSync('tenant-a');const second=ApiClient.getTenantSync('tenant-a');expect(second).toBe(first);expect(fetch).toHaveBeenCalledTimes(1);
 expect(new Headers(fetch.mock.calls[0][1].headers).get('x-session-id')).toBe('session-a');pending.resolve(reply());expect((await first).success).toBe(true);
 await ApiClient.getTenantSync('tenant-a');expect(fetch).toHaveBeenCalledTimes(2);
});
it('never shares in-flight results between tenants or sessions',async()=>{
 const pending=[deferred(),deferred(),deferred()];const fetch=vi.fn();pending.forEach(p=>fetch.mockReturnValueOnce(p.promise));vi.stubGlobal('fetch',fetch);
 const a=ApiClient.getTenantSync('tenant-a','session-a'),b=ApiClient.getTenantSync('tenant-b','session-a'),c=ApiClient.getTenantSync('tenant-a','session-b');
 expect(fetch).toHaveBeenCalledTimes(3);pending.forEach(p=>p.resolve(reply()));await Promise.all([a,b,c]);
});
it('releases a failed read and retries without extending the 30-second deadline',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new DOMException('signal timed out','TimeoutError')).mockResolvedValueOnce(reply());vi.stubGlobal('fetch',fetch);const warn=vi.spyOn(console,'error').mockImplementation(()=>{});
 expect((await ApiClient.getTenantSync('tenant-a','session-a')).success).toBe(false);expect((await ApiClient.getTenantSync('tenant-a','session-a')).success).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);warn.mockRestore();
});
