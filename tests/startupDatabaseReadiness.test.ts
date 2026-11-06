import {describe,it,expect,vi} from 'vitest';
import {checkDatabaseSchema} from '../server-startup-validation';
const client=(result:any)=>({rpc:vi.fn().mockResolvedValue(result)});
describe('startup database readiness diagnostics',()=>{
 it('accepts the required schema',async()=>{await expect(checkDatabaseSchema(client({data:9,error:null}))).resolves.toBeUndefined();});
 it('reports pool exhaustion accurately without suggesting migration replay',async()=>{
  await expect(checkDatabaseSchema(client({error:{code:'PGRST003',message:'private transport details'}}))).rejects.toThrow('connection pool timed out (PGRST003)');
 });
 it('distinguishes a missing RPC from a network failure',async()=>{
  await expect(checkDatabaseSchema(client({error:{code:'PGRST202'}}))).rejects.toThrow('Schema-version function is unavailable');
  await expect(checkDatabaseSchema({rpc:vi.fn().mockRejectedValue(new Error('private network details'))})).rejects.toThrow('Database API unavailable');
 });
 it.each([8,null,'invalid',NaN])('blocks invalid or older schema %s',async data=>{
  await expect(checkDatabaseSchema(client({data,error:null}))).rejects.toThrow('schema version 9 is required');
 });
 it('does not expose private provider messages or bypass authentication errors',async()=>{
  await expect(checkDatabaseSchema(client({error:{code:'42501',message:'private credential data'}}))).rejects.toThrow('Verify server credentials, permissions and provider availability');
 });
});
