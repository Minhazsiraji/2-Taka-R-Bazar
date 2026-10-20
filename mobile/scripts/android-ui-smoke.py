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
    return ET.fromstring(raw)

def find(root, label):
    return next(n for n in root.iter('node') if n.get('content-desc') == label or n.get('text') == label)

def nav_node(root, label):
    return [n for n in root.iter('node') if n.get('content-desc') == label or n.get('text') == label][-1]

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
    cta = bounds(find(root, 'Explore group deals'))
    bottom = cta[3]+30*density
    top = bottom-174*density
    first = shot('light-initial')
    # Only sample the right-hand media, avoiding carousel text/controls.
    crop = (int(first.width*.65), int(top+15*density), first.width-int(24*density), int(bottom-15*density))
    time.sleep(2)
    second = shot('light-motion')
    assert motion(first, second, crop) > .3, 'Hero is static or video did not autoplay'
    time.sleep(8.5)
    after_loop = shot('light-after-loop')
    time.sleep(2)
    after_loop_motion = shot('light-after-loop-motion')
    assert motion(after_loop, after_loop_motion, crop) > .3, 'Video stopped after its 8-second duration'

    light_root = ui()
    labels = ['Home', 'Pools', 'Deals', 'Exclusive', 'Cart']
    nav = {label: bounds(nav_node(light_root, label)) for label in labels}
    tap(find(light_root, 'moon-outline'))
    time.sleep(2)
    dark_root = ui()
    assert bounds(find(dark_root, 'Explore group deals')) == cta, 'Hero CTA moved in dark mode'
    assert {label: bounds(nav_node(dark_root, label)) for label in labels} == nav, 'Dock moved in dark mode'
    dark = shot('dark')
    # Header Home is the official logo's accessibility node.
    logo_box = bounds(find(dark_root, 'Home'))
    logo = dark.crop(logo_box)
    white = sum(1 for r,g,b in logo.getdata() if min(r,g,b)>225)
    assert white > logo.width*logo.height*.05, 'Dark logo is not visibly white'
    assert ImageStat.Stat(ImageChops.difference(first.crop(logo_box), logo)).mean != [0,0,0]
    tap(find(dark_root, 'sunny-outline'))
    time.sleep(1)
    shot('light-restored')
    # Scroll down and back: dock remains reachable, video still animates.
    adb('shell', 'input', 'swipe', str(first.width//2), str(int(first.height*.75)), str(first.width//2), str(int(first.height*.3)), '350')
    time.sleep(1)
    scrolled = ui()
    for label in labels:
        assert bounds(nav_node(scrolled, label)) == nav[label], 'Dock shifted while scrolling'
    shot('scrolled')
    tap(find(scrolled, 'Cart'))
    time.sleep(1)
    find(ui(), 'No direct products yet.')
    shot('cart')
    (OUT/'result.json').write_text(json.dumps({'passed':True, 'hero_height_dp':174, 'density':density, 'cta_bounds':cta, 'navigation_bounds':nav, 'motion_before_loop':motion(first,second,crop), 'motion_after_loop':motion(after_loop,after_loop_motion,crop)}, indent=2))
finally:
    (OUT/'logcat.txt').write_bytes(adb('logcat', '-d'))
