'use client'
import {useEffect} from 'react'
import {writeLaunchCart} from '@/lib/launch-cart'
export function ClearLaunchCart({orderId}:{orderId:string}){useEffect(()=>{const key='2tbr-cleared-'+orderId;if(!sessionStorage.getItem(key)){writeLaunchCart([]);sessionStorage.setItem(key,'1')}},[orderId]);return null}
