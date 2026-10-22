/**
 * Permanent bilingual 2TBR mobile typography.
 * English: Inter; Bangla: Hind Siliguri.
 * The wrapper ONLY changes font family/weight, never layout or approved color.
 */
import React,{createContext,useContext} from 'react';
import {Text as NativeText,TextInput as NativeTextInput,StyleSheet,type TextProps,type TextInputProps} from 'react-native';
import type {Language} from './content';

type Settings={language:Language;loaded:boolean};
const Context=createContext<Settings>({language:'en',loaded:false});
export const typefaces={
 en:{regular:'Inter_400Regular',medium:'Inter_500Medium',semibold:'Inter_600SemiBold',bold:'Inter_700Bold'},
 bn:{regular:'HindSiliguri_400Regular',medium:'HindSiliguri_500Medium',semibold:'HindSiliguri_600SemiBold',bold:'HindSiliguri_700Bold'}
} as const;

/* Clamp the old ultra-black 800/900 weights to readable approved semibold/bold. */
export function textWeight(weight?:string|number):keyof typeof typefaces.en{
 const value=weight==='bold'?700:weight==='normal'||weight==null?400:Number(weight);
 if(value>=900)return 'bold';
 if(value>=600)return 'semibold';
 if(value>=500)return 'medium';
 return 'regular';
}
function visibleText(value:React.ReactNode,depth=0):string{
 if(depth>5||value==null||typeof value==='boolean')return '';
 if(typeof value==='string'||typeof value==='number')return String(value);
 if(Array.isArray(value))return value.map(item=>visibleText(item,depth+1)).join('');
 if(React.isValidElement(value)){
  const props=value.props as {children?:React.ReactNode};
  return visibleText(props.children,depth+1);
 }
 return '';
}
export function textLanguage(value:React.ReactNode,fallback:Language):Language{
 const content=visibleText(value);
 if(/[\u0980-\u09ff]/.test(content))return 'bn';
 if(/[a-zA-Z]/.test(content))return 'en';
 return fallback;
}
export function TypographyProvider({language,loaded,children}:{language:Language;loaded:boolean;children:React.ReactNode}){
 return <Context.Provider value={{language,loaded}}>{children}</Context.Provider>;
}
export function Text(props:TextProps){
 const {language,loaded}=useContext(Context);
 const style=StyleSheet.flatten(props.style)||{};
 const variant=textWeight(style.fontWeight);
 const face=typefaces[textLanguage(props.children,language)][variant];
 return <NativeText {...props} style={loaded?[props.style,{fontFamily:face,fontWeight:'normal'}]:props.style}/>;
}
export function TextInput(props:TextInputProps){
 const {language,loaded}=useContext(Context);
 const style=StyleSheet.flatten(props.style)||{};
 const variant=textWeight(style.fontWeight);
 const face=typefaces[textLanguage(props.value||props.placeholder||'',language)][variant];
 return <NativeTextInput {...props} style={loaded?[props.style,{fontFamily:face,fontWeight:'normal'}]:props.style}/>;
}
