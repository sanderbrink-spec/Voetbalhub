'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {oranjeDrawGroup} = require('../scripts/editorial-oranje-draw');
const {validateEvidence} = require('../scripts/automatic-publication');

const now = Date.parse('2026-11-20T16:00:00Z');
const knvb = {
  url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/loting',
  title:'Oranje tegen Portugal in kwartfinale Nations League', publishedAt:'2026-11-20T12:00:00Z',
  text:'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal. Dat werd vrijdag bepaald tijdens de loting in Nyon. De wedstrijden worden in maart gespeeld. De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.'
};
const uefa = {
  url:'https://www.uefa.com/uefanationsleague/news/02ab-example--knockout-ties/',
  publishedAt:'2026-11-20T12:10:00Z', title:'UEFA Nations League draw results',
  text:'Knockout stage draw results Quarter-final ties Germany vs Belgium Netherlands vs Portugal The quarter-finals are two-legged ties in March. Semi-final ties Netherlands/Portugal vs Spain/France.'
};
test('gepaarde lotingsbeslissing doorloopt de normale bewijscontrole, ook met vertaalde landnaam', () => {
  for (const [nl,en] of [['Portugal','Portugal'],['Frankrijk','France']]) {
    const national = {...knvb,title:knvb.title.replaceAll('Portugal',nl),text:knvb.text.replaceAll('Portugal',nl)};
    const organiser = {...uefa,text:uefa.text.replaceAll('Portugal',en)};
    const group = oranjeDrawGroup(national,[organiser],now);
    assert.deepEqual(group.drawCandidate.teams,['Nederland',nl]);
    assert.equal(group.drawCandidate.facts.length,4);
    assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
    assert.ok(validateEvidence(group.drawCandidate,[national,{...organiser,text:'Zonder lotingslijst'}],now).length);
  }
});
test('verschillende tegenstanders, rondes en conflicterende lotingen leveren geen nieuw dossier op', () => {
  for (const text of [
    uefa.text.replace('Netherlands vs Portugal','Spain vs Portugal'),
    uefa.text.replace('Quarter-final ties','Semi-final ties'),
    uefa.text.replace('Netherlands vs Portugal','Portugal vs Netherlands'),
    uefa.text.replace('Germany vs Belgium','Germany vs Netherlands'),
    uefa.text.replace('Netherlands vs Portugal','Netherlands vs Spain').concat(' Netherlands vs Portugal'),
  ]) assert.equal(oranjeDrawGroup(knvb,[{...uefa,text}],now),null);
});
test('beide actuele officiële bronnen, een eenduidige beslissing en voldoende context zijn vereist', () => {
  for (const [national,organiser] of [
    [{...knvb,text:knvb.text.replace('tegen Portugal','mogelijk tegen Portugal')},uefa],
    [{...knvb,text:knvb.text.replace('return wordt gespeeld in Portugal','return wordt gespeeld in Spanje')},uefa],
    [{...knvb,text:knvb.text.split('. ').slice(0,2).join('. ')+'.'},uefa],
    [{...knvb,url:knvb.url.replace('mannen','vrouwen')},uefa],
    [knvb,{...uefa,url:uefa.url.replace('uefa.com','uefa.com.example.org')}],
    [knvb,{...uefa,publishedAt:'2026-11-18T12:00:00Z'}],
    [{...knvb,publishedAt:'2026-11-14T12:00:00Z'},uefa],
    [knvb,{...uefa,publishedAt:'2026-11-21T12:00:00Z'}],
  ]) assert.equal(oranjeDrawGroup(national,[organiser],now),null);
});

test('ontdekking telt twee bevestigingen als één onderwerp zonder verliesmelding', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const initial = process.cwd();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'veldio-draw-'));
  process.chdir(temporary);
  t.after(() => { process.chdir(initial); fs.rmSync(temporary,{recursive:true,force:true}); });
  const {run} = require('../scripts/automatic-publication');
  const nationalIndex = 'https://www.onsoranje.nl/knvb_node/categorie/nederlands-elftal-mannen';
  const organiserIndex = 'https://www.uefa.com/uefanationsleague/';
  const page = doc => {
    const body = '<h1>'+doc.title+'</h1><p>'+doc.text+'</p><p>'+('Toernooidocumentatie. '.repeat(8))+'</p>';
    const article = doc === knvb ? '<div class="Template--article">'+body+'<div class="PageTags"></div></div>' : '<article>'+body+'</article>';
    return '<meta property="article:published_time" content="'+doc.publishedAt+'">'+article;
  };
  const pages = new Map([[nationalIndex,'<a href="'+knvb.url+'">Loting</a>'],[organiserIndex,'<a href="'+uefa.url+'">Draw</a>'],[knvb.url,page(knvb)],[uefa.url,page(uefa)]]);
  const fetcher = async url => {
    if (pages.has(url)) return new Response(pages.get(url));
    if (url.endsWith('/articles?view=all')) return Response.json({articles:[]});
    return Response.json({},{status:404});
  };
  const r = await run({now,fetcher,expectedRevision:null,secret:'test',githubToken:'test',discoveryOnly:true});
  assert.equal(r.counts.uniqueGroups,1);
  assert.equal(r.counts.noCorroboration,0);
  assert.equal(r.signals.find(s=>s.url===uefa.url).outcome,'used_as_draw_evidence');
  assert.equal(r.counts.aiRequests,0);
  assert.equal(r.counts.publicationAttempts,0);
});
