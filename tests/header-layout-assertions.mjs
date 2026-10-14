import assert from 'node:assert/strict'

// Check painted text and every visible control, not just page scrollWidth:
// a grid cell can fit the viewport while its nowrap brand paints over buttons.
export async function assertHeaderGeometry(page, brandSelector, actionsSelector, width) {
  const violations = await page.evaluate(({brandSelector, actionsSelector}) => {
    const brand = document.querySelector(brandSelector)
    const actions = document.querySelector(actionsSelector)
    if (!brand || !actions) return ['Missing header elements']
    const range = document.createRange(); range.selectNodeContents(brand)
    const text = range.getBoundingClientRect()
    const controls = [...actions.querySelectorAll('a,button')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
    const boxes = controls.map(el => ({label: el.getAttribute('aria-label') || el.textContent.trim(), box: el.getBoundingClientRect()}))
    const intersects = (a,b) => a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5
    const errors = []
    if (text.left < 0 || text.right > innerWidth) errors.push('Brand paints outside viewport')
    for (let i = 0; i < boxes.length; i++) {
      const {label, box} = boxes[i]
      if (intersects(text, box)) errors.push('Brand overlaps ' + label)
      if (box.left < 0 || box.right > innerWidth) errors.push('Control outside viewport: ' + label)
      if (innerWidth <= 790 && (box.width < 43.5 || box.height < 43.5)) errors.push('Small mobile target: ' + label)
      for (let j = i + 1; j < boxes.length; j++) if (intersects(box, boxes[j].box)) errors.push(label + ' overlaps ' + boxes[j].label)
    }
    return errors
  }, {brandSelector, actionsSelector})
  assert.deepEqual(violations, [], 'Header geometry at width ' + width)
}
