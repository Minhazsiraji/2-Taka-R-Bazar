import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {create,act} from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url);
const contents=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
function load(code,mocks){
 const module={exports:{}};
 new Function('require','module','exports',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText)(name=>mocks[name]??require(name),module,module.exports);
 return module.exports;
}
const messages=load(contents('content.ts'),{}).heroMessages;
const theme=load(contents('theme.ts'),{});
const native={Animated:{Value:class {constructor(value){this.value=value;this.updates=0}setValue(value){this.value=value;this.updates++}},View:'Animated.View'},
 ImageBackground:'ImageBackground',Pressable:'Pressable',View:'View',StyleSheet:{create:v=>v,absoluteFill:{position:'absolute',left:0,top:0,right:0,bottom:0}}};
const {MotionHero,heroTextOpacity}=load(contents('motion-hero.tsx'),{
 'react-native':native,'react-native-svg':{__esModule:true,default:'Svg',Defs:'Defs',LinearGradient:'LinearGradient',Rect:'Rect',Stop:'Stop'},
 './typography':{Text:'Text'},'./hero-video':{HeroVideo:'HeroVideo'},'./theme':theme,
 './content':{heroMessages:messages},'../assets/2tbr-hero-panorama-v2.jpg':1
});
test('hero controls track the measured CTA center in both languages and retain their original spacing',async()=>{
 let tree;let explored=0;
 const props={lang:'en',dark:false,small:true,frameStyle:{height:174},onExplore:()=>explored++};
 await act(()=>{tree=create(React.createElement(MotionHero,props))});
 const cta=()=>tree.root.findByProps({accessibilityLabel:'Explore group deals'});
 const controls=()=>tree.root.findByProps({testID:'hero-controls'});
 for(const [lang,width] of [['en',123],['bn',117]]){
  await act(()=>tree.update(React.createElement(MotionHero,{...props,lang})));
  await act(()=>cta().props.onLayout({nativeEvent:{layout:{width}}}));
  assert.equal(controls().props.style.left+controls().props.style.width/2,13+width/2);
  assert.equal(controls().props.style.gap,8);
 }
 await act(()=>cta().props.onPress());assert.equal(explored,1);
 assert.equal(cta().props.style[1].bottom,30);assert.equal(cta().props.style[1].left,13);
 await act(()=>tree.unmount());
});
test('one native playback loop advances one message; manual navigation restarts its cart without extra timers',async()=>{
 let tree;
 await act(()=>{tree=create(React.createElement(MotionHero,{lang:'en',dark:false,small:false,onExplore(){}}))});
 const video=()=>tree.root.findByType('HeroVideo');
 const dot=i=>tree.root.findByProps({accessibilityLabel:'Slide '+i});
 assert.equal(dot(1).props.accessibilityState.selected,true);
 await act(()=>video().props.onTime(7.8,8));assert.equal(dot(1).props.accessibilityState.selected,true);
 await act(()=>video().props.onLoop());assert.equal(dot(2).props.accessibilityState.selected,true);
 assert.equal(video().props.restartKey,0);
 await act(()=>dot(4).props.onPress());assert.equal(dot(4).props.accessibilityState.selected,true);
 assert.equal(video().props.restartKey,1);
 await act(()=>video().props.onLoop());assert.equal(dot(1).props.accessibilityState.selected,true);
 await act(()=>tree.root.findByProps({accessibilityLabel:'Previous hero slide'}).props.onPress());
 assert.equal(dot(4).props.accessibilityState.selected,true);assert.equal(video().props.restartKey,2);
 await act(()=>tree.unmount());
});
test('text fades at the same playback boundaries and remains readable on failure',async()=>{
 assert.equal(heroTextOpacity(0,8),0);assert.equal(heroTextOpacity(.24,8),1);
 assert.equal(heroTextOpacity(4,8),1);assert.ok(heroTextOpacity(7.9,8)<.4);
 assert.equal(heroTextOpacity(8,8),0);assert.equal(heroTextOpacity(0,0),1);
 let tree;
 await act(()=>{tree=create(React.createElement(MotionHero,{lang:'en',dark:false,small:true,onExplore(){}}))});
 const video=tree.root.findByType('HeroVideo');
 await act(()=>{video.props.onTime(2,8);video.props.onTime(4,8);video.props.onTime(6,8)});
 assert.equal(tree.root.findByType('Animated.View').props.style.opacity.updates,0,'Steady frames must not update native opacity');
 await act(()=>video.props.onTime(7.99,8));
 assert.ok(tree.root.findByType('Animated.View').props.style.opacity.value<.1);
 await act(()=>video.props.onFailure());
 assert.equal(tree.root.findByType('Animated.View').props.style.opacity.value,1);
 await act(()=>video.props.onTime(0,8));
 await act(()=>tree.root.findByProps({accessibilityLabel:'Slide 3'}).props.onPress());
 assert.equal(tree.root.findByType('Animated.View').props.style.opacity.value,1);
 await act(()=>tree.unmount());
});
