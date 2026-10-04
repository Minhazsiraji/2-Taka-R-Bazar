import type { ReactNode } from 'react'
import './pool-images.css'

export default function PoolLayout({children}:{children:ReactNode}){
  return <div className="pool-view min-w-0">{children}</div>
}
