import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { groupApplicants, type Followup } from './applicant-followup';
import { loadInteractions } from './interaction-inbox.server';

export const listApplicantFollowup = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if(role.error || !role.data) throw new Error('Solo administradores.');
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  async function all<T>(fetchPage:(a:number,b:number)=>PromiseLike<{data:T[]|null;error:unknown}>) { const rows:T[]=[]; for(let a=0;;a+=500) {const res=await fetchPage(a,a+499); if(res.error) throw new Error('No se pudo cargar el seguimiento.'); rows.push(...(res.data??[])); if((res.data?.length??0)<500) return rows;} }
  const [interactions,profiles,calls,followups,links,decisions,scholarships,roles]=await Promise.all([
    loadInteractions(db),all((a,b)=>db.from('profiles').select('id,full_name,updated_at').order('id').range(a,b)),
    all((a,b)=>db.from('applicant_calls').select('*').order('id').range(a,b)),
    all((a,b)=>db.from('applicant_followups').select('*').order('person_key').range(a,b)),
    all((a,b)=>db.from('applicant_identity_links').select('*').order('source_key').range(a,b)),
    all((a,b)=>db.from('scholarship_decisions').select('user_id,scholarship_id').eq('decision','guardada').order('id').range(a,b)),
    all((a,b)=>db.from('scholarships').select('id,name,deadline').order('id').range(a,b)),
    all((a,b)=>db.from('user_roles').select('user_id').eq('role','admin').order('user_id').range(a,b)),
  ]);
  const saved=decisions.flatMap(d=>{const s=scholarships.find(s=>s.id===d.scholarship_id);return s?[{...s,user_id:d.user_id}]:[];});
  return JSON.stringify({people:groupApplicants({profiles,interactions,calls,followups:followups as Followup[],links,saved},Date.now()),admins:roles.map(r=>({id:r.user_id,name:profiles.find(p=>p.id===r.user_id)?.full_name || `Administrador ${r.user_id.slice(0,8)}`}))});
});
const key=z.string().regex(/^(user|form|web|wa|call):[0-9a-f-]{36}$/);
export const saveApplicantFollowup=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({personKey:key,stage:z.enum(['nuevo','contactado','preparando','seguimiento','ganado','perdido']),nextAction:z.string().max(500),followupAt:z.string().datetime().nullable(),assignedTo:z.string().uuid().nullable(),objective:z.string().max(1000),resolve:z.boolean()}).refine(d=>d.stage!=='ganado'||d.objective.trim().length>0,'Define el objetivo administrativo alcanzado.').parse(d)).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error||!role.data)throw new Error('Solo administradores.');
  if(data.assignedTo){const r=await context.supabase.rpc('has_role',{_user_id:data.assignedTo,_role:'admin'});if(r.error||!r.data)throw new Error('El responsable debe ser administrador.');}
  const previous=await context.supabase.from('applicant_followups').select('response_resolved_at').eq('person_key',data.personKey).maybeSingle(); if(previous.error)throw new Error('No se pudo leer el seguimiento.');
  const r=await context.supabase.from('applicant_followups').upsert({person_key:data.personKey,stage:data.stage,next_action:data.nextAction,followup_at:data.followupAt,assigned_to:data.assignedTo,objective:data.objective,response_resolved_at:data.resolve?new Date().toISOString():previous.data?.response_resolved_at??null,updated_by:context.userId,updated_at:new Date().toISOString()});if(r.error)throw new Error('No se pudo guardar el seguimiento.');return {ok:true};
});
export const recordApplicantCall=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({name:z.string().max(120),userId:z.string().uuid().nullable(),occurredAt:z.string().datetime(),notes:z.string().min(10).max(2000),requiresResponse:z.boolean()}).parse(d)).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error||!role.data)throw new Error('Solo administradores.');
  if(Date.parse(data.occurredAt)>Date.now())throw new Error('No registres una llamada futura como realizada.');
  if(data.userId){const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const u=await db.auth.admin.getUserById(data.userId);if(u.error||!u.data.user)throw new Error('Usuario no encontrado.');}
  const r=await context.supabase.from('applicant_calls').insert({full_name:data.name,user_id:data.userId,occurred_at:data.occurredAt,notes:data.notes,requires_response:data.requiresResponse,created_by:context.userId});if(r.error)throw new Error('No se pudo registrar la llamada.');return {ok:true};
});
export const confirmApplicantIdentity=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({sourceKey:key,targetKey:key,evidence:z.string().trim().min(10).max(1000)}).parse(d)).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error||!role.data)throw new Error('Solo administradores.');
  if(data.sourceKey.startsWith('user:') || data.sourceKey===data.targetKey)throw new Error('No se pueden fusionar cuentas autenticadas.');
  const links=await context.supabase.from('applicant_identity_links').select('source_key,target_key');if(links.error)throw new Error('No se pudieron revisar las identidades.');
  if(links.data.some(l=>l.target_key===data.sourceKey||l.source_key===data.sourceKey))throw new Error('Esta identidad ya tiene vínculos; revisa su ficha.');
  let target=data.targetKey;const seen=new Set<string>();while(!seen.has(target)){seen.add(target);const link=links.data.find(l=>l.source_key===target);if(!link)break;target=link.target_key;}
  if(target===data.sourceKey)throw new Error('Vínculo circular no permitido.');
  const r=await context.supabase.from('applicant_identity_links').insert({source_key:data.sourceKey,target_key:target,evidence:data.evidence,reviewed_by:context.userId});if(r.error)throw new Error('No se pudo confirmar la identidad.');return {ok:true};
});