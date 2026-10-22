import assert from 'node:assert/strict'

// Check painted text and every visible control, not just page scrollWidth:
// a grid cell can fit the viewport while its nowrap brand paints over buttons.
export async function assertHeaderGeometry(page, brandSelector, actionsSelector, width) {
  const violations = await page.evaluate(({brandSelector, actionsSelector}) => {
    const brand = document.querySelector(brandSelector)
    const actions = document.querySelector(actionsSelector)
    if (!brand || !actions) return ['Missing header elements']
    const text = brand.getBoundingClientRect()
    const controls = [...actions.querySelectorAll('a,button')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
    const boxes = controls.map(el => ({label: el.getAttribute('aria-label') || el.textContent.trim(), box: el.getBoundingClientRect()}))
    const intersects = (a,b) => a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5
    const errors = []
    const redesignedMobileHome = innerWidth < 768 && Boolean(document.querySelector('.mhome') &&
      getComputedStyle(document.querySelector('.mhome')).display !== 'none')
    if (text.width < 1 || text.height < 1) errors.push('Brand is not visible')
    if (redesignedMobileHome) {
      const brandCopy = brand.querySelector('.market-brand-copy')
      if (!brandCopy || getComputedStyle(brandCopy).display === 'none') errors.push('Approved mobile brand name is hidden')
      else if (brandCopy.scrollWidth > brandCopy.clientWidth + 2) errors.push('Approved mobile brand copy is clipped')
    }
    if (text.left < 0 || text.right > innerWidth) errors.push('Brand paints outside viewport')
    if (innerWidth >= 768) {
      const copy = brand.querySelector('.market-brand-copy,.public-header-brand-copy,.app-header-brand-copy')
      if (!copy || !copy.getClientRects().length || getComputedStyle(copy).display === 'none') errors.push('Tablet/desktop brand copy is hidden')
      else {
        const expected = ['2-TAKA-R-BAZAR','Smart shopping. Real savings!','একসাথে কিনি, কম দামে পাই!']
        const lines = [...copy.children]
        for (const value of expected) {
          const line = lines.find(el => el.textContent.trim() === value)
          if (!line || !line.getClientRects().length || getComputedStyle(line).display === 'none') {errors.push('Missing visible brand line: ' + value);continue}
          const range = document.createRange()
          range.selectNodeContents(line)
          const painted = range.getBoundingClientRect()
          if (painted.width < 1 || painted.left < text.left - 1 || painted.right > text.right + 1 || line.scrollWidth > line.clientWidth + 1) errors.push('Brand line is clipped: ' + value)
        }
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      const {label, box} = boxes[i]
      if (innerWidth <= 790 && Math.abs((text.top + text.bottom) / 2 - (box.top + box.bottom) / 2) > 3) errors.push('Header controls must share the logo row: ' + label)
      if (intersects(text, box)) errors.push('Brand overlaps ' + label)
      if (box.left < 0 || box.right > innerWidth) errors.push('Control outside viewport: ' + label)
      // The owner-locked public shell uses the same 31px phone / 34px tablet controls on every customer route.
      const publicShell = Boolean(brand.closest('main.public-marketplace-flat'))
      const minTarget = publicShell ? (innerWidth < 768 ? 30.5 : 33.5) : redesignedMobileHome ? 28 : 43.5
      if (innerWidth <= 790 && (box.width < minTarget || box.height < minTarget)) errors.push('Small mobile target: ' + label)
      for (let j = i + 1; j < boxes.length; j++) if (intersects(box, boxes[j].box)) errors.push(label + ' overlaps ' + boxes[j].label)
    }
    if (innerWidth <= 790) {
      const header = brand.closest('header')
      const maxHeight = header.classList.contains('market-flat-header') ? 128 : 86
      if (header.getBoundingClientRect().height > maxHeight) errors.push('Mobile header is too tall')
    }
    return errors
  }, {brandSelector, actionsSelector})
  assert.deepEqual(violations, [], 'Header geometry at width ' + width)
}

export async function assertCustomerPageHeader(page, width) {
  if (await page.locator('.market-flat-header').count()) return assertHeaderGeometry(page, '.market-brand-lockup', '.market-header-actions', width)
  if (await page.locator('.public-compact-header').count()) return assertHeaderGeometry(page, '.public-header-brand', '.public-header-actions', width)
  return assertHeaderGeometry(page, '.app-header-brand', '.app-role-actions', width)
}
