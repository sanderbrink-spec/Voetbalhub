'use strict';
// Known venue aliases are used solely to verify home-club stadium assignment.
// Never infer a match venue from team colors, a scoreboard, or opponent names.
const names={
 'adodenhaag':['Werktalent Stadion','Bingoal Stadion','Cars Jeans Stadion'],
 'ajax':['Johan Cruijff Arena','Amsterdam Arena'],
 'az':['AFAS Stadion'],
 'excelsiorrotterdam':['Van Donge & De Roo Stadion','Woudestein','Stadion Woudestein'],
 'fcgroningen':['Euroborg'],
 'fctwente':['De Grolsch Veste','Grolsch Veste'],
 'fcutrecht':['Stadion Galgenwaard','Galgenwaard'],
 'feyenoord':['De Kuip','Stadion Feijenoord'],
 'fortunasittard':['Fortuna Sittard Stadion','Fortuna Stadion'],
 'goaheadeagles':['De Adelaarshorst','Adelaarshorst'],
 'necnijmegen':['Goffertstadion','De Goffert','Goffert Stadion'],
 'peczwolle':['MAC3PARK Stadion','PEC Zwolle Stadion'],
 'psv':['Philips Stadion'],
 'sccambuur':['Kooi Stadion','Cambuur Stadion'],
 'scheerenveen':['Abe Lenstra Stadion'],
 'spartarotterdam':['Het Kasteel','Sparta Stadion Het Kasteel'],
 'telstar':['711 Stadion','BUKO Stadion','Schoonenberg Stadion'],
 'willemii':['Koning Willem II Stadion','Willem II Stadion']
};
const norm=s=>{const key=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');return key==='azalkmaar'?'az':key;};
const aliases=(club)=>names[norm(club)]||[];
function safeHomeVenue(club,venueIdentity='',venueName=''){
 const wanted='home:'+norm(club);
 if(venueIdentity===wanted)return true;
 if(!venueIdentity.startsWith('venue:'))return false;
 const exact=venueIdentity.slice(6);
 const accepted=aliases(club).map(norm);
 // A numeric provider venue ID alone is insufficient: verify the name too.
 return accepted.includes(exact)||Boolean(venueName&&accepted.includes(norm(venueName)));
}
function allowedForMatch(asset,ctx){
 if(!asset||!ctx||!['preview','report'].includes(ctx.category))return false;
 const kind=ctx.category,occupancy=kind==='report'?'full':'empty';
 const home=ctx.clubs?.[0],away=ctx.clubs?.[1];
 if(!home||!away||asset.imageKind!==kind||asset.stadiumOccupancy!==occupancy)return false;
 const identity=ctx.stadiumIdentity||'home:'+norm(home);
 const known=safeHomeVenue(home,identity,ctx.venueName);
 const reviewedAlias=asset.homeClubReusable===true && Array.isArray(asset.homeVenueAliases) &&
  identity.startsWith('venue:') && asset.homeVenueAliases.some(name=>
   identity==='venue:'+norm(name)||(ctx.venueName&&norm(ctx.venueName)===norm(name)));
 if(asset.stadiumIdentity!=='home:'+norm(home)||(!known&&!reviewedAlias))return false;
 if(asset.homeClubReusable===true){
  return !asset.fixtureId&&asset.clubs?.length===2&&asset.clubs[1]==='*'&&norm(asset.clubs[0])===norm(home);
 }
 return asset.clubs?.length===2&&norm(asset.clubs[0])===norm(home)&&norm(asset.clubs[1])===norm(away);
}
module.exports={names,norm,aliases,safeHomeVenue,allowedForMatch};
