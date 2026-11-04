// web-push supplies RFC 8291 encryption and VAPID authorization; fetch performs transport in Workers.
// @ts-ignore web-push has no bundled TypeScript declarations.
import webpush from 'web-push';
export async function sendPush(subscription:any,payload:any,env:any){const details=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:3600,vapidDetails:{subject:env.VAPID_SUBJECT||'https://multtek-expansao-hc.roundcrab28.chatgpt.site',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body});if(!response.ok)throw Object.assign(new Error('Push delivery failed'),{statusCode:response.status});}
