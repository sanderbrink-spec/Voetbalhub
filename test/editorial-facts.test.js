const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../editorial-facts');
function packet(){return {draft:{headline:'FC Groningen wint van Ajax',standfirst:'FC Groningen won het duel tegen Ajax.',body:[]},verifiedFacts:['FC Groningen speelde thuis tegen Ajax op 2026-10-29. De eindstand thuis-uit was 2-0.'],match:{homeTeam:'FC Groningen',awayTeam:'Ajax',homeScore:2,awayScore:0,playedAt:'2026-10-29'},factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};}
test('coherent result and manually checked match packet passes fact comparison',()=>assert.deepEqual(F.audit(packet()),[]));
test('score reversal cannot pass just because the individual digits occur in facts',()=>{const p=packet();p.draft.standfirst='De eindstand was 0-2.';assert.ok(F.audit(p).some(x=>x.includes('Uitslag of tussenstand')));});
test('a losing team cannot be called the winner in the headline',()=>{const p=packet();p.draft.headline='Ajax wint van FC Groningen';assert.ok(F.audit(p).some(x=>x.includes('verliezende ploeg')));});
test('draw versus victory contradictions are blocked against structured result',()=>{const p=packet();p.draft.headline='FC Groningen speelt gelijk tegen Ajax';assert.ok(F.audit(p).some(x=>x.includes('een winnaar')));p.match.awayScore=2;p.draft.headline='FC Groningen wint van Ajax';assert.ok(F.audit(p).some(x=>x.includes('een gelijkspel')));});
test('weekdays and dates must agree with the match anchor and recorded facts',()=>{const p=packet();p.draft.standfirst='FC Groningen won vrijdag het duel.';assert.ok(F.audit(p).some(x=>x.includes('weekdag')));p.match.playedAt='2026-10-28';assert.ok(F.audit(p).some(x=>x.includes('wijkt af van de datum')));});
test('invalid calendar dates and missing score fields stay blocked',()=>{const p=packet();p.match.playedAt='2026-02-31';assert.ok(F.audit(p).some(x=>x.includes('leg thuisploeg')));p.match.homeScore=null;assert.ok(F.audit(p).some(x=>x.includes('leg thuisploeg')));});
test('invented people and quotes are flagged separately from writing style',()=>{const p=packet();p.draft.body=['Joey Veerman verklaarde: "Ik beslis altijd iedere wedstrijd voor mijn ploeg."'];const issues=F.audit(p);assert.ok(issues.some(x=>x.includes('Joey Veerman')));assert.ok(issues.some(x=>x.includes('Citaat')));});
test('a verified country adjective is not a person and requires country evidence',()=>{
 const draft={headline:'Oranje houdt stand',body:['De Duitse ploeg hield stand.']};
 assert.deepEqual(F.evidenceIssues(draft,['Duitsland speelde tegen Nederland.']),[]);
 assert.ok(F.evidenceIssues(draft,['Nederland speelde tegen België.']).some(issue=>issue.includes('De Duitse')));
 draft.body.push('Karl Onbekend speelde mee.');
 assert.ok(F.evidenceIssues(draft,['Duitsland speelde tegen Nederland.']).some(issue=>issue.includes('Karl Onbekend')));
});
test('a score alone cannot justify a comeback, dominance or detailed half-time story',()=>{const p=packet();p.draft.body=['Ajax domineerde in de eerste helft, maar Groningen knokte terug na een achterstand.'];const issues=F.audit(p);assert.ok(issues.some(x=>x.includes('dominantie')));assert.ok(issues.some(x=>x.includes('comeback')));assert.ok(issues.some(x=>x.includes('per helft')));});
test('a factual half-time story is allowed when that detail was actually supplied',()=>{const p=packet();p.verifiedFacts.push('FC Groningen had voor rust overwicht.');p.draft.body=['FC Groningen had voor rust overwicht.'];assert.deepEqual(F.audit(p),[]);});
test('individual factual acknowledgements cannot be replaced by the old general checkbox',()=>{const p=packet();p.factChecks={};p.editorialChecks={claimsIndependentlyChecked:true};assert.equal(F.audit(p).filter(x=>x.includes('Feitencontrole ontbreekt')).length,4);});
test('transfer language and clock times do not masquerade as a match result',()=>{assert.equal(F.needsMatch({headline:'Club wint strijd om een nieuwe speler',body:['De presentatie begint om 18:00 uur.']}),false);});
test('names cannot be accidentally combined across a headline and intro boundary',()=>{const p=packet();p.draft.headline='FC Groningen wint van Ajax';p.draft.standfirst='Groningen won het duel.';assert.ok(!F.audit(p).some(x=>x.includes('Ajax Groningen')));});

test('sentence starters before club names do not become invented people',()=>{
 const {evidenceIssues}=require('../editorial-facts');
 assert.deepEqual(evidenceIssues({headline:'Voor Ajax staat een Europese reis gepland',standfirst:'Volgens FC Midtjylland is de wedstrijd toegankelijk met een geldig kaartje.',body:[]},['Ajax speelt tegen FC Midtjylland in een Europese competitie. De wedstrijd is toegankelijk met een geldig kaartje.']),[]);
 assert.ok(evidenceIssues({headline:'Ajax benoemt Piet Onbekend tot nieuwe trainer',standfirst:'',body:[]},['Ajax bespreekt plannen.']).some(x=>x.includes('Piet Onbekend')));
});

test('Eredivisie phrasing is not an invented person, but unverified names still fail',()=>{
 const p=packet();
 p.draft.body=['De Eredivisie-wedstrijd tussen FC Groningen en Ajax werd beslist. In de Eredivisie-speelronde speelde FC Groningen thuis.'];
 assert.ok(!F.audit(p).some(x=>x.includes('De Eredivisie-wedstrijd')||x.includes('In de Eredivisie-speelronde')));
 p.draft.body.push('Abe Lenstra was bij het duel betrokken.');
 assert.ok(F.audit(p).some(x=>x.includes('Abe Lenstra')));
});


test('98T official UEFA League A facts support Dutch country names and competition name only when proven',()=>{
 const statusUrl='https://www.uefa.com/uefanationsleague/news/02ab-22096ba64f4d-f179d6d05013-1000--nations-league-quarter-finals-who-is-through/';
 const facts=[
  'Group A1 France (13pts), Belgium (12), Italy (10), Türkiye (0)',
  'France are confirmed in first place and have qualified for the quarter-finals.',
  'Belgium are confirmed in second place and have qualified for the quarter-finals.'
 ];
 const verified={headline:'Nations League: Frankrijk en België weten waar zij staan',
  standfirst:'Zowel Frankrijk als België is volgens de officiële UEFA-status geplaatst voor de kwartfinales.',
  body:[]};
 const issues=F.evidenceIssues(verified,facts,null,statusUrl);
 assert.ok(!issues.some(x=>x.includes('Controleer namen')),issues.join(' | '));
 const invented={...verified,standfirst:'Zowel Japan als België is volgens de UEFA-status geplaatst.'};
 assert.ok(F.evidenceIssues(invented,facts,null,statusUrl).some(x=>x.includes('Zowel Japan')));
 const fakeSource='https://www.ajax.nl/artikelen/uefa-status';
 const fakeErrors=F.evidenceIssues(verified,facts,null,fakeSource).join(' ');
 assert.ok(fakeErrors.includes('Nations League')||fakeErrors.includes('Zowel Frankrijk'));
 const unrelated={...verified,standfirst:'Zowel Kevin Mbappé als België is volgens de UEFA-status geplaatst.'};
 assert.ok(F.evidenceIssues(unrelated,facts,null,statusUrl).some(x=>x.includes('Zowel Kevin')));
});

test('98Y: Dutch country adjective requires Nederland in verified facts',()=>{
 const draft={headline:'Oranje verliest van Duitsland',standfirst:'De Nederlandse ploeg verloor.',body:[]};
 assert.ok(!F.evidenceIssues(draft,['Nederland verloor van Duitsland.']).some(x=>x.includes('De Nederlandse')));
 assert.ok(F.evidenceIssues(draft,['België verloor van Duitsland.']).some(x=>x.includes('De Nederlandse')));
 draft.body=['Kevin Onbekend scoorde.'];
 assert.ok(F.evidenceIssues(draft,['Nederland verloor van Duitsland.']).some(x=>x.includes('Kevin Onbekend')));
});
test('98Y: KNVB publisher attribution requires verified official host',()=>{
 const draft={headline:'Oranje verliest van Duitsland',standfirst:'De KNVB meldt de uitslag.',body:[]};
 const facts=['Nederland verloor van Duitsland.'];
 const official='https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82839/uitslag';
 assert.ok(!F.evidenceIssues(draft,facts,null,official).some(x=>x.includes('De KNVB')));
 assert.ok(F.evidenceIssues(draft,facts,null,'').some(x=>x.includes('De KNVB')));
});


test('99C-3: a verified UEFA league-division opener is grammar, not a fabricated proper name',()=>{
 const url='https://www.uefa.com/uefanationsleague/news/02ab-22096ba64f4d-f179d6d05013-1000--nations-league-quarter-finals-last-eight-confirmed/';
 const facts=[
  'Group A1 France (13pts), Belgium (12), Italy (10), Türkiye (0)',
  'League A status and quarter-final qualification are confirmed.',
  'France are confirmed in first place and have qualified for the quarter-finals.'
 ];
 const draft={
  headline:'UEFA bevestigt plaatsen voor de kwartfinales van de Nations League',
  standfirst:'UEFA heeft de groepsstatus bekendgemaakt.',
  body:['In League A zijn de officiële groepsposities bekend.']
 };
 const issues=F.evidenceIssues(draft,facts,null,url);
 assert.ok(!issues.some(x=>x.includes('In League')),issues.join(' | '));
 const unverified={...draft,body:['In League B is een plaats in de kwartfinales bevestigd.']};
 assert.ok(F.evidenceIssues(unverified,facts,null,url).some(x=>x.includes('In League')));
 const invented={...draft,body:['In League A heeft Karl Onbekend een plaats veiliggesteld.']};
 assert.ok(F.evidenceIssues(invented,facts,null,url).some(x=>x.includes('Karl Onbekend')));
 assert.ok(F.evidenceIssues(draft,facts,null,'https://www.ajax.nl/artikelen/competitie').some(x=>x.includes('In League')));
});


test('99C-5: official UEFA Nations League label is not an unverified person',()=>{
 const f=['Iceland are confirmed in first place and will be promoted to League B.',
  'Group C4 Iceland (14pts), Estonia (12), Bulgaria (4), Luxembourg (3)'];
 const official='https://www.uefa.com/uefanationsleague/news/02ab-2209792f2fda-6a523d4500bb-1000--2026-27-nations-league-quarter-final-qualification-promotion/';
 const draft={headline:'IJsland promoveert officieel in de UEFA Nations League',
  standfirst:'Volgens de UEFA Nations League-status is IJsland als groepswinnaar bevestigd.',
  body:['UEFA Nations League is de competitie van deze officiële bekendmaking.']};
 const valid=F.evidenceIssues(draft,f,null,official).join('|');
 assert.ok(!valid.includes('UEFA Nations'),valid);
 const fake=F.evidenceIssues(draft,f,null,'https://www.ajax.nl/artikelen/official-status').join('|');
 assert.ok(fake.includes('UEFA Nations'),fake);
 const invented={...draft,body:['De UEFA Nations League heeft bericht uitgebracht. Pierre Onbekend bevestigt promotie.']};
 assert.ok(F.evidenceIssues(invented,f,null,official).some(x=>x.includes('Pierre Onbekend')));
 const withoutLeague={...draft,body:['UEFA Nations bevestigt promotie.'],standfirst:'De UEFA heeft het besluit aangekondigd.',headline:'De UEFA meldt de promotie van IJsland'};
 assert.ok(F.evidenceIssues(withoutLeague,f,null,official).some(x=>x.includes('UEFA Nations')));
});
