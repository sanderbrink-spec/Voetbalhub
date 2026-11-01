'use strict';
const crypto=require('node:crypto');
const allowed=key=>/^(?:article:|editorial-draft:|editorial:(?:media:|revoked:|evidence:|media-article:|pending:|auto-topic:|auto-budget:|published-title:|published-body:|publication-version$))/.test(key);
const PATTERNS=['article:*','editorial-draft:*','editorial:media:*','editorial:revoked:*','editorial:evidence:*','editorial:media-article:*','editorial:pending:*','editorial:auto-topic:*','editorial:auto-budget:*','editorial:published-title:*','editorial:published-body:*','editorial:publication-version'];
function keyBytes(key){if(typeof key!=='string'||!/^[-A-Za-z0-9+/]{43}=$/.test(key))throw Error('Een afzonderlijke base64 AES-256-back-upsleutel is vereist.');const bytes=Buffer.from(key,'base64');if(bytes.length!==32)throw Error('Ongeldige back-upsleutel.');return bytes;}
async function exportSnapshot(client,key,now=Date.now()){
 const names=[...new Set((await Promise.all(PATTERNS.map(p=>client.keys(p)))).flat())].filter(allowed).sort();if(names.length>2000)throw Error('Back-upgrens overschreden; gebruik beheerde opslagback-up.');
 const rows=names.length?await client.eval("local out={};local size=0;for _,k in ipairs(KEYS) do local v=redis.call('GET',k);if v then size=size+#v;if size>67108864 then return redis.error_reply('backup_too_large') end;table.insert(out,{v,redis.call('PTTL',k)}) else table.insert(out,{'',-2}) end end;return out",{keys:names,arguments:[]}):[];
 const plain=Buffer.from(JSON.stringify({version:1,savedAt:now,entries:names.map((name,i)=>({name,value:rows[i][0],ttl:Number(rows[i][1])})).filter(e=>e.ttl!==-2)}));
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyBytes(key),iv),ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);return Buffer.from(JSON.stringify({format:'veldio-backup-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
async function restoreEmpty(client,bytes,key,now=Date.now()){
 if(bytes.length>95000000)throw Error('Back-up te groot.');const envelope=JSON.parse(bytes.toString('utf8'));if(envelope.format!=='veldio-backup-v1')throw Error('Onbekend back-upformaat.');const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');if(iv.length!==12||tag.length!==16)throw Error('Ongeldige versleuteling.');const decipher=crypto.createDecipheriv('aes-256-gcm',keyBytes(key),iv);decipher.setAuthTag(tag);const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8'));
 if(data.version!==1||!Array.isArray(data.entries)||data.entries.length>2000||!Number.isFinite(data.savedAt))throw Error('Ongeldige snapshot.');const entries=data.entries.filter(e=>e.ttl===-1||e.ttl>0&&data.savedAt+e.ttl>now);if(entries.some(e=>typeof e.name!=='string'||!allowed(e.name)||typeof e.value!=='string'||!Number.isFinite(e.ttl))||new Set(entries.map(e=>e.name)).size!==entries.length)throw Error('Ongeldige back-uprecords.');
 if((await Promise.all(PATTERNS.map(p=>client.keys(p)))).flat().length)throw Error('Herstel gestopt: bestaande records worden niet overschreven.');
 if(!entries.length)return 0;
 const values=entries.flatMap(e=>[e.value,String(e.ttl===-1?-1:Math.max(1,data.savedAt+e.ttl-now))]);
 const result=await client.eval("for _,k in ipairs(KEYS) do if redis.call('EXISTS',k)==1 then return 0 end end;for i,k in ipairs(KEYS) do local ttl=tonumber(ARGV[i*2]);if ttl>0 then redis.call('SET',k,ARGV[i*2-1],'PX',ttl) else redis.call('SET',k,ARGV[i*2-1]) end end;return 1",{keys:entries.map(e=>e.name),arguments:values});if(Number(result)!==1)throw Error('Herstel gestopt: bestaande records worden niet overschreven.');return entries.length;
}
module.exports={exportSnapshot,restoreEmpty};
