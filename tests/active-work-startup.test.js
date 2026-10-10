import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const initialization=source.match(/const activeWorkTime=db\?installActiveWorkTime\([^\n]+/)[0];
test('app startup tolerates unloaded, partial and mismatched authentication state',()=>{
 for(const state of [
 {session:null,profile:null,project:null},
 {session:{user:{id:'u'}},profile:null,project:'p'},
 {session:null,profile:{id:'u'},project:'p'},
 {session:{user:{id:'u'}},profile:{id:'other'},project:'p'},
 {session:{user:{id:'u'}},profile:{id:'u'},project:'p'}
 ]){
 let actual;
 const installActiveWorkTime=({getContext})=>{actual=getContext();return {}};
 assert.doesNotThrow(()=>new Function('db','window','document','state','installActiveWorkTime',initialization)({}, {}, {},state,installActiveWorkTime));
 assert.equal(actual.userId,state.session?.user?.id&&state.session.user.id===state.profile?.id?'u':null);
 }
});
