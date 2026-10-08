import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfActionRetryMessage} from '../src/pdf-action-feedback.js';

const translate=(en,es)=>es;

test('PDF failure tells the user which action to repeat, in Spanish',()=>{
  for(const [action,label] of [['view','Ver PDF'],['download','Descargar PDF'],['share','Compartir PDF']]){
    const message=pdfActionRetryMessage(action,'Load fail',translate);
    assert.ok(message.includes(label));
    assert.ok(message.includes('otra vez para reintentarlo'));
    assert.ok(message.includes('Load fail'));
  }
});

test('PDF failure guidance also supports English and missing details',()=>{
  const english=pdfActionRetryMessage('download','',en=>en);
  assert.ok(english.includes('Download PDF'));
  assert.ok(english.includes('again to retry'));
  assert.ok(!english.includes('Details:'));
});

test('unknown PDF actions use a safe generic label',()=>{
  assert.ok(pdfActionRetryMessage('other','network error',translate).includes('acción del PDF'));
});
