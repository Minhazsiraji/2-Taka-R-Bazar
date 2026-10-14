import assert from 'node:assert/strict'

// isVisible() also accepts elements painted outside the viewport. Check the
// actual viewport edge and hit targets at each scroll position instead.
export async function assertMobileDock(page, width) {
  const dock = page.locator('.app-mobile-nav')
  assert.equal(await dock.count(), 1, 'Exactly one customer dock on ' + page.url())
  // A client route can reveal its heading before its stylesheet is applied.
  // Wait for the expected painted state, then test geometry and all hit targets.
  await dock.waitFor({state: width < 768 ? 'visible' : 'hidden'})
  if (width >= 768) {
    assert.equal(await dock.isVisible(), false, 'No mobile dock on tablet/desktop')
    return
  }
  for (const fraction of [0, .5, 1]) {
    await page.evaluate(f => window.scrollTo({top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant'}), fraction)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const errors = await dock.evaluate(nav => {
      const errors = []
      const box = nav.getBoundingClientRect()
      if (getComputedStyle(nav).position !== 'fixed') errors.push('Dock is not fixed')
      if (Math.abs(box.bottom - innerHeight) > 1) errors.push('Dock is not at viewport bottom: ' + box.bottom + '/' + innerHeight)
      if (box.top < 0 || box.height < 44 || box.left < -.5 || box.right > innerWidth + .5) errors.push('Dock is outside viewport')
      const links = [...nav.querySelectorAll('a')]
      if (links.length !== 5) errors.push('Missing shopping destinations')
      for (const link of links) {
        const r = link.getBoundingClientRect()
        if (r.height < 44 || r.width < 44) errors.push('Small target: ' + link.textContent)
        const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)
        if (!hit || !link.contains(hit)) errors.push('Link is covered or offscreen: ' + link.textContent)
      }
      return errors
    })
    assert.deepEqual(errors, [], 'Dock at width ' + width + ', scroll ' + fraction + ', ' + page.url())
  }
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}))
}
