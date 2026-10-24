import {PGlite} from '@electric-sql/pglite';
const ident=(s:string)=>'"'+s.replace(/"/g,'""')+'"';
/** Exercises the real repository code against PostgreSQL, without network or a service key. */
export function postgresAdapter(pg:PGlite):any {
  return {
    rpc:async(name:string,args:any)=>{
      try {
        const params:any[]=[],placeholders:string[]=[];
        const types:any={p_tenant_id:'text',p_expected_revision:'bigint',p_changes:'jsonb',p_objects:'jsonb',p_token:'text',p_code_hash:'text',p_owner_id:'text'};
        for(const [key,value] of Object.entries(args)){params.push(typeof value==='object'?JSON.stringify(value):value);placeholders.push(`${key}=>$${params.length}::${types[key] || 'text'}`);}
        const result=await pg.query<any>(`SELECT public.${ident(name)}(${placeholders.join(',')}) AS data`,params);
        return {data:result.rows[0].data,error:null};
      } catch(error:any) {console.error("Postgres RPC",name,error.code,error.message);return {data:null,error:{code:error.code,message:error.message}};}
    },
    from:(table:string)=>{
      const conditions:string[]=[],params:any[]=[];let fields='*',limit='',sort='',single=false;
      const query:any={
        select:(f='*')=>{fields=f==='*'?'*':f.split(',').map(ident).join(',');return query;},
        eq:(k:string,v:any)=>{params.push(v);conditions.push(`${ident(k)}=$${params.length}`);return query;},
        order:(k:string)=>{sort=` ORDER BY ${ident(k)}`;return query;},
        range:(start:number,end:number)=>{limit=` LIMIT ${end-start+1} OFFSET ${start}`;return query;},
        maybeSingle:()=>{single=true;return query;},
        then:(resolve:any,reject:any)=>pg.query<any>(`SELECT ${fields} FROM public.${ident(table)}${conditions.length?' WHERE '+conditions.join(' AND '):''}${sort}${limit}`,params).then(r=>resolve({data:single?(r.rows[0] || null):r.rows,error:null}),e=>resolve({data:null,error:{code:e.code,message:e.message}})).catch(reject)
      };return query;
    }
  };
}
