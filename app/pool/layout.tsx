import type { ReactNode } from 'react'
import { PoolTargetIsolation } from '@/components/pool-target-isolation'
import { PoolProductImageFit } from '@/components/pool-product-image-fit'
import './pool-images.css'

export default function PoolLayout({children}:{children:ReactNode}){
  return <div className="pool-view min-w-0"><PoolTargetIsolation/><PoolProductImageFit/>{children}</div>
}
