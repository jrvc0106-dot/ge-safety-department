import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeMemberEmail} from '../src/team-identity.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('sign-up accepts valid emails outside the company domain and leaves access approval to an admin',async()=>{
 const values={name:'Field Worker',email:'  worker@example.org ',password:'safe-password'};
 const calls=[],errors=[],button={disabled:false,textContent:'Create Account',attributes:{},setAttribute(n,v){this.attributes[n]=v},removeAttribute(n){delete this.attributes[n]}};
 const form={dataset:{},querySelector:selector=>selector==='.auth-submit'?button:null};
 const controls={'#language':{},'#mode':{},'#toggle-password':{},'#auth-password':{}};
 const document={querySelector:selector=>selector==='#login'?form:(controls[selector]||null)};
 const context=vm.createContext({
  app:{set innerHTML(value){}},document,state:{lang:'en'},tr:en=>en,normalizeMemberEmail,
  FormData:function(){this.get=name=>values[name]},
  db:{auth:{signUp:async payload=>{calls.push(payload);return {data:{session:{user:{id:'new-user'}}},error:null}}}},
  error:err=>errors.push(err.message)
 });
 const start=source.indexOf('function login('),end=source.indexOf('\nfunction forgotPassword',start);
 assert.ok(start>=0&&end>start,'login handler is present');
 vm.runInContext(source.slice(start,end)+'\nglobalThis.renderLogin=login;',context);
 context.renderLogin('signUp');
 await form.onsubmit({currentTarget:form,preventDefault(){}});
 assert.equal(calls.length,1);
 assert.equal(calls[0].email,'worker@example.org');
 assert.equal(calls[0].options.data.name,'Field Worker');
 assert.deepEqual(errors,[]);
 assert.equal(button.disabled,false);
 assert.equal(form.dataset.authBusy,undefined);
});
