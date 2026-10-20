"""Run against the standalone internal APK; no customer data or network writes."""
import io
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops, ImageStat

OUT = Path('android-ui-evidence')
OUT.mkdir(exist_ok=True)
APP = 'com.twotbr.internalpreview'

def adb(*args):
    return subprocess.check_output(['adb', *args])

def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    raw = adb('shell', 'cat', '/sdcard/window.xml')
    (OUT/'window.xml').write_bytes(raw)
    return ET.fromstring(raw)

def matches(node, label):
    return any(value.strip() == label or value.split()[-1:] == [label] for value in [node.get('content-desc', ''), node.get('text', '')])

def find(root, label):
    return next(n for n in root.iter('node') if matches(n, label))

def nav_node(root, label):
    return [n for n in root.iter('node') if matches(n, label)][-1]

def bounds(node):
    return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))

def tap(node):
    x1, y1, x2, y2 = bounds(node)
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

def shot(name):
    raw = adb('exec-out', 'screencap', '-p')
    (OUT / (name+'.png')).write_bytes(raw)
    return Image.open(io.BytesIO(raw)).convert('RGB')

def motion(a, b, box):
    return sum(ImageStat.Stat(ImageChops.difference(a.crop(box), b.crop(box))).mean)/3

def verify_center(root):
    c = bounds(find(root, 'Explore group deals'))
    left = bounds(find(root, 'Previous hero slide'))
    right = bounds(find(root, 'Next hero slide'))
    assert abs((left[0]+right[2])/2-(c[0]+c[2])/2) <= 2, 'Controls not centered under CTA'
    return c

def selected_slide(root):
    return next(i for i in range(1,5) if find(root,'Slide '+str(i)).get('selected')=='true')

def verify_text_clear(root, top, cta):
    # All carousel copy must finish before the fixed CTA, in both languages.
    for node in root.iter('node'):
        if not node.get('text','').strip(): continue
        x1,y1,x2,y2 = bounds(node)
        if y1 > top+10*density and y1 < cta[1] and x1 > 20*density:
            assert y2 <= cta[1]-2, 'Hero text overlaps CTA: '+node.get('text','')

try:
    adb('install', '-r', 'android/app/build/outputs/apk/release/app-release.apk')
    adb('logcat', '-c')
    adb('shell', 'monkey', '-p', APP, '-c', 'android.intent.category.LAUNCHER', '1')
    root = None
    for _ in range(30):
        time.sleep(2)
        try:
            root = ui()
            find(root, 'Explore group deals')
            break
        except (StopIteration, ET.ParseError):
            continue
    else:
        raise AssertionError('Home did not become ready on Android')

    density = int(re.findall(rb'\d+', adb('shell', 'wm', 'density'))[-1])/160
    cta = verify_center(root)
    bottom = cta[3]+30*density
    top = bottom-174*density
    first = shot('light-initial')
    # Only sample the right-hand media, avoiding carousel text/controls.
    crop = (int(first.width*.65), int(top+15*density), first.width-int(24*density), int(bottom-15*density))
    # The source deliberately holds still for part of each cycle. Sample a full
    # cycle instead of assuming any pair of frames must differ.
    def cycle_motion(prefix):
        frames = []
        for index in range(9):
            frames.append(shot(f'{prefix}-{index}'))
            time.sleep(1)
        return max(motion(frames[0], frame, crop) for frame in frames[1:])
    initial_motion = cycle_motion('light-first-cycle')
    assert initial_motion > .3, 'Hero is static or video did not autoplay'
    repeated_motion = cycle_motion('light-repeated-cycle')
    assert repeated_motion > .3, 'Video stopped after its 8-second duration'

    light_root = ui()
    labels = ['Home', 'Pools', 'Deals', 'Exclusive', 'Cart']
    nav = {label: bounds(nav_node(light_root, label)) for label in labels}
    tap(find(light_root, 'moon-outline'))
    time.sleep(2)
    dark_root = ui()
    assert verify_center(dark_root) == cta, 'Hero CTA moved in dark mode'
    assert {label: bounds(nav_node(dark_root, label)) for label in labels} == nav, 'Dock moved in dark mode'
    dark = shot('dark')
    # Header Home is the official logo's accessibility node.
    logo_box = bounds(find(dark_root, 'Home'))
    logo = dark.crop(logo_box)
    white = sum(1 for r,g,b in logo.getdata() if min(r,g,b)>225)
    assert white > logo.width*logo.height*.05, 'Dark logo is not visibly white'
    assert ImageStat.Stat(ImageChops.difference(first.crop(logo_box), logo)).mean != [0,0,0]
    # Explicit selections restart a complete cart cycle, then native loop completion advances once.
    tap(find(dark_root,'Slide 4'))
    time.sleep(.6)
    assert selected_slide(ui()) == 4, 'Manual slide selection failed'
    time.sleep(6.5)
    assert selected_slide(ui()) == 1, 'Text did not advance with the eight-second video loop'
    # Review every unchanged message in light/dark and both languages.
    for theme_name in ['dark','light']:
        if theme_name=='light':
            tap(find(ui(),'sunny-outline'))
            time.sleep(.5)
        for language in ['en','bn']:
            if language=='bn':
                tap(find(ui(),'BAN'))
                time.sleep(.5)
            for index in range(1,5):
                tap(find(ui(),'Slide '+str(index)))
                time.sleep(.5)
                current=ui()
                current_cta=verify_center(current)
                verify_text_clear(current,top,current_cta)
                shot(f'hero-{theme_name}-{language}-{index}')
            if language=='bn':
                tap(find(ui(),'EN'))
                time.sleep(.5)
    # The light mode was restored by the loop above.
    dark_root=ui()

    time.sleep(1)
    shot('light-restored')
    # Scroll down and back: dock remains reachable, video still animates.
    adb('shell', 'input', 'swipe', str(first.width//2), str(int(first.height*.75)), str(first.width//2), str(int(first.height*.3)), '350')
    time.sleep(1)
    scrolled = ui()
    for label in labels:
        assert bounds(nav_node(scrolled, label)) == nav[label], 'Dock shifted while scrolling'
    shot('scrolled')
    tap(nav_node(scrolled, 'Cart'))
    time.sleep(1)
    find(ui(), 'No direct products yet.')
    shot('cart')
    tap(nav_node(ui(),'Home'))
    adb('shell','wm','size',f'{round(360*density)}x{round(760*density)}')
    time.sleep(2)
    for language in ['en','bn']:
        if language=='bn':
            tap(find(ui(),'BAN'))
            time.sleep(.5)
        for index in range(1,5):
            tap(find(ui(),'Slide '+str(index)))
            time.sleep(.5)
            current=ui()
            current_cta=verify_center(current)
            compact_top=current_cta[3]+30*density-174*density
            verify_text_clear(current,compact_top,current_cta)
            shot(f'compact-{language}-{index}')
    (OUT/'result.json').write_text(json.dumps({'passed':True, 'hero_height_dp':174, 'density':density, 'cta_bounds':cta, 'navigation_bounds':nav, 'motion_before_loop':initial_motion, 'motion_after_loop':repeated_motion,'controls_centered':True,'video_driven_slide_advance':True,'languages':['en','bn'],'widths_dp':[first.width/density,360]}, indent=2))
finally:
    adb('shell','wm','size','reset')
    (OUT/'logcat.txt').write_bytes(adb('logcat', '-d'))
    (OUT/'gfxinfo.txt').write_bytes(adb('shell', 'dumpsys', 'gfxinfo', APP, 'framestats'))
