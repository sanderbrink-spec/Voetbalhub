'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('every contact-page bridge action has an Android JavascriptInterface, including native submission',()=>{
 const html=fs.readFileSync('android-ui/assets/contact.html','utf8'),java=fs.readFileSync('android-ui/java/ContactView.java','utf8');
 const methods=new Set([...html.matchAll(/contact\('([A-Za-z]+)'/g)].map(x=>x[1]));
 for(const match of html.matchAll(/ContactHub\.([A-Za-z]+)\(/g))methods.add(match[1]);
 assert.ok(methods.has('submit'));
 for(const method of methods)assert.match(java,new RegExp('@JavascriptInterface\\s+public void '+method+'\\(String '),'Missing Android bridge: '+method);
 assert.match(fs.readFileSync('scripts/patch-navigation-contact.py','utf8'),/new ContactView\(this,contactDraft,this::onBackPressed,EDITORIAL_API_URL\)/);
});
