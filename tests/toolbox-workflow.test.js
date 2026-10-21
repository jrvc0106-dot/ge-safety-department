import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {TOOLBOX_TOPIC_GROUPS,TOOLBOX_TOPICS,toolboxTopicLabels,toolboxWeatherText,mountToolboxWorkflow} from '../src/toolbox-workflow.js';

const tr=(en)=>en;
function fixture(config={}){
 const dom=new JSDOM('<main><form id="st-toolbox-form"><label>Weather<input name="weather"></label><label>Topic<input name="topic"></label><label>Language<input name="language"></label><label>Duration<input name="duration"></label><label>Instructor<input name="instructor"></label><label>Topics discussed<textarea name="topics"></textarea></label><label>Photos<input type="file" name="photos" multiple></label></form></main>',{url:'https://app.example.test'});
 const form=dom.window.document.querySelector('form'),revoked=[];
 dom.window.URL.createObjectURL=()=> 'blob:toolbox-'+Math.random().toString(36).slice(2);
 dom.window.URL.revokeObjectURL=url=>revoked.push(url);
 const ui=mountToolboxWorkflow(form,{tr,loadInstructors:async()=>config.instructors||[],getWeather:async()=>config.weather||null,getPhotos:async(_,removeIndex)=>{
  if(removeIndex!==null&&removeIndex!==undefined)config.photos?.splice(removeIndex,1);
  return config.photos||[];
 }});
 return {dom,form,ui,revoked};
}

test('OSHA-inspired Toolbox catalog has broad subjects in distinct groups, with custom topic support',()=>{
 assert.ok(TOOLBOX_TOPIC_GROUPS.length>=6);
 assert.ok(TOOLBOX_TOPICS.length>=40);
 const ids=TOOLBOX_TOPICS.map(t=>t[0]);assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(toolboxTopicLabels(['falls','mot'],'es','Manejo de materiales'),['Protección contra caídas','Control de tránsito en zona de trabajo / MOT','Manejo de materiales']);
});

test('Toolbox topics allow multiple choices and generate only actually checked discussion points',async()=>{
 const t=fixture(),{form,dom,ui}=t;await ui.start();
 assert.ok(form.querySelectorAll('[data-toolbox-topic]').length>=40);
 const falls=form.querySelector('[data-toolbox-topic="falls"]'),cranes=form.querySelector('[data-toolbox-topic="cranes"]');
 falls.checked=true;falls.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 cranes.checked=true;cranes.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.match(form.elements.topic.value,/Fall protection/);assert.match(form.elements.topic.value,/Crane operations/);
 assert.equal(form.querySelector('[data-topic-group="falls"]').hidden,false);
 assert.equal(form.querySelector('[data-topic-group="cranes"]').hidden,false);
 assert.equal(form.querySelector('[data-topic-group="noise"]').hidden,true);
 const first=form.querySelector('[data-discussion-topic="falls"]');
 first.checked=true;first.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.match(form.elements.topics.value,/Identify exposed edges/);
 assert.doesNotMatch(form.elements.topics.value,/Inspect lifts, rigging/);
 const selected=ui.collect();assert.equal(selected.topic_ids.length,2);assert.equal(selected.discussion_points.length,1);
 const data=new dom.window.FormData(form);assert.match(data.get('topic'),/Fall protection/);
 assert.match(form.elements.topics.dataset.aiContext,/Crane operations/);
 dom.window.close();
});

test('selecting Spanish changes reportable topic text and suggested points, but keeps manually authored notes',async()=>{
 const t=fixture(),{form,dom,ui}=t;await ui.start();
 const falls=form.querySelector('[data-toolbox-topic="falls"]');falls.checked=true;falls.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 const point=form.querySelector('[data-discussion-topic="falls"]');point.checked=true;point.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 form.elements.language.value='es';form.elements.language.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.match(form.elements.topic.value,/Protección contra caídas/);
 assert.match(form.elements.topics.value,/Identificar bordes/);
 form.elements.topics.value='Texto comprobado por el instructor';
 form.elements.topics.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 const ladders=form.querySelector('[data-toolbox-topic="ladders"]');ladders.checked=true;ladders.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(form.elements.topics.value,'Texto comprobado por el instructor');
 assert.match(form.elements.topics.dataset.aiContext,/Spanish/);
 dom.window.close();
});

test('Safety instructors populate from registered Safety accounts; free text remains optional',async()=>{
 const t=fixture({instructors:[{id:'one',name:'Safety One',position:'Safety'},{id:'two',name:'Safety Director',position:'Safety Director'}]});
 const {form,dom,ui}=t;await ui.start();
 const select=form.elements.namedItem('toolbox_instructor_choice');
 assert.equal(select.options.length,3);
 select.value='one';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.match(form.elements.instructor.value,/Safety One/);
 form.elements.toolbox_instructor_other.value='Guest Instructor';
 form.elements.toolbox_instructor_other.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 assert.match(form.elements.instructor.value,/Guest Instructor/);
 assert.match(form.elements.instructor.value,/Safety One/);
 assert.equal(ui.collect().topic_ids.length,0);
 dom.window.close();
});

test('Toolbox weather supports English and Spanish with no coordinates stored in summary',async()=>{
 const weather={condition_code:2,temperature_f:91,apparent_temperature_f:98,humidity_pct:70,wind_mph:5,location_label:'Device area',location_source:'device'};
 assert.match(toolboxWeatherText(weather,'en'),/91°F/);
 assert.match(toolboxWeatherText(weather,'es'),/Humedad 70%/);
 assert.ok(!toolboxWeatherText(weather,'en').includes('latitude'));
 const t=fixture({weather});await t.ui.start();await t.ui.requestWeather();
 assert.match(t.form.elements.weather.value,/91°F/);
 assert.match(t.form.querySelector('.st-toolbox-weather-status').textContent,/device/);
 t.dom.window.close();
});

test('Toolbox previews display selected images and allow individual removal',async()=>{
 const photos=[{name:'first.jpg',type:'image/jpeg'},{name:'second.png',type:'image/png'}];
 const t=fixture({photos});await t.ui.start();await t.ui.refreshPhotos();
 assert.equal(t.form.querySelectorAll('.st-toolbox-photo-card').length,2);
 assert.equal(t.form.querySelectorAll('.st-toolbox-photo-card img').length,2);
 t.form.querySelector('.st-toolbox-photo-card button').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(photos.length,1);
 assert.equal(t.form.querySelectorAll('.st-toolbox-photo-card').length,1);
 assert.ok(t.revoked.length>=2);
 t.dom.window.close();
});
