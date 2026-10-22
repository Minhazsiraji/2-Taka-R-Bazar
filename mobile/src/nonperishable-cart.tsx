import React from 'react';
import Svg,{SvgXml} from 'react-native-svg';
import type {StyleProp,ViewStyle} from 'react-native';
// New asset: same teal-hero shopping-cart concept, with pantry products only.
const xml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 185">'+
'<ellipse cx="124" cy="165" rx="79" ry="8" fill="#003c46" opacity=".4"/>'+
'<g stroke="#ffdc32" stroke-width="3" stroke-linecap="round"><path d="M93 19L87 6M165 20L175 8M186 40L199 34"/></g>'+
'<path d="M86 16L139 16 147 108 77 108Z" fill="#fff0d6" stroke="#efdbad" stroke-width="2"/>'+
'<path d="M86 16L139 16 141 28 83 28Z" fill="#ffe1aa"/>'+
'<rect x="89" y="44" width="48" height="43" rx="4" fill="#fffaf1"/>'+
'<text x="113" y="59" fill="#087782" font-size="10" font-weight="bold" text-anchor="middle">2TBR</text>'+
'<text x="113" y="73" fill="#8c672e" font-size="11" font-weight="bold" text-anchor="middle">RICE</text>'+
'<text x="113" y="83" fill="#94743c" font-size="7" text-anchor="middle">1 KG</text>'+
'<rect x="48" y="28" width="31" height="83" rx="9" fill="#ffc722" stroke="#ffe261" stroke-width="2"/>'+
'<rect x="53" y="15" width="20" height="17" rx="3" fill="#167a53"/>'+
'<rect x="52" y="55" width="25" height="32" rx="4" fill="#fff8d6"/>'+
'<text x="64" y="73" fill="#116c58" font-size="11" font-weight="bold" text-anchor="middle">OIL</text>'+
'<path d="M142 47L185 47 189 113 141 113Z" fill="#ffad58" stroke="#ffd09a" stroke-width="2"/>'+
'<rect x="147" y="62" width="34" height="33" rx="3" fill="#fff8e7"/>'+
'<text x="164" y="79" fill="#ba551d" font-size="11" font-weight="bold" text-anchor="middle">DAL</text>'+
'<text x="164" y="90" fill="#94743c" font-size="7" text-anchor="middle">1 KG</text>'+
'<rect x="12" y="78" width="44" height="42" rx="4" fill="#178e77"/>'+
'<rect x="16" y="84" width="36" height="25" rx="3" fill="#fff4cf"/>'+
'<text x="34" y="100" fill="#106751" font-size="11" font-weight="bold" text-anchor="middle">TEA</text>'+
'<path d="M173 72L211 74 208 120 171 120Z" fill="#f8ffff" stroke="#ade6f1" stroke-width="2"/>'+
'<text x="190" y="96" fill="#087789" font-size="8" font-weight="bold" text-anchor="middle">SUGAR</text>'+
'<path d="M4 73H18L36 141H178L201 66H215" stroke="#e7fbff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'+
'<path d="M25 88H195L180 130H36Z" fill="#cff9ff" fill-opacity=".13" stroke="#f4ffff" stroke-width="4"/>'+
'<g stroke="#ddfaff" stroke-width="3"><path d="M59 89L65 128M92 89L94 129M124 89V129M157 89L154 129M35 107H186"/></g>'+
'<path d="M38 142L49 152H179" stroke="#f2ffff" stroke-width="7" stroke-linecap="round" fill="none"/>'+
'<circle cx="62" cy="164" r="11" fill="#22404d" stroke="#f8ffff" stroke-width="5"/>'+
'<circle cx="161" cy="164" r="11" fill="#22404d" stroke="#f8ffff" stroke-width="5"/>'+
'</svg>';
export function NonperishableCart({style}:{style?:StyleProp<ViewStyle>}){
 return <SvgXml xml={xml} width="100%" height="100%" style={style}/>;
}
