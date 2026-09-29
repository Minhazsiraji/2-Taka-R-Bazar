import './home.css'
import './home-pass3.css'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-liquid-route">{children}</div>
}
