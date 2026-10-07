import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterAiReportDraftSuggestions} from '../src/ai-report-drafts.js';

test('accepts only requested narrative fields within their character limits',()=>{
 const requested=[{name:'hazard_3',max_length:1200},{name:'corrective_action',max_length:500}];
 const result=filterAiReportDraftSuggestions(requested,[
  {field_name:'hazard_3',text:'Worker observed without required eye protection.'},
  {field_name:'corrective_action',text:'Work stopped.'},
  {field_name:'overall_status',text:'safe'}
 ]);
 assert.deepEqual(result,[
  {field_name:'hazard_3',text:'Worker observed without required eye protection.'},
  {field_name:'corrective_action',text:'Work stopped.'}
 ]);
});

test('rejects duplicate, blank, unrequested and over-limit suggestions',()=>{
 const requested=[{name:'description',max_length:8}];
 const result=filterAiReportDraftSuggestions(requested,[
  {field_name:'description',text:'Fact'},
  {field_name:'description',text:'Another fact'},
  {field_name:'description',text:'   '},
  {field_name:'immediate_action',text:'Unrequested'},
  {field_name:'description',text:'This is too long'}
 ]);
 assert.deepEqual(result,[{field_name:'description',text:'Fact'}]);
});

test('returns no suggestions for malformed result data',()=>{
 assert.deepEqual(filterAiReportDraftSuggestions([],null),[]);
 assert.deepEqual(filterAiReportDraftSuggestions(null,[{field_name:'x',text:'y'}]),[]);
});
