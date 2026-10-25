// Production package IDs are isolated from the existing OTA-enabled internal preview.
// Do not rename the existing Expo project or preview package.
module.exports=({config})=>{
 if(process.env.EAS_BUILD_PROFILE!=='production')return config;
 return {
  ...config,
  version:'1.0.0',
  android:{...config.android,package:'com.twotbr.marketplace',versionCode:1},
  ios:{...config.ios,bundleIdentifier:'com.twotbr.marketplace',buildNumber:'1'},
  extra:{...config.extra,releaseStage:'store-candidate'}
 };
};
