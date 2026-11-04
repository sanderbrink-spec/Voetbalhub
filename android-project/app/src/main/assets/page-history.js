(function(root){'use strict';
class PageTrail{
 constructor(){this.entries=[];}
 push(state){this.entries.push(JSON.parse(JSON.stringify(state)));if(this.entries.length>40)this.entries.shift();}
 pop(){return this.entries.pop()||null;}
 restore(raw){const parsed=typeof raw==='string'?JSON.parse(raw):raw;if(!parsed||!parsed.current||!Array.isArray(parsed.entries))return null;this.entries=parsed.entries.slice(-40);return {...parsed.current,scrollY:parsed.scrollY??parsed.current.scrollY??0};}
 capture(current){const value={current,entries:this.entries};if(root.PageHistory?.update)root.PageHistory.update(JSON.stringify(value));return value;}
}
if(typeof module==='object'&&module.exports)module.exports=PageTrail;else root.PageTrail=PageTrail;
})(typeof window==='undefined'?globalThis:window);
