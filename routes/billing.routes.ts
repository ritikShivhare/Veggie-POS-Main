import express from 'express';
import crypto from 'node:crypto';
import {authMiddleware,requireRole,staffRepo} from '../server/context';
import {handleApiError} from '../server/features/shared/database';
import {getSubscription,getPlanLimits,subscriptionUsage,startTrial,selectFreeStaff} from '../server/features/billing/SubscriptionLifecycle';
import {createPaymentLink,listPaymentLinks,reconcilePayment,processCashfreeEvent} from '../server/features/billing/CashfreeBilling';
import {verifyCashfreeSignature} from '../server/features/billing/CashfreeClient';
const router=express.Router();
router.get('/billing/subscription',authMiddleware,requireRole('Owner','Manager'),async(req,res)=>{
 try{const tenant=(req as any).tenantId,sub=await getSubscription(tenant);res.json({success:true,subscription:sub,limits:getPlanLimits(sub),usage:await subscriptionUsage(tenant,sub),links:await listPaymentLinks(tenant),
 staffOptions:sub.staffSelectionRequired?(await staffRepo.getAll(tenant) || []).filter(s=>s.role!=='Owner').map(s=>({id:s.id,name:s.name,status:s.status})):[]});}catch(error){handleApiError(res,error);}
});
router.post('/billing/start-trial',authMiddleware,requireRole('Owner'),async(req,res)=>{
 try{res.json({success:true,subscription:await startTrial((req as any).tenantId)});}catch(error){handleApiError(res,error);}
});
router.post('/billing/select-staff',authMiddleware,requireRole('Owner'),async(req,res)=>{
 try{await selectFreeStaff((req as any).tenantId,req.body.staffIds);res.json({success:true});}catch(error){handleApiError(res,error);}
});
// Keep the established URL for existing clients; checkout now always uses Cashfree.
router.post('/billing/create-checkout-session',authMiddleware,requireRole('Owner'),async(req,res)=>{
 try{const key=req.headers['idempotency-key'];if(typeof key!=='string') return res.status(400).json({success:false,error:'IDEMPOTENCY_KEY_REQUIRED'});
  const link=await createPaymentLink((req as any).tenantId,req.body.plan,key,req.body.customer);res.json({success:true,url:link.url,link});}catch(error){handleApiError(res,error);}
});
router.post('/billing/check-payment-status',authMiddleware,requireRole('Owner'),async(req,res)=>{
 try{if(typeof req.body.linkId!=='string') return res.status(400).json({success:false,error:'LINK_ID_REQUIRED'});
  const tenant=(req as any).tenantId;res.json({success:true,link:await reconcilePayment(tenant,req.body.linkId),subscription:await getSubscription(tenant)});}catch(error){handleApiError(res,error);}
});
router.post('/billing/create-portal-session',authMiddleware,requireRole('Owner'),(_req,res)=>res.status(410).json({success:false,error:'STRIPE_RETIRED',message:'Use Check Payment Status or select a Cashfree plan.'}));
router.post('/webhooks/cashfree',async(req,res)=>{
 const sig=req.headers['x-webhook-signature'],ts=req.headers['x-webhook-timestamp'];
 if(!process.env.CASHFREE_SECRET_KEY) return res.status(503).json({success:false,error:'WEBHOOK_NOT_CONFIGURED'});
 if(typeof sig!=='string' || typeof ts!=='string' || !verifyCashfreeSignature(req.body,sig,ts,process.env.CASHFREE_SECRET_KEY)) return res.status(400).json({success:false,error:'INVALID_SIGNATURE'});
 try{const event=JSON.parse(req.body.toString('utf8'));const hash=crypto.createHash('sha256').update(req.body).digest('hex');await processCashfreeEvent(event,hash);res.json({received:true});}catch(error){handleApiError(res,error);}
});
router.post('/webhooks/stripe',(_req,res)=>res.status(410).json({success:false,error:'STRIPE_RETIRED'}));
// Old mock paths are intentionally not registered in any environment.
export default router;
