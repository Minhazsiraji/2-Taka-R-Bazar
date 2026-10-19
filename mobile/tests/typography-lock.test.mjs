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
 for(const key of ['<Hero/>','<Savings home/>', "title('',t.groups", "title('',t.exclusive", "title('',t.pools"]) assert.ok(home.includes(key),key);
 assert.ok(app.includes("case 'signIn':return <NativeSignIn"));
 assert.ok(app.includes("case 'checkout':return <Checkout/>"));
});
