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
  const result=await client.rpc('deployment_schema_version');
  if(result.error || Number(result.data)<9) throw new Error('Apply migrations 001–009 before deploying this server.');
}
