const test=require('node:test');
const assert=require('node:assert/strict');
const {createEditorialDraft,groqEditorialOptions,editorialAssignment,officialPublisherName,editorialAttributionIssues,officialCoachStructureIssues,unsupportedInterpretationIssues}=require('../editorial-ai');
const good={headline:'FC Groningen bespreekt plannen voor het komende seizoen',standfirst:'De club bespreekt nieuwe plannen met de betrokken medewerkers en neemt de uitkomsten mee in de voorbereiding op het komende seizoen.',body:[
'Op het trainingscomplex werkten spelers in kleine groepen aan verschillende oefeningen onder leiding van de technische staf terwijl de overige medewerkers hun taken voorbereidden.',
'Tijdens een apart overleg spraken vertegenwoordigers van de club met supporters over praktische onderwerpen rond de ontvangst van bezoekers en bereikbaarheid van het stadion.',
'Het bestuur zal de verschillende voorstellen tijdens een volgende vergadering bespreken voordat de verantwoordelijke afdelingen verdere afspraken over uitvoering en planning kunnen maken.'
]};
const input={topic:'Clubplannen',facts:[good.headline,good.standfirst,...good.body],category:'Voetbal',sourceUrls:['https://fcgroningen.nl/nieuws']};
const config={apiKey:'test-secret-not-real',model:'test-model'};
const reply=d=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}),{status:200,headers:{'Content-Type':'application/json'}});
test('draft generation sends only supplied facts with timeout signal and returns unpublished draft',async()=>{
 const d=await createEditorialDraft(input,{...config,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.ok(options.signal instanceof AbortSignal);
  const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert.deepEqual(JSON.parse(body.messages[1].content).facts,input.facts);return reply(good);
 }});assert.deepEqual(d.body,good.body);assert.equal(d.headline,good.headline);assert.equal(d.qualityReview.attempts,1);assert.equal(d.qualityReview.autoPublish,false);assert.equal(d.status,undefined);
});
test('rate limit remains 429 with bounded retry guidance and no provider-secret disclosure',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>new Response('private provider body',{status:429,headers:{'retry-after':'120'}})}),e=>e.status===429&&e.retryAfter===120&&!e.message.includes('private'));
});
test('temporary provider failures use safe errors and never leak API-key-bearing errors',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{throw Error(config.apiKey);}}),e=>e.status===502&&!e.message.includes(config.apiKey));
});
test('AI request is aborted when its deadline expires',async()=>{
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(createEditorialDraft(input,{...config,timeoutMs:5,fetcher:async(_,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})}),e=>e.status===504);}finally{clearTimeout(keepAlive);}
});
test('insufficient facts response is distinct from outage and malformed output',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>reply({skip:true,reason:'Weinig informatie'})}),e=>e.status===422);
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>new Response('not-json',{status:200})}),e=>e.status===502);
});
test('incomplete or contradictory generated copy never passes',async()=>{
 for(const draft of [{...good,body:['te kort']},{...good,headline:'FC Twente wint en speelt gelijk tegen AZ'}]){
  await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>reply(draft)}),e=>e.status===502);
 }
});
test('a rejected first draft gets one targeted repair using exactly the same fact packet',async()=>{
 let calls=0;
 const result=await createEditorialDraft(input,{...config,fetcher:async(_,options)=>{
  calls++;const payload=JSON.parse(options.body);
  assert.deepEqual(JSON.parse(payload.messages[1].content).facts,input.facts);
  if(calls===1)return reply({...good,body:['Te kort.']});
  assert.match(payload.messages.at(-1).content,/Herstel uitsluitend/);
  assert.match(payload.messages.at(-1).content,/18 tot 120 woorden/);
  return reply(good);
 }});
 assert.equal(calls,2);assert.equal(result.qualityReview.revisionApplied,true);assert.equal(result.qualityReview.autoPublish,false);
});
test('repetition is detected before generation succeeds and repaired before final review',async()=>{
 let calls=0;
 const result=await createEditorialDraft(input,{...config,fetcher:async()=>++calls===1?reply({...good,body:[good.body[0],good.body[0],good.body[2]]}):reply(good)});
 assert.equal(calls,2);assert.equal(result.qualityReview.automatedTextChecksPassed,true);
 assert.deepEqual(require('../editorial-desk-model').draftIssues(result),[]);
});
test('new numbers cause a targeted repair instead of being accepted as supplied facts',async()=>{
 let calls=0;
 await createEditorialDraft(input,{...config,fetcher:async(_,options)=>{
  if(++calls===1)return reply({...good,headline:'FC Groningen bespreekt 27 plannen voor het nieuwe seizoen'});
  assert.match(JSON.parse(options.body).messages.at(-1).content,/Cijfers ontbreken in de gecontroleerde feiten: 27/);
  return reply(good);
 }});assert.equal(calls,2);
});
test('valid fenced JSON and paragraph strings are normalized without unnecessary regeneration',async()=>{
 let calls=0;
 const value={...good,body:good.body.join('\n\n')};
 const result=await createEditorialDraft(input,{...config,fetcher:async()=>{
  calls++;return new Response(JSON.stringify({choices:[{message:{content:'```json\n'+JSON.stringify(value)+'\n```'}}]}),{status:200});
 }});assert.equal(calls,1);assert.deepEqual(result.body,good.body);
});
test('persistent failures stop after exactly one repair with actionable quality feedback',async()=>{
 let calls=0;
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{calls++;return reply({...good,body:['Nog te kort.']});}}),e=>e.status===502&&e.issues.some(x=>x.includes('3 tot 5')));
 assert.equal(calls,2);
});
test('provider limits and insufficient facts do not trigger a repair or extra AI call',async()=>{
 for(const response of [()=>new Response('',{status:429}),()=>reply({skip:true})]){
  let calls=0;
  await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{calls++;return response();}}));assert.equal(calls,1);
 }
});

test('V91 automatic newsroom requests only a completed article JSON and reserves enough output tokens',async()=>{
 let request;
 const output=await createEditorialDraft({...input,automaticPublication:true},{...config,fetcher:async(_,options)=>{
  request=JSON.parse(options.body);
  return reply(good);
 }});
 assert.equal(request.max_completion_tokens,3600);
 assert.match(request.messages[0].content,/GEEN claims, why_it_matters of verification_notes/);
 assert.match(request.messages[0].content,/lege alinea’s is altijd een ongeldig concept/);
 assert.equal(request.messages[0].content.includes('Claims bevatten claim, evidence en status'),false);
 assert.equal(request.messages[1].content.includes('"automaticPublication":true'),true);
 assert.equal(output.body.length,3);
});

test('V94 models get deliberate reasoning budgets for each newsroom job',()=>{
 const model='openai/gpt-oss-120b';
 for(const [role,effort,budget] of [['extraction','low',2400],['writing','medium',3600],['revision','high',4200],['review','high',4200]]){
  const body=groqEditorialOptions(model,role,{automaticPublication:true});
  assert.equal(body.reasoning_effort,effort);
  assert.equal(body.max_completion_tokens,budget);
  assert.equal(body.include_reasoning,false);
  assert.deepEqual(body.response_format,{type:'json_object'});
 }
 assert.equal(groqEditorialOptions(model,'writing').max_completion_tokens,2000);
 assert.equal(groqEditorialOptions('test-model','writing').reasoning_effort,undefined);
 assert.throws(()=>groqEditorialOptions(model,'other'),RangeError);
});
test('V94 automated writer uses 120B medium, no premium model or new API',async()=>{
 let request;
 const f=async(_,options)=>{request=JSON.parse(options.body);return reply(good);};
 await createEditorialDraft({...input,automaticPublication:true},{...config,model:'openai/gpt-oss-120b',fetcher:f});
 assert.equal(request.model,'openai/gpt-oss-120b');
 assert.equal(request.reasoning_effort,'medium');
 assert.equal(request.max_completion_tokens,3600);
});

test('V95 reporter assigns different verified fact IDs to an intro and three body themes without inventing claims',()=>{
 const facts=[
  'PEC Zwolle heeft Alex Pastoor als hoofdtrainer aangesteld.',
  'Dennis van der Ree en Maikel van der Werff keren als assistent-trainer terug.',
  'In 2025 werkte Pastoor als assistent-bondscoach van Indonesië.',
  'Technisch directeur Gerry Hamstra zegt dat de club meerdere opties heeft overwogen.',
  'Pastoor tekent een contract tot de zomer van 2027.'
 ];
 const plan=editorialAssignment(facts);
 assert.deepEqual(plan.leadFactIds,['F1']);
 assert.equal(plan.bodySections.length,4);
 const ids=[...plan.leadFactIds,...plan.bodySections.flatMap(x=>x.factIds)];
 assert.deepEqual(ids.slice().sort(),['F1','F2','F3','F4','F5']);
 assert.equal(new Set(ids).size,ids.length);
 assert.match(plan.bodySections[0].angle,/personele/i);
 const brief=editorialAssignment(facts,{compact:true});
 assert.ok(brief.bodySections.length<=2);
 assert.deepEqual([...brief.leadFactIds,...brief.bodySections.flatMap(x=>x.factIds)].sort(),ids.slice().sort());
});
test('V95 reporter deduplicates identical source facts and refuses to invent paragraph themes',()=>{
 const facts=['PSV bevestigt een trainersbesluit.','PSV bevestigt een trainersbesluit.','De club vermeldt een ingangsdatum.'];
 const plan=editorialAssignment(facts);
 assert.deepEqual([...plan.leadFactIds,...plan.bodySections.flatMap(x=>x.factIds)].sort(),['F1','F3']);
 assert.equal(plan.bodySections.length,1);
 assert.deepEqual(editorialAssignment([]),{leadFactIds:[],bodySections:[]});
});
test('V95 writer receives a deterministic reporting assignment alongside the original verified facts',async()=>{
 let request;
 const f=async(_,options)=>{request=JSON.parse(options.body);return reply(good);};
 await createEditorialDraft({...input,automaticPublication:true},{...config,fetcher:f});
 const supplied=JSON.parse(request.messages[1].content);
 assert.deepEqual(supplied.facts,input.facts);
 assert.ok(supplied.editorialAssignment.leadFactIds.length>0);
 assert.ok(request.messages[0].content.includes('labels voegen geen feiten toe'));
});

test('V96 official club authority survives writer planning and reaches Groq unchanged',async()=>{
 let request;
 const attributed={...good,
  standfirst:'FC Groningen meldt dat de club plannen met betrokken medewerkers bespreekt en de uitkomsten verwerkt in de voorbereiding op het seizoen.',
  body:['De club meldt dat spelers op het trainingscomplex met de technische staf oefeningen uitvoerden terwijl medewerkers hun taken voorbereidden.',...good.body.slice(1)]};
 const mock=async(_,options)=>{request=JSON.parse(options.body);return reply(attributed);};
 const facts=[good.headline,good.standfirst,...good.body];
 await createEditorialDraft({...input,topic:'PEC Zwolle benoemt hoofdtrainer',facts,primaryAuthority:'club_decision',automaticPublication:true},{...config,fetcher:mock});
 const supplied=JSON.parse(request.messages[1].content);
 assert.equal(supplied.primaryAuthority,'club_decision');
 assert.match(request.messages[0].content,/Voor deze officieel aangekondigde trainersbenoeming/);
 await createEditorialDraft({...input,primaryAuthority:null,automaticPublication:true},{...config,fetcher:mock});
 assert.equal(JSON.parse(request.messages[1].content).primaryAuthority,null);
});
test('V96 reporter removes only identical meaningful facts and preserves different career/staff claims',()=>{
 const facts=[
  'Dennis van der Ree en Maikel van der Werff keren terug als assistent-trainers.',
  'Maikel van der Werff en Dennis van der Ree keren terug als assistent-trainers.',
  'Dennis van der Ree en Maikel van der Werff blijven tijdelijk hoofdtrainers.',
  'Alex Pastoor werkte in 2024 als hoofdtrainer in Nederland.',
  'Alex Pastoor werkte in 2025 als hoofdtrainer in Nederland.',
  'PEC Zwolle bevestigt Alex Pastoor als hoofdtrainer.'
 ];
 const plan=editorialAssignment(facts);
 const ids=[...plan.leadFactIds,...plan.bodySections.flatMap(s=>s.factIds)].sort();
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids,['F1','F3','F4','F5','F6']);
 assert.equal(plan.leadFactIds[0],'F6');
 const different=editorialAssignment(['PSV wint de finale van Ajax','PSV verliest de finale van Ajax']);
 assert.equal(different.bodySections.length,1);
});

test('V102 publisher label requires an exact trusted HTTPS official hostname',()=>{
 assert.equal(officialPublisherName('https://peczwolle.nl/nieuws/nieuwe-trainer'),'PEC Zwolle');
 assert.equal(officialPublisherName('https://www.fcgroningen.nl/nieuws/feit'),'FC Groningen');
 for(const url of ['http://peczwolle.nl/nieuws','https://peczwolle.nl.evil.net/nieuws','https://fake-peczwolle.nl/nieuws','invalid'])
  assert.equal(officialPublisherName(url),null);
});
test('V102 initial official article must attribute both the club decision and at least one substantive paragraph',()=>{
 const context={primaryAuthority:'club_decision',sourceUrls:['https://peczwolle.nl/nieuws/nieuwe-trainer'],facts:['Feit 1','Feit 2','Feit 3','Feit 4']};
 const draft={headline:'Nieuwe hoofdtrainer in Zwolle aangekondigd',
  standfirst:'PEC Zwolle heeft een trainer aangesteld en legt de contractvoorwaarden aan supporters en medewerkers uit.',
  body:['De assistenten keren terug naar hun eerdere functie bij de technische staf.',
        'De trainer werkte eerder bij een buitenlandse voetbalbond.',
        'Het bestuur heeft meerdere kandidaten overwogen en vervolgens besloten.']};
 assert.equal(editorialAttributionIssues({...draft,standfirst:'PEC Zwolle heeft een trainer aangesteld bij de club.'},context).length,2);
 assert.equal(editorialAttributionIssues(draft,context).length,1);
 const attributed={...draft,body:['De club meldt dat de assistenten naar hun eerdere functie terugkeren.',...draft.body.slice(1)]};
 assert.deepEqual(editorialAttributionIssues(attributed,context),[]);
 assert.deepEqual(editorialAttributionIssues(draft,{...context,primaryAuthority:null}),[]);
 assert.deepEqual(editorialAttributionIssues(draft,{...context,sourceUrls:['https://peczwolle.nl/nieuws','https://ajax.nl/nieuws']}),[]);
});
test('V102 first writer sees official publisher while original fact gate remains mandatory',async()=>{
 const facts=['PEC Zwolle bevestigt de aanstelling van een hoofdtrainer.',
  'Dennis van der Ree en Maikel van der Werff keren terug als assistenten.',
  'De trainer werkte eerder als assistent-bondscoach bij Indonesië.',
  'De club vermeldt een contract en licht de benoeming toe.'];
 let sent;
 const news={headline:'PEC Zwolle kiest vaste hoofdtrainer en nieuwe staf',
  standfirst:'PEC Zwolle bevestigt de benoeming van een hoofdtrainer en maakt de afspraken over de assistenten bekend.',
  body:['De club meldt dat Dennis van der Ree en Maikel van der Werff terugkeren als assistenten van de nieuwe hoofdtrainer.',
   'De benoemde trainer was eerder als assistent-bondscoach werkzaam bij Indonesië en vervult nu een rol bij PEC Zwolle.',
   'In de bekendmaking licht de club de concrete contractafspraken en de benoeming nader toe zonder aanvullende onbewezen conclusies of een verzonnen wedstrijdverloop.']};
 const result=await createEditorialDraft({topic:'PEC Zwolle benoemt nieuwe hoofdtrainer',category:'clubnieuws',facts,sourceUrls:['https://peczwolle.nl/nieuws/nieuwe-trainer'],primaryAuthority:'club_decision',automaticPublication:true},
 {apiKey:'fake',model:'openai/gpt-oss-120b',fetcher:async(_,options)=>{sent=JSON.parse(options.body);return reply(news);}});
 assert.equal(result.qualityReview.autoPublish,false);
 assert.equal(JSON.parse(sent.messages[1].content).officialPublisher,'PEC Zwolle');
 assert.match(sent.messages[0].content,/Deze nieuwsgebeurtenis is uitsluitend via een officiële mededeling van PEC Zwolle vastgesteld/);
});

test('V103 coach reporting has only three evidential body themes, never fabricated padding',()=>{
 const input={topic:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',primaryAuthority:'club_decision',facts:['Benoeming','Contract','Staf','Loopbaan']};
 assert.deepEqual(officialCoachStructureIssues({body:['Staf','Loopbaan','Toelichting']},input),[]);
 assert.equal(officialCoachStructureIssues({body:['Staf','Loopbaan','Toelichting','Niet bewezen gevolg']},input).length,1);
 assert.deepEqual(officialCoachStructureIssues({body:['A','B','C','D']},{...input,primaryAuthority:null}),[]);
});
test('V103 unsupported causal and comparative claims require literal source support',()=>{
 const draft={headline:'PEC Zwolle bevestigt trainersaanstelling',
 standfirst:'Volgens PEC Zwolle is de coach aangesteld.',
 body:['Het contract garandeert stabiliteit voor de club en schept een langetermijnvisie.',
       'De functie is de meest aantrekkelijke keuze voor de nieuwe hoofdtrainer.',
       'De club meldt dat twee assistenten terugkeren.']};
 const facts=['PEC Zwolle benoemt de trainer.','De club bevestigt het contract tot 2027.'];
 assert.equal(unsupportedInterpretationIssues(draft,facts).length,3);
 const supported=[...facts,'Stabiliteit en visie zijn door de club letterlijk genoemd.','De coach noemt dit de meest aantrekkelijke keuze.'];
 assert.deepEqual(unsupportedInterpretationIssues(draft,supported),[]);
 assert.deepEqual(unsupportedInterpretationIssues({body:['Geen gevolgtrekking.']},facts),[]);
});
test('V103 writer requests three evidence-led body paragraphs for official coach appointment',async()=>{
 let sent;
 const draft={headline:'PEC Zwolle maakt aanstelling nieuwe hoofdtrainer bekend',
 standfirst:'PEC Zwolle bevestigt het besluit om een nieuwe hoofdtrainer aan te stellen met ondersteuning van zijn staf.',
 body:['De club meldt verder dat de assistenten terugkeren naar hun oude functies binnen de technische staf rondom de trainer.',
       'De coach werkte eerder in het buitenland en heeft daarnaast een aantoonbare functie bij een nationale ploeg vervuld.',
       'In de officiële bekendmaking geeft de club een toelichting op de keuze en de afgesproken voorwaarden van zijn contract.']};
 const facts=['PEC Zwolle bevestigt een hoofdtrainer.','De assistenten keren terug naar hun functie.','De coach werkte eerder in het buitenland.','De club licht de benoeming toe.'];
 const good=await createEditorialDraft({topic:'PEC Zwolle benoemt hoofdtrainer',category:'clubnieuws',primaryAuthority:'club_decision',facts,sourceUrls:['https://peczwolle.nl/nieuws/feit'],automaticPublication:true},
 {apiKey:'test',model:'openai/gpt-oss-120b',fetcher:async(_,opts)=>{sent=JSON.parse(opts.body);return reply(draft);}});
 assert.equal(good.body.length,3);
 assert.match(sent.messages[0].content,/body \(exact drie alinea’s/);
});

test('V105 official coaching writer uses a compact unambiguous factual brief',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 let textPrompt;
 const facts=['PEC Zwolle stelt Alex Pastoor aan als hoofdtrainer.',
  'Dennis van der Ree en Maikel van der Werff keren terug als assistenten.',
  'Pastoor was in 2025 assistent-bondscoach van Indonesië.',
  'De club verklaart zijn aanstelling en contractvoorwaarden.'];
 const draft={headline:'PEC Zwolle benoemt hoofdtrainer en bevestigt zijn staf',
  standfirst:'PEC Zwolle bevestigt de komst van de nieuwe hoofdtrainer en meldt de voorwaarden van zijn contract en de technische staf.',
  body:['De club meldt dat Dennis van der Ree en Maikel van der Werff terugkeren naar hun functie als assistenten binnen de staf rondom de nieuwe hoofdtrainer.',
  'In 2025 werkte Pastoor als assistent-bondscoach van Indonesië; deze buitenlandse functie is in de gecontroleerde clubmededeling afzonderlijk bevestigd.',
  'In de officiële bekendmaking legt de club uit welke afspraken rond de benoeming zijn vastgelegd zonder verdere onbewezen gevolgen te beschrijven.']};
 await createEditorialDraft({topic:'PEC Zwolle benoemt hoofdtrainer',primaryAuthority:'club_decision',sourceUrls:['https://peczwolle.nl/nieuws/benoeming'],facts,category:'clubnieuws',automaticPublication:true},
 {apiKey:'test',model:'openai/gpt-oss-120b',fetcher:async(_,options)=>{
  textPrompt=JSON.parse(options.body).messages[0].content;
  return reply(draft);
 }});
 assert.ok(textPrompt.length<2600);
 assert.match(textPrompt,/Alinea 1 beschrijft alleen de feitelijke verandering in assistentrollen/);
 assert.match(textPrompt,/Geen vierde of vijfde alinea/);
 assert.match(textPrompt,/Verzin geen seizoen of verband tussen twee datums/);
});

test('V107 rich official coaching evidence earns exactly one second writer attempt after premature skip',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 const facts=[
 'PEC Zwolle heeft Alex Pastoor benoemd als hoofdtrainer.',
 'De trainer begint maandag en tekent een contract tot 2027.',
 'Dennis van der Ree en Maikel van der Werff keren terug als assistenten.',
 'Keeperstrainer Diederik Boer ondersteunt Pastoor.',
 'In 2024 besloot Pastoor voorlopig te stoppen.',
 'In 2025 werkte Pastoor als assistent-bondscoach bij Indonesië.',
 'Alex Pastoor: ,,Ik zie PEC Zwolle als een mooie uitdaging.”',
 'Gerry Hamstra licht de keuze toe: ,,De club bekeek meerdere opties.”'
 ];
 const requests=[],fetcher=async(_,options)=>{requests.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:'{"skip":true}'}}]});};
 await assert.rejects(createEditorialDraft({topic:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',category:'clubnieuws',primaryAuthority:'club_decision',facts,sourceUrls:['https://peczwolle.nl/nieuws/besluit'],automaticPublication:true},
 {apiKey:'fake',model:'openai/gpt-oss-120b',fetcher,timeoutMs:20000}),error=>error.status===422);
 assert.equal(requests.length,2);
 assert.match(requests[1].messages.at(-1).content,/Controleer of je skip ten onrechte hebt gekozen/);
 assert.ok(JSON.stringify(requests[1].messages).includes('Alex Pastoor'));
});
test('V107 thin or unverified source never receives a forced writer retry',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 let calls=0;
 await assert.rejects(createEditorialDraft({topic:'Onbevestigd trainersnieuws',category:'clubnieuws',primaryAuthority:'club_decision',facts:['Onbevestigd gerucht.'],sourceUrls:['https://peczwolle.nl/nieuws/besluit'],automaticPublication:true},
 {apiKey:'fake',model:'openai/gpt-oss-120b',fetcher:async()=>{calls++;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});}}),error=>error.status===422);
 assert.equal(calls,1);
});

test('V108 only one lead/body duplication reaches the specialist, not the publisher or any other failed gate',()=>{
 const {mayDelegateLeadOverlap}=require('../editorial-ai');
 const overlap='Intro en alinea’s herhalen te veel dezelfde inhoud. Gebruik per alinea andere aangeleverde feiten.';
 assert.equal(mayDelegateLeadOverlap([overlap],{automaticPublication:true,coachPlan:true}),true);
 assert.equal(mayDelegateLeadOverlap([overlap,'Niet-geverifieerde claim.'],{automaticPublication:true,coachPlan:true}),false);
 assert.equal(mayDelegateLeadOverlap([overlap],{automaticPublication:true,coachPlan:false}),false);
 assert.equal(mayDelegateLeadOverlap([overlap],{automaticPublication:false,coachPlan:true}),false);
 assert.equal(mayDelegateLeadOverlap(['Woordelijke bronoverlap.'],{automaticPublication:true,coachPlan:true}),false);
});

test('English rewrite is rejected while Dutch reporting with foreign club names remains eligible',()=>{
 const {generationIssues}=require('../editorial-ai');
 const english={headline:'Alex Pastoor appointed head coach of PEC Zwolle',standfirst:'PEC Zwolle confirms Alex Pastoor as head coach with a contract for the next campaign.',body:['According to the club, the coaching staff will include the existing coaches who resume their positions with the team. Their responsibilities will be defined by the club.']};
 assert.ok(generationIssues(english,[]).some(issue=>issue.includes('Engelstalig')));
 const dutch={headline:'PEC Zwolle bevestigt de komst van Alex Pastoor',standfirst:'De club meldt dat de trainer maandag begint.',body:['Volgens de club keren de assistenten terug in hun eigen functie. De club heeft de verdeling van de taken bekendgemaakt. Liverpool en Manchester City worden hier alleen als clubnamen genoemd.']};
 assert.ok(!generationIssues(dutch,[]).some(issue=>issue.includes('Engelstalig')));
});

test('first-party source attribution can be restored without changing official facts or accepting invented names',()=>{
 const {attachVerifiedOfficialAttribution,editorialAttributionIssues,generationIssues}=require('../editorial-ai');
 const sourceUrls=['https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/'];
 const facts=['FC Groningen meldt dat de club een schikkingsvoorstel heeft geaccepteerd.'];
 const draft={headline:'Club accepteert voorstel voor een speler',standfirst:'De club heeft het voorstel voor een speler geaccepteerd.',body:['Het voorstel is geaccepteerd en de club heeft dit officieel bekendgemaakt.']};
 const options={primaryAuthority:'club_decision',sourceUrls,facts};
 assert.equal(editorialAttributionIssues(draft,options).length,1);
 const fixed=attachVerifiedOfficialAttribution(draft,options);
 assert.equal(fixed.standfirst,'De club heeft het voorstel voor een speler geaccepteerd. Dat meldt FC Groningen.');
 assert.deepEqual(editorialAttributionIssues(fixed,options),[]);
 assert.ok(!generationIssues(fixed,facts).some(issue=>issue.includes('Controleer namen')));
 assert.equal(draft.standfirst,'De club heeft het voorstel voor een speler geaccepteerd.');
 assert.equal(attachVerifiedOfficialAttribution(draft,{...options,facts:['Het voorstel is geaccepteerd.']}),draft);
 assert.equal(attachVerifiedOfficialAttribution(draft,{...options,primaryAuthority:null}),draft);
 assert.equal(attachVerifiedOfficialAttribution(draft,{...options,sourceUrls:['https://untrusted.example/news']}),draft);
});
