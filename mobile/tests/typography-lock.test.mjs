import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const login=readFileSync(new URL('../src/auth/native-sign-in.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/typography.tsx',import.meta.url),'utf8');
const packageJson=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const theme=readFileSync(new URL('../src/theme.ts',import.meta.url),'utf8');

test('Approved bilingual fonts are bundled and initialized once, with fallback',()=>{
 for(const [pkg,version] of Object.entries({
  'expo-font':'57.0.4',
  '@expo-google-fonts/inter':'0.4.2',
  '@expo-google-fonts/hind-siliguri':'0.4.1'
 }))assert.equal(packageJson.dependencies[pkg],version);
 for(const name of ['Inter_400Regular','Inter_500Medium','Inter_600SemiBold','Inter_700Bold',
   'HindSiliguri_400Regular','HindSiliguri_500Medium','HindSiliguri_600SemiBold','HindSiliguri_700Bold']){
   assert.ok(app.includes(name),name);
   assert.ok(styles.includes(name),name);
 }
 assert.ok(app.includes('const [loaded,error]=useFonts({'));
 assert.ok(app.includes('if(!loaded&&!error)return null;'));
 assert.ok(app.includes('<Shop fontsReady={loaded}/>'));
});
test('All native screens use the shared Text/TextInput with bilingual language context',()=>{
 assert.ok(app.includes("import {Text,TextInput,TypographyProvider} from './src/typography'"));
 assert.ok(login.includes("import {Text,TextInput} from '../typography'"));
 assert.ok(!app.includes("StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native'"));
 assert.ok(app.includes('<TypographyProvider language={lang} loaded={fontsReady}>'));
 assert.ok(styles.includes("React.isValidElement(value)"));
 assert.ok(styles.includes("textLanguage(props.children,language)"));
 assert.ok(styles.includes("textLanguage(props.value||props.placeholder||'',language)"));
});
test('Typography never changes colors, font sizes, geometry, routes, checkout or locked Home',()=>{
 for(const token of [
 "if(value>=900)return 'bold'",
 "if(value>=600)return 'semibold'",
 "if(value>=500)return 'medium'",
 "fontFamily:face,fontWeight:'normal'",
 ]) assert.ok(styles.includes(token),token);
 for(const color of ["primary:'#007F83'","accent:'#2CD6CE'","text:'#17233B'","background:'#F4F1F6'"])
  assert.ok(theme.includes(color),color);
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 for(const key of ['{Hero()}','<Savings home/>', "title('',t.groups", "title('',t.exclusive", "title('',t.pools"]) assert.ok(home.includes(key),key);
 assert.ok(app.includes("case 'signIn':return <NativeSignIn"));
 assert.ok(app.includes("case 'checkout':return <Checkout/>"));
});

test('Home Savings tiles are compact in the existing four-card row only',()=>{
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 const tile=app.slice(app.indexOf('const savingTile='),app.indexOf('function Savings(',app.indexOf('const savingTile=')));
 assert.ok(tile.includes("flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,width:'100%'"));
 assert.ok(tile.includes("name}</Text>"));
 assert.ok(tile.includes("value}</Text>"));
 assert.ok(tile.includes("onPress={()=>setScreen('savings')}"));
 assert.ok(app.includes("savingTile:{width:'23.9%',minHeight:60,paddingHorizontal:4,paddingVertical:6"));
 assert.ok(tile.includes("fontSize:small?12.5:14,fontWeight:'900'"));
 assert.ok(tile.includes("width:'100%',textAlign:'center',marginTop:2"));
 assert.ok(app.includes("savingsFour:{flexDirection:'row',alignItems:'stretch',justifyContent:'space-between',gap:4}"));
 for(const token of ["t.thisMonth","t.lastMonth","t.lifetime","t.communityTotal"]){
   assert.ok(app.includes('savingTile('+token),token);
 }
});

test('Approved V2.3 hero is fixed-height and has exactly the bottom carousel controls',()=>{
 const hero=app.slice(app.indexOf('const Hero=()=>'),app.indexOf('function Home(){'));
 assert.ok(hero.includes('✦ SMART SHOPPING. REAL SAVINGS!'));
 assert.ok(hero.includes('numberOfLines={1} adjustsFontSizeToFit'));
 assert.ok(app.includes('hero:{height:174,minHeight:174,maxHeight:174'));
 assert.ok(hero.includes('setSlide(v=>(v+3)%4)'));
 assert.ok(hero.includes('setSlide(v=>(v+1)%4)'));
 assert.ok(hero.includes("accessibilityLabel={'Slide '+(i+1)}"));
 assert.ok(hero.includes("position:'absolute',left:13,bottom:30"));
 assert.ok(hero.includes('onPress={()=>onTab(\'deals\')}'));
 assert.ok(hero.includes("left:13,bottom:5,width:132,flexDirection:'row',alignItems:'center',justifyContent:'center'"));
 assert.ok(hero.includes('heroMessages[slide][lang]'));
 assert.ok(!hero.includes('hero-edge-next'));
 assert.ok(app.includes("require('./assets/2tbr-hero-panorama-v2.jpg')"));
 assert.ok(!app.includes('require(\'./assets/Vibrant Grocery Cart on Teal Background.png\')'));
});
test('Approved hero image is bundled locally and has no older illustration or CDN dependency',()=>{
 const hero=app.slice(app.indexOf('const Hero=()=>'),app.indexOf('function Home(){'));
 assert.ok(hero.includes('<ImageBackground source={approvedHeroImage} resizeMode="stretch"'));
 assert.ok(hero.includes('imageStyle={{borderRadius:17}}'));
 assert.ok(hero.includes('style={[styles.hero,{backgroundColor:dark?palette.dark.hero:palette.light.hero}]}'));
 assert.ok(hero.includes('</ImageBackground>'));
 assert.ok(!hero.includes("width:'100%',height:'100%'"),'do not size hero image to padded content dimensions');
 assert.ok(!hero.includes("source={approvedHeroImage} resizeMode=\"contain\""));
 assert.ok(!app.includes('HERO_ART_WIDTH'));
 assert.ok(!app.includes('EXPO_PUBLIC_APPROVED_HERO_IMAGE_URL'));
 assert.ok(!app.includes('NonperishableCart'));
});

test('Android device edge safe area has one owner without lateral insets',()=>{
 const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8'));
 assert.equal(config.expo.android.edgeToEdgeEnabled,false);
 assert.ok(app.includes("edges={['top','bottom']}"));
 assert.ok(!app.includes("edges={['top','left','right','bottom']}"));
});
test('Bell opens real local demo notification inbox without an Alert placeholder',()=>{
 const notices=app.slice(app.indexOf('function Notifications(){'),app.indexOf('function Menu(){'));
 assert.ok(app.includes("case 'notifications':return <Notifications/>"));
 assert.ok(app.includes("headerAction('notifications-outline',openNotifications,unreadNotices)"));
 assert.ok(app.includes("const unreadNotices=notices.filter(item=>!item.read).length"));
 assert.ok(app.includes("setNotices(old=>old.map(item=>item.read?item:{...item,read:true}))"));
 assert.ok(app.includes("pushDemoNotice("));
 assert.ok(app.includes("setNotices([])"));
 assert.ok(app.includes("No order or payment was created."));
 assert.ok(notices.includes("View cart →"));
 assert.ok(notices.includes("Real customer, order and delivery notifications are not connected."));
 assert.ok(!app.includes("const notify=()=>Alert.alert"));
 assert.ok(!app.includes("demo?1:0)}"));
});
