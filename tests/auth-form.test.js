import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('a failed sign-in is reported and the form is restored for retry',async()=>{
 const messages=[],values={email:'worker@geflcontractors.com',password:'test-password'};
 const button={disabled:false,textContent:'Sign In',attributes:{},setAttribute(name,value){this.attributes[name]=value},removeAttribute(name){delete this.attributes[name]},hasAttribute(name){return name in this.attributes}};
 const form={dataset:{},querySelector:selector=>selector==='.auth-submit'?button:null};
 const controls={'#language':{},'#mode':{},'#forgot':{}};
 const document={querySelector:selector=>selector==='#login'?form:(controls[selector]||null)};
 const context=vm.createContext({
  app:{set innerHTML(value){}},document,FormData:function(){this.get=name=>values[name]},
  state:{lang:'en'},tr:en=>en,
  db:{auth:{signInWithPassword:async()=>{throw new TypeError('Failed to fetch')}}},
  error:err=>messages.push(err.message)
 });
 const start=source.indexOf('function login('),end=source.indexOf('\nfunction forgotPassword',start);
 assert.ok(start>=0&&end>start,'login handler is present');
 vm.runInContext(source.slice(start,end)+'\nglobalThis.renderLogin=login;',context);
 context.renderLogin();
 const event={currentTarget:form,preventDefault(){}};
 await form.onsubmit(event);
 assert.deepEqual(messages,['Failed to fetch']);
 assert.equal(button.disabled,false);
 assert.equal(button.hasAttribute('aria-busy'),false);
 assert.equal(button.textContent,'Sign In');
 assert.equal(form.dataset.authBusy,undefined);
});
