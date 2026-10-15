import {Database} from './server/features/shared/database';
export function deploymentConfigurationErrors():string[] {
  const errors:string[]=[];
  for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','APP_URL']) {
    const value=process.env[name]?.trim();if(!value || /^(YOUR_|MY_)/.test(value)) errors.push(`${name} is required.`);
  }
  if(process.env.APP_URL && !/^https:\/\//.test(process.env.APP_URL)) errors.push('APP_URL must be your public HTTPS URL.');
  if(!((process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || process.env.RESEND_FROM)) || (process.env.SMTP_USER && process.env.SMTP_PASS))) errors.push('Configure an HTTPS email provider and verified EMAIL_FROM, or working SMTP, for signup OTP.');
  if(/onboarding@resend\.dev/i.test(process.env.EMAIL_FROM || process.env.RESEND_FROM || '')) errors.push('Use a verified sender domain instead of the Resend sandbox sender.');
  return errors;
}
export async function validateStartup():Promise<void> {
  if(process.env.NODE_ENV!=='production' && process.env.APP_ENV!=='production') return;
  const errors=deploymentConfigurationErrors();if(errors.length) throw new Error('Deployment configuration: '+errors.join(' '));
  const client=Database.getInstance().getSupabaseClient();
  await checkDatabaseSchema(client);
}

/** Keep transport/pool failures distinct from genuinely missing migrations. */
export async function checkDatabaseSchema(client:any):Promise<void> {
  let result:any;
  try { result=await client.rpc('deployment_schema_version'); }
  catch { throw new Error('Database API unavailable during startup. Check connectivity and provider health before retrying deployment.'); }
  if(result.error) {
    const code=result.error.code;
    if(code==='PGRST003') throw new Error('Database API connection pool timed out (PGRST003). Restore API availability before retrying deployment; do not reapply migrations for this error.');
    if(code==='PGRST202' || code==='42883') throw new Error('Schema-version function is unavailable. Verify migration history and API schema cache before applying missing migrations.');
    throw new Error('Database API schema check failed. Verify server credentials, permissions and provider availability.');
  }
  const version=Number(result.data);
  if(!Number.isInteger(version) || version<9) throw new Error('Database schema version 9 is required. Verify and apply only missing migrations before deploying.');
}
