// Production package IDs are isolated from the existing OTA-enabled internal preview.
// Do not rename the existing Expo project or preview package.
module.exports=({config})=>{
 if(!['production','2tbr-customer-qa'].includes(process.env.EAS_BUILD_PROFILE))return config;
 return {
  ...config,
  version:'1.0.0',
  icon:'./assets/store-icon.png',
  android:{...config.android,package:'com.twotbr.marketplace',versionCode:1},
  ios:{...config.ios,bundleIdentifier:'com.twotbr.marketplace',buildNumber:'1'},
  extra:{...config.extra,releaseStage:process.env.EAS_BUILD_PROFILE==='production'?'store-candidate':'customer-qa'}
 };
};
