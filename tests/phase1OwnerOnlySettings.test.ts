import {describe,it,expect} from "vitest";
import {requireRole} from "../server/context";
import type {Request,Response,NextFunction} from "express";

function check(role:string) {
  const request={session:{role}} as unknown as Request;
  let status=200;let result:any=null;let called=false;
  const response={
    status:(value:number)=>{status=value;return response;},
    json:(value:any)=>{result=value;return response;}
  } as unknown as Response;
  const next:NextFunction=()=>{called=true;};
  requireRole("Owner")(request,response,next);
  return {status,result,called};
}
describe("Phase 1: Owner-only administration RBAC",()=>{
  for(const role of ["Manager","Waiter","Chef","Cook","Cashier","Staff"]) {
    it(`rejects ${role} even when UI is bypassed`,()=>{
      const r=check(role);expect(r.called).toBe(false);
      expect(r.status).toBe(403);expect(r.result.error).toBe("FORBIDDEN");
    });
  }
  it("allows the restaurant Owner",()=>{expect(check("Owner").called).toBe(true);});
});
