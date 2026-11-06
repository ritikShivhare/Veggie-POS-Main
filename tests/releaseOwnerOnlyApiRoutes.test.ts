import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {requireRole} from "../server/context";
import type {Request,Response,NextFunction} from "express";

const root=new URL("../",import.meta.url);
const routes=[
  {file:"routes/shared.routes.ts",method:"get",path:"/events"},
  {file:"routes/shared.routes.ts",method:"get",path:"/privacy/export"},
  {file:"routes/shared.routes.ts",method:"post",path:"/settings"},
  {file:"routes/pos.routes.ts",method:"post",path:"/staff"},
  {file:"routes/pos.routes.ts",method:"post",path:"/staff/bulk"},
  {file:"routes/pos.routes.ts",method:"put",path:"/staff/:id"},
  {file:"routes/pos.routes.ts",method:"delete",path:"/staff/:id"},
] as const;
function check(role:string|undefined) {
  const req={session:role?{role}:undefined} as unknown as Request;
  let code=200,body:any;let allowed=false;
  const res={status:(n:number)=>{code=n;return res;},json:(data:any)=>{body=data;return res;}} as unknown as Response;
  const next:NextFunction=()=>{allowed=true;};
  requireRole("Owner")(req,res,next);
  return {code,body,allowed};
}
describe("Non-mutating RBAC regression — Preview release gate",()=>{
  for (const route of routes) {
    it(`${route.method.toUpperCase()} /api${route.path} is Owner-only before reaching business handlers`,()=>{
      const source=readFileSync(fileURLToPath(new URL(route.file,root)),"utf8");
      const escaped=route.path.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,"\\$&");
      const expr=new RegExp(`router\\.${route.method}\\("${escaped}",\\s*authMiddleware,\\s*requireRole\\("Owner"\\)`);
      expect(source).toMatch(expr);
    });
  }
  for (const role of ["Manager","Cashier","Waiter","Chef","Cook","Staff"]) {
    it(`rejects ${role} with 403 before accessing any database`,()=>{
      const result=check(role);
      expect(result).toMatchObject({code:403,allowed:false});
      expect(result.body?.error).toBe("FORBIDDEN");
    });
  }
  it("rejects unauthenticated requests with 401",()=>{
    expect(check(undefined)).toMatchObject({code:401,allowed:false});
  });
  it("allows Owner",()=>{
    expect(check("Owner").allowed).toBe(true);
  });
});
