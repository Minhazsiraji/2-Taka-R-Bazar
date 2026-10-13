import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStoredBrowsingArea, matchConfidentCommunity, deliveryBundleCandidate } from '../lib/smart-location.mjs';

const areas=[
 {community_id:'AMT-01',center_latitude:23.96,center_longitude:90.28,match_radius_m:600},
 {community_id:'DOHS-02',center_latitude:23.98,center_longitude:90.32,match_radius_m:450},
];
function distance(lat,long,centerLat,centerLong){
 const dx=(lat-centerLat)*111000,dy=(long-centerLong)*102000;
 return Math.sqrt(dx*dx+dy*dy);
}
test('remember only IDs published by server; do not trust arbitrary storage',()=>{
 assert.equal(pickStoredBrowsingArea('AMT-01',areas.map(a=>a.community_id)),'AMT-01');
 assert.equal(pickStoredBrowsingArea('fake',areas.map(a=>a.community_id)),'');
 assert.equal(pickStoredBrowsingArea(null,areas.map(a=>a.community_id)),'');
});
test('auto area match requires full reported accuracy circle inside one area',()=>{
 assert.equal(matchConfidentCommunity(areas,23.96,90.28,80,distance)?.community_id,'AMT-01');
 assert.equal(matchConfidentCommunity(areas,23.96,90.28,900,distance),null);
 assert.equal(matchConfidentCommunity(areas,23.96,90.28,601,distance),null);
 assert.equal(matchConfidentCommunity(areas,23.96,90.28,20,distance)?.community_id,'AMT-01');
});
test('invalid, missing or ambiguous coordinates cannot be classified',()=>{
 assert.equal(matchConfidentCommunity(areas,NaN,90.28,20,distance),null);
 assert.equal(matchConfidentCommunity(areas,23.96,90.28,-1,distance),null);
 assert.equal(matchConfidentCommunity([{...areas[0]},{...areas[0],community_id:'AMT-02'}],23.96,90.28,40,distance),null);
 assert.equal(matchConfidentCommunity([{...areas[0],center_latitude:null}],23.96,90.28,40,distance),null);
});
const bundle={
 fulfillment:'home_delivery', addressVerification:'verified',buildingVerification:'verified',
 communityId:'AMT-01',zoneId:'Z1',buildingId:'B4',supplierGroupId:'S1',
 deliveryDate:'2026-10-16',windowId:'PM',
};
test('verified households with same dispatch constraints propose same bundle',()=>{
 assert.equal(deliveryBundleCandidate({...bundle}),deliveryBundleCandidate({...bundle}));
 for(const key of ['communityId','zoneId','buildingId','supplierGroupId','deliveryDate','windowId']){
  assert.notEqual(deliveryBundleCandidate({...bundle,[key]:key==='deliveryDate'?'2026-10-17':'different'}),deliveryBundleCandidate(bundle));
 }
});
test('unverified address, approximate GPS and pickup cannot silently bundle deliveries',()=>{
 assert.equal(deliveryBundleCandidate({...bundle,addressVerification:'suggested'}),null);
 assert.equal(deliveryBundleCandidate({...bundle,buildingVerification:'unverified'}),null);
 assert.equal(deliveryBundleCandidate({...bundle,buildingId:''}),null);
 assert.equal(deliveryBundleCandidate({...bundle,fulfillment:'pickup'}),null);
 assert.equal(deliveryBundleCandidate({...bundle,buildingId:'A | B'}),null);
});
