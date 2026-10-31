'use strict';
const NAME='Veldio',TAGLINE='Alles voetbal. Eén plek.';
const ORIGIN='https://voetbalhub-redactie.onrender.com';
const MEDIA='https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/';
function text(value){return typeof value==='string'?value.replace(/VoetbalHub/g,NAME).replace(/VOETBALHUB/g,'VELDIO').replace(/Alles voetbal\. Eén hub\./g,TAGLINE):value;}
function ownMedia(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.startsWith(MEDIA);}catch{return false;}}
function article(value){
 const row={...value};
 for(const key of ['author','headline','standfirst','why_it_matters','imageSource','imageCredit','category'])row[key]=text(row[key]);
 if(Array.isArray(row.body))row.body=row.body.map(text);
 if(Array.isArray(row.blocks))row.blocks=row.blocks.map(block=>({...block,text:text(block.text)}));
 const known=require('./article-covers.json').find(x=>x.reviewed&&x.contentHash===require('./article-covers').contentHash(value));
 if(known&&(!row.imageUrl||row.imageUrl.includes('/'+known.file)))row.imageUrl=known.imageUrl;
 else if(row.imageReview?.method==='fixture-specific-stadium-and-logos-v4'&&ownMedia(row.imageUrl)) {
  const kind=(String(row.imageReview.notes||'').match(/beeldafspraak:\s*(preview|report)\./)||[])[1]||'';
  row.imageUrl=ORIGIN+'/brand/fixture-image?style=2&kind='+kind+'&label='+encodeURIComponent(row.category||'Voetbal')+'&source='+encodeURIComponent(row.imageUrl);
 }
 return row;
}
module.exports={NAME,TAGLINE,ORIGIN,MEDIA,text,article,ownMedia};
