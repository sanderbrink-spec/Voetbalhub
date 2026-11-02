local time=redis.call('TIME');local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000)
local op=ARGV[1]
local p=redis.call('GET',KEYS[7]);if not p then return cjson.encode({error='identity',status=401}) end
local profile=cjson.decode(p);if profile.blocked then return cjson.encode({error='blocked',status=403}) end
if op=='create' then
 local old=redis.call('GET',KEYS[2]);if old then return cjson.encode({existingRound=old}) end
 if redis.call('HLEN',KEYS[3])>=1000 then return cjson.encode({error='capacity',status=429}) end
 local r=cjson.decode(ARGV[2]);r.createdAt=now;r.issuedAt=now;r.expiresAt=now+1800000;r.index=0;r.points=0;r.correct=0;r.correctMs=0;r.totalMs=0;r.answered=false;r.done=false;r.fastCount=0;r.receipts={};r.nextReceipts={}
 redis.call('SET',KEYS[2],r.id,'EX',172800);redis.call('SET',KEYS[1],cjson.encode(r),'EX',172800)
 redis.call('HSET',KEYS[3],r.playerId,cjson.encode({playerId=r.playerId,roundId=r.id,points=0,correct=0,correctMs=0,totalMs=0,answered=0,total=#r.questions,completed=false,flagged=false,at=now,day=r.day,week=r.week,setId=r.setId,mode=r.mode}));redis.call('EXPIRE',KEYS[3],172800)
 return cjson.encode(r)
end
local raw=redis.call('GET',KEYS[1]);if not raw then return cjson.encode({error='missing',status=404}) end
local r=cjson.decode(raw);if r.playerId~=ARGV[2] then return cjson.encode({error='identity',status=403}) end
local requestId=ARGV[3]
if op=='answer' and r.receipts[requestId] then
 local rec=r.receipts[requestId];if rec.nonce~=ARGV[4] or rec.option~=ARGV[5] then return cjson.encode({error='replay_changed',status=409}) end
 return cjson.encode(r)
end
if op=='next' and r.nextReceipts[requestId] then return cjson.encode(r) end
if r.done then return cjson.encode({error='finished',status=409}) end
if now>r.expiresAt then return cjson.encode({error='expired',status=410}) end
if op=='next' then
 if not r.answered then return cjson.encode({error='not_answered',status=409}) end
 r.index=r.index+1;r.answered=false;r.issuedAt=now;r.lastAnswer=cjson.null;r.nextReceipts[requestId]=true
elseif op=='answer' then
 local q=r.questions[r.index+1]
 if r.answered or q.nonce~=ARGV[4] then return cjson.encode({error='stale_question',status=409}) end
 local elapsed=math.max(0,now-r.issuedAt);local option=ARGV[5];local found=option=='' and elapsed>=15000
 for _,a in ipairs(q.options) do if a.id==option then found=true end end
 if not found then return cjson.encode({error='invalid_option',status=400}) end
 local correct=elapsed<15000 and option==q.correctId;local score=0
 if correct then
  score=math.floor(((100+100*(15000-elapsed)/15000)*q.factor)+0.5);r.correct=r.correct+1;r.correctMs=r.correctMs+elapsed
  if elapsed<250 then r.fastCount=r.fastCount+1 end
 end
 r.points=r.points+score;r.totalMs=r.totalMs+math.min(15000,elapsed);r.answered=true
 r.lastAnswer={index=r.index,correct=correct,points=score,answer=q.correctText,explanation=q.explanation,source=q.source,elapsedMs=math.min(15000,elapsed),timedOut=elapsed>=15000}
 r.receipts[requestId]={nonce=ARGV[4],option=option};if r.index+1==#r.questions then r.done=true;r.completedAt=now end
 r.flagged=r.fastCount>=3 or (r.done and r.correct>=5 and r.correctMs/r.correct<350)
 local summary={playerId=r.playerId,roundId=r.id,points=r.points,correct=r.correct,correctMs=r.correctMs,totalMs=r.totalMs,answered=r.index+1,total=#r.questions,completed=r.done,flagged=r.flagged,at=now,day=r.day,week=r.week,setId=r.setId,mode=r.mode}
 redis.call('HSET',KEYS[3],r.playerId,cjson.encode(summary));redis.call('EXPIRE',KEYS[3],172800)
 if r.done and not r.flagged then
  profile.records=profile.records or {};local best=profile.records[r.mode]
  if not best or summary.points>best.points then profile.records[r.mode]={points=summary.points,correct=summary.correct,total=summary.total,setId=r.setId,at=now} end
  profile.version=profile.version+1;redis.call('SET',KEYS[7],cjson.encode(profile),'EX',7776000)
  for k=4,6 do
   local old=redis.call('HGET',KEYS[k],r.playerId);local replace=true
   if old then local prev=cjson.decode(old);replace=summary.points>prev.points or (summary.points==prev.points and (summary.correct>prev.correct or (summary.correct==prev.correct and summary.correctMs<prev.correctMs))) end
   if replace then redis.call('HSET',KEYS[k],r.playerId,cjson.encode(summary)) end
   redis.call('EXPIRE',KEYS[k],7776000)
  end
 end
else return cjson.encode({error='operation',status=400}) end
redis.call('SET',KEYS[1],cjson.encode(r),'EX',172800)
return cjson.encode(r)
