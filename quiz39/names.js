'use strict';
const crypto=require('node:crypto'),policy=require('./name-policy.json');
const message='Deze spelersnaam is niet toegestaan. Kies een andere naam.';
const confusables={'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','і':'i','ј':'j','к':'k','м':'m','т':'t','в':'b','н':'h','α':'a','ε':'e','ο':'o','ρ':'p','χ':'x','ι':'i','ν':'v','τ':'t','κ':'k','ѕ':'s','ӏ':'l','ı':'i','ß':'ss','æ':'ae','ø':'o','œ':'oe','ð':'d','þ':'th'};
function canonical(value){return String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').replace(/./gu,c=>confusables[c]||c).replace(/[01345789]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g'}[c]));}
function check(value,{extra=[]}={}){
 if(typeof value!=='string'||value.length<3||value.length>24)return {allowed:false,message};
 const normalized=value.normalize('NFKC').trim();
 if(/[\p{Cc}\p{Cf}]/u.test(value)||!/^\p{L}[\p{L}\p{M}\d _.'-]{2,23}$/u.test(normalized)||/@|https?:|www\.|\.com|\.nl|\.net|\.org|\+\d/i.test(value)||(/\d(?:[\s()._-]*\d){6}/.test(value)||(value.match(/\d/g)||[]).length>=7))return {allowed:false,message};
 const folded=canonical(value),joined=folded.replace(/[^a-z0-9]/g,''),words=folded.split(/[^a-z0-9]+/).filter(Boolean);
 // Explicitly review short roots as whole tokens; ordinary names are not substring matches.
 if(policy.ordinaryNames.includes(joined))return {allowed:true,normalized};
 const blocked=words.some(w=>policy.exact.some(x=>canonical(x)===w))||policy.exact.some(x=>canonical(x)===joined)||[...policy.contained,...extra].some(x=>joined.includes(canonical(x).replace(/[^a-z0-9]/g,'')));
 if(blocked||/(.)\1{6}/.test(joined)||joined.length<3)return {allowed:false,message};
 return {allowed:true,normalized};
}
const colors=['Groene','Zilveren','Blauwe','Gouden','Snelle','Rustige','Sterke','Vlotte'],animals=['Valk','Vos','Arend','Panda','Lynx','Otter','Tijger','Uil'];
function generate(){for(let i=0;i<100;i++){const name=colors[crypto.randomInt(colors.length)]+animals[crypto.randomInt(animals.length)]+crypto.randomInt(1000,10000);if(check(name).allowed)return name;}return 'GroeneValk';}
module.exports={canonical,check,generate,message,version:policy.version};
