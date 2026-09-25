'use client'

export function ShareButton({ title, text }: { title: string; text: string }) {
  async function share() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title, text, url })
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      window.alert('Link copied')
    }
  }
  return <button className="btn-secondary" onClick={share}>Share</button>
}
