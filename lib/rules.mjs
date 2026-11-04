export const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
export function cpfValid(value){const s=String(value||'').replace(/\D/g,'');if(s.length!==11||/^(\d)\1{10}$/.test(s))return false;for(let n=9;n<11;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(s[i])*(n+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(s[n]))return false}return true}
export function taskValid(t){return !!(String(t.summary||'').trim()&&words(t.summary)<=2000&&t.client_id&&t.origin_id&&t.assignee_id&&(t.duration==null||(Number.isInteger(t.duration)&&t.duration>=0&&t.duration<=5256000)))}
export const conclusion=(from,to)=>!from.done&&!!to.done;
export const ufs='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
// Receita Federal: 12 posições alfanuméricas + 2 DVs numéricos, módulo 11 (ASCII - 48).
export const normalizeCnpj=value=>String(value??'').trim().replace(/[.\/\-\s]/g,'').toUpperCase();
export function cnpjValid(value){const s=normalizeCnpj(value);if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(s)||/^(\d)\1{13}$/.test(s))return false;let base=s.slice(0,12);for(let n=0;n<2;n++){let sum=0,weight=2;for(let i=base.length-1;i>=0;i--){sum+=(base.charCodeAt(i)-48)*weight;weight=weight===9?2:weight+1}const rest=sum%11,digit=rest<2?0:11-rest;if(Number(s[12+n])!==digit)return false;base+=digit}return true}
export function formatCnpj(value){const s=normalizeCnpj(value);return s.replace(/^([A-Z0-9]{2})([A-Z0-9])/,'$1.$2').replace(/^([A-Z0-9]{2}\.[A-Z0-9]{3})([A-Z0-9])/,'$1.$2').replace(/^([A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3})([A-Z0-9])/,'$1/$2').replace(/(\/[A-Z0-9]{4})([0-9]{1,2})$/,'$1-$2')}
