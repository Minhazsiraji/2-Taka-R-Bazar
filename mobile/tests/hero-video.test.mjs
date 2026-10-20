import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {create,act} from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/hero-video.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;

function harness(initialStatus='readyToPlay'){
 const listeners=new Map();let stateListener;let removed=0;let setups=0;
 const player={status:initialStatus,plays:0,pauses:0,
  play(){this.plays++},pause(){this.pauses++},
  addListener(name,fn){listeners.set(name,fn);return {remove(){removed++;listeners.delete(name)}}}
 };
 const native={AppState:{currentState:'active',addEventListener(_name,fn){stateListener=fn;return {remove(){removed++}}}},
  StyleSheet:{absoluteFill:{position:'absolute',top:0,left:0,right:0,bottom:0}},View:'View'};
 const video={VideoView:'VideoView',useVideoPlayer(_source,setup){
  React.useMemo(()=>{setups++;setup(player)},[]);return player;
 }};
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='react-native')return native;
  if(name==='expo-video')return video;
  if(name.endsWith('.mp4'))return 1;
  return require(name);
 },module,module.exports);
 return {Component:module.exports.HeroVideo,player,listeners,
  state(value){stateListener(value)},get removed(){return removed},get setups(){return setups}};
}

test('hero autoplays silently, loops, has no chrome, reveals only after a frame, and keeps its player on rerender',async()=>{
 const h=harness();let tree;
 await act(()=>{tree=create(React.createElement(h.Component))});
 assert.equal(h.player.plays,1);
 assert.equal(h.player.loop,true);assert.equal(h.player.muted,true);assert.equal(h.player.volume,0);
 assert.equal(h.player.staysActiveInBackground,false);assert.equal(h.player.showNowPlayingNotification,false);
 const view=()=>tree.root.findByType('VideoView');
 assert.equal(view().props.nativeControls,false);assert.equal(view().props.allowsPictureInPicture,false);
 assert.equal(view().props.fullscreenOptions.enable,false);assert.equal(view().props.contentFit,'cover');
 assert.equal(view().props.surfaceType,'textureView');assert.equal(view().props.style[1].opacity,0);
 assert.equal(tree.root.findByType('View').props.pointerEvents,'none');
 await act(()=>view().props.onFirstFrameRender());
 assert.equal(view().props.style[1].opacity,1);
 await act(()=>tree.update(React.createElement(h.Component)));
 assert.equal(h.setups,1);assert.equal(h.player.plays,1);
 await act(()=>h.state('background'));assert.equal(h.player.pauses,1);
 await act(()=>h.state('active'));assert.equal(h.player.plays,2);
 await act(()=>tree.unmount());assert.equal(h.removed,2);
});

test('a failed video disappears immediately so the existing ImageBackground remains visible',async()=>{
 const h=harness();let tree;
 await act(()=>{tree=create(React.createElement(h.Component))});
 await act(()=>h.listeners.get('statusChange')({status:'error'}));
 assert.equal(tree.toJSON(),null);assert.equal(h.player.pauses,1);
 await act(()=>tree.unmount());
});

test('an error before listener registration also preserves static fallback',async()=>{
 const h=harness('error');let tree;
 await act(()=>{tree=create(React.createElement(h.Component))});
 assert.equal(tree.toJSON(),null);
 await act(()=>tree.unmount());
});
