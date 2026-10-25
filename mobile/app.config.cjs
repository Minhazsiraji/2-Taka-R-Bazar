// Store identifiers are static in app.json so EAS can validate without interactive credentials.
// Preserve the old Android preview identity only when deliberately opting into that legacy profile.
module.exports=({config})=>{
 if(process.env.EAS_BUILD_PROFILE==='2tbr-internal-preview')return {
  ...config,version:'0.1.1',
  android:{...config.android,package:'com.twotbr.internalpreview'},
  extra:{...config.extra,releaseStage:'development'}
 };
 return config;
};
