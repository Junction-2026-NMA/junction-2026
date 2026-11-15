#!/usr/bin/env python3
"""Writes 12_liito.rml. The source of Liito: the .rml it writes is plain RML (timelines, state machine, data binding), no scripts.
   usage: python3 rive/tools/liito-gen.py rive/sisu-ui/12_liito.rml [--bg] [--test=<mood>|--test=<mood>,<mood>,...]
     --bg           add a pale green background rectangle (scratch renders only)
     --test=<mood>  add a click listener that sets mood to <mood> (scratch only, to look at transitions)
     --test=a,b,c   one 12 x 12 click target per mood along the top edge (x = 10 + 16 i, y = 10), for chains of transitions"""
import math, sys

out_path = sys.argv[1]
BG = '--bg' in sys.argv
TEST = next((a.split('=')[1] for a in sys.argv if a.startswith('--test=')), None)
# --test=a,b,c (several moods): one small click target per mood along the top edge (x = 10 + 16 i, y = 10), for chains of transitions
TESTS = TEST.split(',') if TEST and ',' in TEST else None
if TESTS: TEST = None

MOODS = ['idle', 'cheering', 'proud', 'gliding', 'curious', 'found', 'focused', 'cosy', 'sleepy', 'thinking',
         'listening', 'writing', 'searching', 'calculating', 'comparing', 'presenting']   # the last six: Liito doing the task the agent is doing
ENUM = {m: f"0:{241 + i}" for i, m in enumerate(MOODS)}

ids = {'vm': '12:1', 'mood': '12:2', 'inst': '12:3', 'instMood': '12:4', 'artboard': '12:5', 'style': '12:6'}
_c = [6]
def I(name):
    if name not in ids:
        _c[0] += 1
        ids[name] = f"12:{_c[0]}"
    return ids[name]

GREY, CREAM, DARK, WHITE = 'FFB9C2BD', 'FFF4F1E8', 'FF0B1F16', 'FFFFFFFF'
SGREEN, DGREEN, DEEP, SOFT, MINT, PALE, AMBER = 'FF00AA46', 'FF004628', 'FF007841', 'FF99D59F', 'FF91FA9B', 'FFD2FCD5', 'FFCF8300'

def fill(c): return f'<Fill name="Fill"><SolidColor colorValue="{c}" name="Color"/></Fill>'
def stroke(c, t): return f'<Stroke thickness="{t}" cap="round" join="round" name="Stroke"><SolidColor colorValue="{c}" name="Color"/></Stroke>'
def n(v):
    s = f"{v:.4f}".rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

# ---------------------------------------------------------------- geometry
SHX, SHY, ARM = 50.0, -84.0, 38.0          # shoulder, arm length to the paw centre
REST = 0.22                                # arm rotation at rest (left arm is -REST)
TAILX, TAILY, TAILROT = 34.0, -16.0, 0.6
LEGX, LEGY, LEGLEN = 26.0, -22.0, 17.0
FOUND_ARM = 2.55

def hand(side, rot, k=1.0):  # k: arm scale
    """paw centre in body space. side -1 left, +1 right."""
    return (side * SHX - math.sin(rot) * ARM * k, SHY + math.cos(rot) * ARM * k)

# ---------------------------------------------------------------- scene
def eye(side, key):
    x = n(side * 28.5)
    return f'''                                        <Node x="{x}" name="Eye {key}" id="{I('eye' + key)}">
                                            <Shape y="18" scaleY="0" name="Lid {key}" id="{I('lid' + key)}">  <!-- lower lid: rises from under the eye, a smile, never a frown -->
                                                <Rectangle width="38" height="36" originY="1" name="Path"/>
                                                {fill(CREAM)}
                                            </Shape>
                                            <Shape y="18" scaleY="0" name="Tap Lid {key}" id="{I('tapLid' + key)}">  <!-- the same lid again, owned by the Tap layer, so a tap never fights the mood -->
                                                <Rectangle width="38" height="36" originY="1" name="Path"/>
                                                {fill(CREAM)}
                                            </Shape>
                                            <Shape name="Highlight {key}">
                                                <Ellipse width="10" height="10" x="-5.5" y="-6" name="Path"/>
                                                {fill(WHITE)}
                                            </Shape>
                                            <Shape name="Eye {key} Shape">
                                                <Ellipse width="34" height="34" name="Path"/>
                                                {fill(DARK)}
                                            </Shape>
                                        </Node>'''

def arc(x, up):
    # a closed-eye arc around x. up=True is the happy arc, up=False the sleeping one.
    e, m = (4, -6) if up else (-2, 6)
    return f'''<PointsPath isClosed="false" name="Arc">
                                            <StraightVertex x="{n(x - 11)}" y="{e}"/>
                                            <CubicMirroredVertex x="{n(x)}" y="{m}" rotation="0" distance="7"/>
                                            <StraightVertex x="{n(x + 11)}" y="{e}"/>
                                        </PointsPath>'''

CARD_ARM = 1.94          # comparing: the arms are raised to about this, the cards counter-rotate by it to stand upright
PENCIL_TIP = 32.0        # writing: from the paw (where the pencil is held) to the pencil's point, along the pencil

def card(key, rot, price, check=False):
    """comparing: an offer card that rides an arm, counter-rotated to stand upright; the paw holds its bottom edge."""
    badge = f'''
                                        <Node x="13" y="-45" scaleX="0" scaleY="0" opacity="0" name="Check" id="{I('check')}">  <!-- pops once per loop on the better offer -->
                                            <Shape name="Check Mark">
                                                <PointsPath isClosed="false" name="Path">
                                                    <StraightVertex x="-4.4" y="0.2"/>
                                                    <StraightVertex x="-1.2" y="3.4"/>
                                                    <StraightVertex x="4.6" y="-3.2"/>
                                                </PointsPath>
                                                {stroke(WHITE, 3)}
                                            </Shape>
                                            <Shape name="Check Disc">
                                                <Ellipse width="19" height="19" name="Path"/>
                                                {fill(SGREEN)}
                                            </Shape>
                                        </Node>''' if check else ''
    return f'''                                    <Node y="{n(ARM)}" rotation="{n(rot)}" scaleX="0" scaleY="0" opacity="0" name="Card {key}" id="{I('card' + key)}">  <!-- comparing: rides the arm, upright -->{badge}
                                        <Shape name="Card {key} Price">
                                            <Rectangle width="{n(price)}" height="7" cornerRadiusTL="3.5" x="-12" y="-35" originX="0" name="Path"/>
                                            {fill(DEEP)}
                                        </Shape>
                                        <Shape name="Card {key} Lines">
                                            <Rectangle width="24" height="3.6" cornerRadiusTL="1.8" x="-12" y="-23" originX="0" name="Line 1"/>
                                            <Rectangle width="16" height="3.6" cornerRadiusTL="1.8" x="-12" y="-15" originX="0" name="Line 2"/>
                                            {fill(SOFT)}
                                        </Shape>
                                        <Shape name="Card {key} Sheet">
                                            <Rectangle width="34" height="46" cornerRadiusTL="7" y="-23" name="Path"/>
                                            {stroke(DEEP, 3)}
                                            {fill(WHITE)}
                                        </Shape>
                                    </Node>'''

def pencil():
    """writing: a pencil held in the right paw. It lives in body space (so the arm can stretch without skewing it) and draws over
    the paws so it reads at 64 px; writing keys its position to the paw and its angle. Its point is PENCIL_TIP along it."""
    t = PENCIL_TIP
    return f'''                                <Node scaleX="0" scaleY="0" opacity="0" name="Pencil" id="{I('pencil')}">  <!-- writing: over the paws -->
                                    <Shape name="Pencil Point">
                                        <PointsPath isClosed="true" name="Path">
                                            <StraightVertex x="-2.4" y="{n(t - 4.5)}"/>
                                            <StraightVertex x="2.4" y="{n(t - 4.5)}"/>
                                            <StraightVertex x="0" y="{n(t)}"/>
                                        </PointsPath>
                                        {fill(DARK)}
                                    </Shape>
                                    <Shape name="Pencil Wood">
                                        <PointsPath isClosed="true" name="Path">
                                            <StraightVertex x="-4.5" y="{n(t - 11)}"/>
                                            <StraightVertex x="4.5" y="{n(t - 11)}"/>
                                            <StraightVertex x="0" y="{n(t)}"/>
                                        </PointsPath>
                                        {stroke(DGREEN, 1.6)}
                                        {fill(CREAM)}
                                    </Shape>
                                    <Shape name="Pencil Body">
                                        <Rectangle width="9" height="{n(t - 11 + 12)}" y="-12" originY="0" name="Path"/>
                                        {stroke(DGREEN, 1.6)}
                                        {fill(AMBER)}
                                    </Shape>
                                    <Shape name="Pencil End">
                                        <Rectangle width="9" height="6" cornerRadiusTL="3" y="-17" originY="0" name="Path"/>
                                        {stroke(DGREEN, 1.6)}
                                        {fill(SOFT)}
                                    </Shape>
                                </Node>'''

def arm(side, key):
    extra = ''
    if key == 'L':
        extra = f'''
{card('L', -CARD_ARM, 24)}
                                    <Node y="{n(ARM)}" scaleX="0" scaleY="0" opacity="0" name="Magnifier" id="{I('mag')}">  <!-- found and searching: rides the left arm -->
                                        <Shape y="27" opacity="0" name="Glint" id="{I('glint')}">  <!-- searching: light on the empty lens -->
                                            <PointsPath isClosed="false" name="Path">
                                                <StraightVertex x="{n(12 * math.cos(math.radians(40)))}" y="{n(12 * math.sin(math.radians(40)))}"/>
                                                <CubicMirroredVertex x="{n(12 * math.cos(math.radians(70)))}" y="{n(12 * math.sin(math.radians(70)))}" rotation="{n(math.radians(160))}" distance="3.2"/>
                                                <StraightVertex x="{n(12 * math.cos(math.radians(100)))}" y="{n(12 * math.sin(math.radians(100)))}"/>
                                            </PointsPath>
                                            {stroke(WHITE, 4)}
                                        </Shape>
                                        <Shape y="27" scaleX="0" scaleY="0" opacity="0" name="Ping" id="{I('ping')}">  <!-- searching: a ring that leaves the lens and fades -->
                                            <Ellipse width="42" height="42" name="Path"/>
                                            {stroke(SGREEN, 3.5)}
                                        </Shape>
                                        <Node y="27" rotation="{n(-FOUND_ARM)}" scaleX="1.3" scaleY="1.3" name="Drop" id="{I('drop')}">
                                            <Shape name="Drop Shape">
                                                <PointsPath isClosed="true" name="Path">
                                                    <StraightVertex x="0" y="-9"/>
                                                    <CubicMirroredVertex x="5.5" y="2" rotation="1.5708" distance="3.4"/>
                                                    <CubicMirroredVertex x="0" y="7.5" rotation="3.1416" distance="3"/>
                                                    <CubicMirroredVertex x="-5.5" y="2" rotation="-1.5708" distance="3.4"/>
                                                </PointsPath>
                                                {fill(SGREEN)}
                                            </Shape>
                                        </Node>
                                        <Shape y="27" name="Ring">
                                            <Ellipse width="42" height="42" name="Path"/>
                                            {stroke(DEEP, 6)}
                                            {fill(PALE)}
                                        </Shape>
                                        <Shape name="Handle">
                                            <Rectangle width="8" height="16" cornerRadiusTL="4" y="-4" originY="0" name="Path"/>
                                            {fill(DGREEN)}
                                        </Shape>
                                    </Node>'''
    if key == 'R':
        extra = f'''
{card('R', CARD_ARM, 15, check=True)}'''
    paw = f'''
                                    <Shape name="Paw {key}">
                                        <Ellipse width="22" height="22" y="{n(ARM)}" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>'''
    return f'''                                <Node x="{n(side * SHX)}" y="{n(SHY)}" rotation="{n(side * REST)}" name="Arm {key}" id="{I('arm' + key)}">{paw}{extra}
                                    <Shape name="Arm {key} Limb">
                                        <Rectangle width="17" height="{n(ARM + 6)}" cornerRadiusTL="8.5" y="-6" originY="0" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>
                                </Node>'''

def leg(side, key):
    return f'''                                <Node x="{n(side * LEGX)}" y="{n(LEGY)}" name="Leg {key}" id="{I('leg' + key)}">
                                    <Shape name="Foot {key}">
                                        <Ellipse width="34" height="16" y="{n(LEGLEN)}" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>
                                    <Shape name="Leg {key} Limb">
                                        <Rectangle width="17" height="30" cornerRadiusTL="8.5" y="-12" originY="0" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>
                                </Node>'''

def membrane(side, key):
    s = side
    return f'''                                <Shape opacity="0" name="Membrane {key}" id="{I('mem' + key)}">
                                    <PointsPath isClosed="true" name="Path">
                                        <StraightVertex x="{n(s * 50)}" y="-82" radius="4"/>
                                        <StraightVertex x="{n(s * 34)}" y="-48" radius="5" id="{I('mem' + key + 'H')}"/>
                                        <StraightVertex x="{n(s * 32)}" y="-26" radius="40" id="{I('mem' + key + 'M')}"/>
                                        <StraightVertex x="{n(s * 26)}" y="-5" radius="5" id="{I('mem' + key + 'F')}"/>
                                        <StraightVertex x="{n(s * 30)}" y="-22" radius="4"/>
                                    </PointsPath>
                                    {fill(SGREEN)}
                                </Shape>'''

def ear(side, key):
    return f'''                                    <Node x="{n(side * 40)}" y="-86" name="Ear {key}" id="{I('ear' + key)}">
                                        <Shape name="Ear {key} Shape">
                                            <Ellipse width="36" height="36" x="{n(side * 3)}" y="-9" name="Path"/>
                                            {fill(GREY)}
                                        </Shape>
                                    </Node>'''

def zee(key, x, y):
    return f'''                                    <Shape x="{x}" y="{y}" opacity="0" name="Z {key}" id="{I('z' + key)}">
                                        <PointsPath isClosed="false" name="Path">
                                            <StraightVertex x="-5.5" y="-5.5"/>
                                            <StraightVertex x="5.5" y="-5.5"/>
                                            <StraightVertex x="-5.5" y="5.5"/>
                                            <StraightVertex x="5.5" y="5.5"/>
                                        </PointsPath>
                                        {stroke(DEEP, 3.4)}
                                    </Shape>'''

def wisp(key, x):
    return f'''                                        <Shape x="{x}" y="-25" opacity="0" name="Steam {key}" id="{I('steam' + key)}">
                                            <PointsPath isClosed="false" name="Path">
                                                <StraightVertex x="0" y="0"/>
                                                <CubicMirroredVertex x="2.5" y="-5" rotation="-1.5708" distance="2.6"/>
                                                <CubicMirroredVertex x="-2.5" y="-11" rotation="-1.5708" distance="2.6"/>
                                                <StraightVertex x="0" y="-16"/>
                                            </PointsPath>
                                            {stroke(DEEP, 3)}
                                        </Shape>'''


# ---------------------------------------------------------------- task props (the six task moods)
WAVES_AT = (55.0, -158.0)    # listening: the right ear with the head tilted toward the sound
PAD_AT = (0.0, -42.0)        # writing: the notepad's centre (rotated PAD_ROT), low in front of the belly
PAD_ROT = 0.12
PAD_LINES = [(-13.0, -10.0, 18.0), (-13.0, 0.0, 18.0), (-10.0, 10.0, 11.0)]   # (left x, y, length) on the pad
CALC_AT = (12.0, -57.0)      # calculating: the calculator's centre
CALC_KEYS = [(x, y) for y in (1.0, 11.0, 21.0) for x in (-10.0, 0.0, 10.0)]
SUMS_AT = (84.0, -118.0)     # calculating: where the + - = symbols start, beside the head
BOARD_AT = (94.0, 0.0)       # presenting: the easel's foot, in root space (on the ground line)

def wave(i, r):
    a = math.radians(52)
    x0, y0 = r * math.cos(a), r * math.sin(a)
    return f'''                                    <Shape opacity="0" name="Wave {i}" id="{I('wave' + str(i))}">
                                        <PointsPath isClosed="false" name="Path">
                                            <StraightVertex x="{n(x0)}" y="{n(-y0)}"/>
                                            <CubicMirroredVertex x="{n(r)}" y="0" rotation="1.5708" distance="{n(r * 0.5)}"/>
                                            <StraightVertex x="{n(x0)}" y="{n(y0)}"/>
                                        </PointsPath>
                                        {stroke(SGREEN, 6)}
                                    </Shape>'''

def glyph(key, kind):
    segs = {'plus': [((-6.5, 0), (6.5, 0)), ((0, -6.5), (0, 6.5))], 'minus': [((-6.5, 0), (6.5, 0))],
            'equals': [((-6.5, -3.8), (6.5, -3.8)), ((-6.5, 3.8), (6.5, 3.8))]}[kind]
    paths = ''.join(f'''
                                        <PointsPath isClosed="false" name="Stroke {j + 1}">
                                            <StraightVertex x="{n(a[0])}" y="{n(a[1])}"/>
                                            <StraightVertex x="{n(b[0])}" y="{n(b[1])}"/>
                                        </PointsPath>''' for j, (a, b) in enumerate(segs))
    return f'''                                    <Shape opacity="0" scaleX="0" scaleY="0" name="{kind.title()}" id="{I(key)}">{paths}
                                        {stroke(DEEP, 4)}
                                    </Shape>'''

def pad_lines():
    out = []
    for i, (x, y, w) in enumerate(PAD_LINES):
        out.append(f'''                                        <Shape x="{n(x)}" y="{n(y)}" scaleX="0" name="Pad Line {i + 1}" id="{I('line' + str(i + 1))}">
                                            <Rectangle width="{n(w)}" height="3.8" cornerRadiusTL="1.9" originX="0" name="Path"/>
                                            {fill(DEEP)}
                                        </Shape>''')
    return chr(10).join(out)

def calc_keys():
    return chr(10).join(f'                                        <Ellipse width="6.5" height="6.5" x="{n(x)}" y="{n(y)}" name="Key {i + 1}"/>' for i, (x, y) in enumerate(CALC_KEYS))

def board_bars():
    out = []
    for i, (x, h, c) in enumerate(((-13, 13, SOFT), (0, 21, SGREEN), (13, 31, DEEP))):
        out.append(f'''            <Shape x="{x}" y="-80" scaleY="0" name="Bar {i + 1}" id="{I('bar' + str(i + 1))}">
                <Rectangle width="8.5" height="{h}" cornerRadiusTL="2.5" originY="1" name="Path"/>
                {fill(c)}
            </Shape>''')
    return chr(10).join(out)

bg = f'''
        <Shape x="120" y="120" name="TEST background">
            <Rectangle width="240" height="240" name="Path"/>
            {fill('FFEBF7EC')}
        </Shape>''' if BG else ''

tests = ''.join(f'''
        <Shape x="{10 + 16 * i}" y="10" name="TEST {tm}" id="{I('testHit' + str(i))}">
            <Rectangle width="12" height="12" name="Path"/>
            {fill('01FFFFFF')}
        </Shape>''' for i, tm in enumerate(TESTS)) if TESTS else ''

SCENE = f'''        <!-- Scene. The first sibling draws on top.
             Liito stands on the root node (the ground line under the feet). Four nested nodes carry the four kinds of motion:
             Squish (tap reaction) > Breath (always-on) > Pose (the mood: place, lean, squash, all from the feet)
             > Bank (rotation about the middle of the body, used by the glide) > Body (the parts). -->
        <Node x="112" y="228" name="Liito" id="{I('root')}">
            <Shape y="-90" name="Hit" id="{I('hit')}">  <!-- the tap target: the character only, not the whole artboard -->
                <Ellipse width="150" height="186" name="Path"/>
                {fill('00FFFFFF')}
            </Shape>
            <Node name="Squish" id="{I('squish')}">
                <Node name="Breath" id="{I('breath')}">
                    <Node name="Pose" id="{I('pose')}">
                        <Node y="-86" name="Bank" id="{I('bank')}">
                            <Node y="86" name="Body" id="{I('all')}">
                                <!-- Effects: thinking dots, sleeping z, both hidden until their mood. -->
                                <Node x="86" y="-185" opacity="0" scaleX="0" scaleY="0" name="Think Dots" id="{I('dots')}">
                                    <Shape x="-14" y="5" name="Dot 1" id="{I('dot1')}">
                                        <Ellipse width="10" height="10" name="Path"/>
                                        {fill(SGREEN)}
                                    </Shape>
                                    <Shape x="2" y="0" name="Dot 2" id="{I('dot2')}">
                                        <Ellipse width="10" height="10" name="Path"/>
                                        {fill(SGREEN)}
                                    </Shape>
                                    <Shape x="18" y="-5" name="Dot 3" id="{I('dot3')}">
                                        <Ellipse width="10" height="10" name="Path"/>
                                        {fill(SGREEN)}
                                    </Shape>
                                </Node>
                                <!-- Calculating: + - = pop out beside the head and float up, one after another. -->
                                <Node x="{n(SUMS_AT[0])}" y="{n(SUMS_AT[1])}" scaleX="0" scaleY="0" opacity="0" name="Sums" id="{I('sums')}">
{glyph('plus', 'plus')}
{glyph('minus', 'minus')}
{glyph('equals', 'equals')}
                                </Node>
                                <Node x="56" y="-150" opacity="0" name="Zs" id="{I('zs')}">
{zee('1', 0, 0)}
{zee('2', 0, 0)}
                                </Node>
                                <!-- Cosy props. The mug sits in the fold of the blanket; the blanket covers the arms. -->
                                <Node y="-34" scaleX="0" scaleY="0" opacity="0" name="Mug" id="{I('mug')}">
{wisp('1', -5)}
{wisp('2', 5)}
                                    <Shape name="Mug Paws">  <!-- the paws come out of the blanket with the mug -->
                                        <Ellipse width="17" height="17" x="-20" y="4" name="Paw L"/>
                                        <Ellipse width="17" height="17" x="21" y="5" name="Paw R"/>
                                        {fill(GREY)}
                                    </Shape>
                                    <Shape name="Mug Rim">
                                        <Ellipse width="31" height="6.5" y="-13.5" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape name="Mug Body">
                                        <Rectangle width="40" height="36" cornerRadiusTL="10" name="Path"/>
                                        {fill(DEEP)}
                                    </Shape>
                                    <Shape x="20" y="0" name="Mug Handle">
                                        <Ellipse width="18" height="18" name="Path"/>
                                        {stroke(DEEP, 5.5)}
                                    </Shape>
                                </Node>
                                <Node y="-2" opacity="0" scaleX="0.7" scaleY="0.7" name="Blanket" id="{I('blanket')}">
                                    <Shape name="Blanket Fold">  <!-- the collar: where the two halves of the wrap cross under the chin -->
                                        <PointsPath isClosed="false" name="Path">
                                            <StraightVertex x="-40" y="-76"/>
                                            <StraightVertex x="0" y="-56" radius="10"/>
                                            <StraightVertex x="40" y="-76"/>
                                        </PointsPath>
                                        {stroke(SOFT, 6)}
                                    </Shape>
                                    <Shape name="Blanket Shape">
                                        <Ellipse width="172" height="90" y="-41" name="Cocoon"/>
                                        <Rectangle width="150" height="40" cornerRadiusTL="18" y="-14" name="Hem"/>
                                        {fill(MINT)}
                                    </Shape>
                                </Node>
                                <Node y="-68" scaleX="0" scaleY="0" opacity="0" name="Berry" id="{I('berry')}">  <!-- focused: held under the chin, in front of the paws -->
                                    <Shape name="Berry Leaf">
                                        <Ellipse width="14" height="8" x="5" y="-14" rotation="-0.5" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape name="Berry Shape">
                                        <Ellipse width="30" height="29" name="Path"/>
                                        {fill(SGREEN)}
                                    </Shape>
                                </Node>
{pencil()}
{arm(-1, 'L')}
{arm(1, 'R')}
                                <!-- Writing: a notepad held in front of the belly; three lines appear one after another. Under the paws. -->
                                <Node x="{n(PAD_AT[0])}" y="{n(PAD_AT[1])}" rotation="{n(PAD_ROT)}" scaleX="0" scaleY="0" opacity="0" name="Notepad" id="{I('pad')}">
                                    <Node name="Pad Lines" id="{I('lines')}">
{pad_lines()}
                                    </Node>
                                    <Shape name="Pad Clip">
                                        <Rectangle width="26" height="8" cornerRadiusTL="3" y="-25" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape name="Pad Sheet">
                                        <Rectangle width="44" height="50" cornerRadiusTL="6" name="Path"/>
                                        {stroke(DEEP, 3)}
                                        {fill(WHITE)}
                                    </Shape>
                                </Node>
                                <!-- Calculating: a calculator held in front of the chest; the right paw taps the keys. Under the paws. -->
                                <Node x="{n(CALC_AT[0])}" y="{n(CALC_AT[1])}" scaleX="0" scaleY="0" opacity="0" name="Calculator" id="{I('calc')}">
                                    <Shape opacity="0" name="Key Glow" id="{I('glow')}">  <!-- the key being pressed -->
                                        <Ellipse width="11" height="11" name="Path"/>
                                        {fill(MINT)}
                                    </Shape>
                                    <Shape name="Keys">
{calc_keys()}
                                        {fill(PALE)}
                                    </Shape>
                                    <Shape x="13" y="-15" name="Digit 1" id="{I('dig1')}">
                                        <Rectangle width="4.5" height="7" cornerRadiusTL="1.2" originX="1" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape x="7" y="-15" name="Digit 2" id="{I('dig2')}">
                                        <Rectangle width="4.5" height="7" cornerRadiusTL="1.2" originX="1" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape x="1" y="-15" name="Digit 3" id="{I('dig3')}">
                                        <Rectangle width="4.5" height="7" cornerRadiusTL="1.2" originX="1" name="Path"/>
                                        {fill(DGREEN)}
                                    </Shape>
                                    <Shape name="Screen">
                                        <Rectangle width="30" height="11" cornerRadiusTL="3" y="-15" name="Path"/>
                                        {fill(PALE)}
                                    </Shape>
                                    <Shape name="Calculator Body">
                                        <Rectangle width="40" height="50" cornerRadiusTL="9" name="Path"/>
                                        {fill(DEEP)}
                                    </Shape>
                                </Node>
                                <!-- Listening: three arcs around the right ear; the sound arrives, outer arc first. Under the paws. -->
                                <Node x="{n(WAVES_AT[0])}" y="{n(WAVES_AT[1])}" scaleX="0" scaleY="0" opacity="0" name="Waves" id="{I('waves')}">
{wave(1, 22)}
{wave(2, 34)}
{wave(3, 46)}
                                </Node>
                                <!-- The jam jar (proud), hugged: behind the paws. -->
                                <Node y="-42" scaleX="0" scaleY="0" opacity="0" name="Jar" id="{I('jar')}">
                                    <Shape x="32" y="-30" scaleX="0" scaleY="0" name="Sparkle" id="{I('sparkle')}">
                                        <PointsPath isClosed="true" name="Path">
                                            <StraightVertex x="0" y="-7"/>
                                            <StraightVertex x="1.8" y="-1.8"/>
                                            <StraightVertex x="7" y="0"/>
                                            <StraightVertex x="1.8" y="1.8"/>
                                            <StraightVertex x="0" y="7"/>
                                            <StraightVertex x="-1.8" y="1.8"/>
                                            <StraightVertex x="-7" y="0"/>
                                            <StraightVertex x="-1.8" y="-1.8"/>
                                        </PointsPath>
                                        {fill(AMBER)}
                                    </Shape>
                                    <Shape name="Jar Lid">
                                        <Rectangle width="42" height="13" cornerRadiusTL="5" y="-23" name="Path"/>
                                        {fill(MINT)}
                                    </Shape>
                                    <Shape name="Jar Label">
                                        <Rectangle width="26" height="17" cornerRadiusTL="6" y="4" name="Path"/>
                                        {fill(PALE)}
                                    </Shape>
                                    <Shape name="Jar Body">
                                        <Rectangle width="50" height="44" cornerRadiusTL="12" y="2" name="Path"/>
                                        {fill(DEEP)}
                                    </Shape>
                                </Node>
                                <!-- Face. Rotates with Head Back (the same keys drive both); the belly sits between them so face and belly read as one pale shape. -->
                                <Node y="-70" name="Head" id="{I('head')}">
                                    <Node y="-48" name="Eyes" id="{I('eyes')}">
{eye(-1, 'L')}
{eye(1, 'R')}
                                    </Node>
                                    <Shape y="-48" opacity="0" name="Eyes Happy" id="{I('happy')}">
                                        {arc(-28.5, True)}
                                        {arc(28.5, True)}
                                        {stroke(DARK, 4.5)}
                                    </Shape>
                                    <Shape y="-48" opacity="0" name="Eyes Asleep" id="{I('asleep')}">
                                        {arc(-28.5, False)}
                                        {arc(28.5, False)}
                                        {stroke(DARK, 4.5)}
                                    </Shape>
                                    <Shape name="Nose">
                                        <Ellipse width="9" height="6.5" y="-35" name="Path"/>
                                        {fill(DARK)}
                                    </Shape>
                                    <Shape y="-28" name="Mouth Smile" id="{I('smile')}">
                                        <PointsPath isClosed="false" name="Path">
                                            <StraightVertex x="-6" y="0"/>
                                            <CubicMirroredVertex x="0" y="4" rotation="0" distance="3.6"/>
                                            <StraightVertex x="6" y="0"/>
                                        </PointsPath>
                                        {stroke(DARK, 2.6)}
                                    </Shape>
                                    <Shape y="-25" opacity="0" name="Mouth Open" id="{I('open')}">
                                        <Ellipse width="10" height="10" name="Path"/>
                                        {fill(DARK)}
                                    </Shape>
                                    <Shape y="-29" opacity="0" name="Mouth Grin" id="{I('grin')}">
                                        <PointsPath isClosed="true" name="Path">
                                            <StraightVertex x="-8" y="0" radius="2"/>
                                            <StraightVertex x="8" y="0" radius="2"/>
                                            <CubicMirroredVertex x="0" y="9" rotation="3.1416" distance="6"/>
                                        </PointsPath>
                                        {fill(DARK)}
                                    </Shape>
                                    <Shape opacity="0" name="Cheeks" id="{I('cheeks')}">
                                        <Ellipse width="15" height="10" x="-42" y="-28" name="Cheek L"/>
                                        <Ellipse width="15" height="10" x="42" y="-28" name="Cheek R"/>
                                        {fill(MINT)}
                                    </Shape>
                                    <Shape name="Face">
                                        <Ellipse width="62" height="68" x="-28.5" y="-50" name="Face L"/>
                                        <Ellipse width="62" height="68" x="28.5" y="-50" name="Face R"/>
                                        <Ellipse width="56" height="34" y="-30" name="Muzzle"/>
                                        {fill(CREAM)}
                                    </Shape>
                                </Node>
                                <Shape name="Belly">
                                    <Ellipse width="78" height="88" y="-50" name="Path"/>
                                    {fill(CREAM)}
                                </Shape>
                                <Node y="-70" name="Head Back" id="{I('headBack')}">
                                    <Shape name="Head Shape">
                                        <Ellipse width="132" height="106" y="-46" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>
{ear(-1, 'L')}
{ear(1, 'R')}
                                </Node>
                                <Shape name="Body Shape">
                                    <Rectangle width="124" height="114" cornerRadiusTL="54" y="-59" name="Path"/>
                                    {fill(GREY)}
                                </Shape>
                                <!-- The glide membrane: S green inside, behind the body, so it only shows when the limbs spread. Its three outer points are keyed. -->
{membrane(-1, 'L')}
{membrane(1, 'R')}
{leg(-1, 'L')}
{leg(1, 'R')}
                                <Node x="{n(TAILX)}" y="{n(TAILY)}" rotation="{n(TAILROT)}" name="Tail" id="{I('tail')}">
                                    <Shape name="Tail Shape">
                                        <Ellipse width="74" height="108" y="-50" name="Path"/>
                                        {fill(GREY)}
                                    </Shape>
                                </Node>
                            </Node>
                        </Node>
                    </Node>
                </Node>
            </Node>
            <!-- Presenting: a chart on an easel beside Liito, standing on the ground line (root space, so Liito's pose does not move it). Under Liito. -->
            <Node x="{n(BOARD_AT[0])}" y="{n(BOARD_AT[1])}" scaleX="0" scaleY="0" opacity="0" name="Board" id="{I('board')}">
{board_bars()}
                <Shape name="Board Panel">
                    <Rectangle width="54" height="48" cornerRadiusTL="6" y="-100" name="Path"/>
                    {stroke(DEEP, 3)}
                    {fill(WHITE)}
                </Shape>
                <Shape name="Easel">
                    <PointsPath isClosed="false" name="Leg L">
                        <StraightVertex x="-15" y="-78"/>
                        <StraightVertex x="-21" y="-2"/>
                    </PointsPath>
                    <PointsPath isClosed="false" name="Leg R">
                        <StraightVertex x="15" y="-78"/>
                        <StraightVertex x="21" y="-2"/>
                    </PointsPath>
                    <PointsPath isClosed="false" name="Rail">
                        <StraightVertex x="-18" y="-34"/>
                        <StraightVertex x="18" y="-34"/>
                    </PointsPath>
                    {stroke(DGREEN, 4)}
                </Shape>
            </Node>
        </Node>{bg}{tests}
'''

# ---------------------------------------------------------------- channels
CH = {
    'pose.x': [('pose', 'x')], 'pose.y': [('pose', 'y')], 'pose.rot': [('pose', 'rotation')],
    'pose.sx': [('pose', 'scaleX')], 'pose.sy': [('pose', 'scaleY')], 'bank.rot': [('bank', 'rotation')],
    'head.y': [('head', 'y'), ('headBack', 'y')], 'head.rot': [('head', 'rotation'), ('headBack', 'rotation')],
    'eyes.x': [('eyes', 'x')], 'eyes.y': [('eyes', 'y')], 'eyes.sx': [('eyes', 'scaleX')], 'eyes.sy': [('eyes', 'scaleY')],
    'eyes.op': [('eyes', 'opacity')], 'lids': [('lidL', 'scaleY'), ('lidR', 'scaleY')],
    'happy.op': [('happy', 'opacity')], 'asleep.op': [('asleep', 'opacity')],
    'smile.op': [('smile', 'opacity')], 'open.op': [('open', 'opacity')], 'open.sx': [('open', 'scaleX')], 'open.sy': [('open', 'scaleY')],
    'cheeks.op': [('cheeks', 'opacity')], 'grin.op': [('grin', 'opacity')],
    'earL.rot': [('earL', 'rotation')], 'earR.rot': [('earR', 'rotation')],
    'armL.rot': [('armL', 'rotation')], 'armR.rot': [('armR', 'rotation')], 'armL.sy': [('armL', 'scaleY')], 'armR.sy': [('armR', 'scaleY')],
    'tail.x': [('tail', 'x')], 'tail.y': [('tail', 'y')], 'tail.rot': [('tail', 'rotation')], 'tail.sx': [('tail', 'scaleX')], 'tail.sy': [('tail', 'scaleY')],
    'mem.op': [('memL', 'opacity'), ('memR', 'opacity')],
    'jar.s': [('jar', 'scaleX'), ('jar', 'scaleY'), ('jar', 'opacity')], 'jar.rot': [('jar', 'rotation')], 'sparkle.s': [('sparkle', 'scaleX'), ('sparkle', 'scaleY')],
    'berry.s': [('berry', 'scaleX'), ('berry', 'scaleY'), ('berry', 'opacity')], 'mag.s': [('mag', 'scaleX'), ('mag', 'scaleY'), ('mag', 'opacity')],
    'mug.s': [('mug', 'scaleX'), ('mug', 'scaleY'), ('mug', 'opacity')],
    'blanket.op': [('blanket', 'opacity')], 'blanket.s': [('blanket', 'scaleX'), ('blanket', 'scaleY')],
    'dots.op': [('dots', 'opacity')], 'dots.s': [('dots', 'scaleX'), ('dots', 'scaleY')], 'zs.op': [('zs', 'opacity')],
    'dot1.y': [('dot1', 'y')], 'dot2.y': [('dot2', 'y')], 'dot3.y': [('dot3', 'y')],
    'breath.sx': [('breath', 'scaleX')], 'breath.sy': [('breath', 'scaleY')],
    'squish.sx': [('squish', 'scaleX')], 'squish.sy': [('squish', 'scaleY')], 'squish.y': [('squish', 'y')],
    'blink': [('eyeL', 'scaleY'), ('eyeR', 'scaleY')], 'taplids': [('tapLidL', 'scaleY'), ('tapLidR', 'scaleY')],
    # the task moods' props: a container per prop, hidden by scale and opacity together
    'waves.s': [('waves', 'scaleX'), ('waves', 'scaleY'), ('waves', 'opacity')],
    'pad.s': [('pad', 'scaleX'), ('pad', 'scaleY'), ('pad', 'opacity')],
    'pencil.s': [('pencil', 'scaleX'), ('pencil', 'scaleY'), ('pencil', 'opacity')],
    'calc.s': [('calc', 'scaleX'), ('calc', 'scaleY'), ('calc', 'opacity')],
    'sums.s': [('sums', 'scaleX'), ('sums', 'scaleY'), ('sums', 'opacity')],
    'cardL.s': [('cardL', 'scaleX'), ('cardL', 'scaleY'), ('cardL', 'opacity')],
    'cardR.s': [('cardR', 'scaleX'), ('cardR', 'scaleY'), ('cardR', 'opacity')],
    'board.s': [('board', 'scaleX'), ('board', 'scaleY'), ('board', 'opacity')],
    'ping.s': [('ping', 'scaleX'), ('ping', 'scaleY')], 'ping.op': [('ping', 'opacity')], 'glint.op': [('glint', 'opacity')],
    'drop.s': [('drop', 'scaleX'), ('drop', 'scaleY')], 'drop.op': [('drop', 'opacity')],
    # and what moves inside them (keyed only by the mood that shows the prop)
    'pencil.rot': [('pencil', 'rotation')], 'pencil.x': [('pencil', 'x')], 'pencil.y': [('pencil', 'y')], 'lines.op': [('lines', 'opacity')],
    'line1.sx': [('line1', 'scaleX')], 'line2.sx': [('line2', 'scaleX')], 'line3.sx': [('line3', 'scaleX')],
    'glow.x': [('glow', 'x')], 'glow.y': [('glow', 'y')], 'glow.op': [('glow', 'opacity')],
    'dig1.sy': [('dig1', 'scaleY')], 'dig2.sy': [('dig2', 'scaleY')], 'dig3.sy': [('dig3', 'scaleY')],
    'check.s': [('check', 'scaleX'), ('check', 'scaleY'), ('check', 'opacity')],
    'bar1.sy': [('bar1', 'scaleY')], 'bar2.sy': [('bar2', 'scaleY')], 'bar3.sy': [('bar3', 'scaleY')],
}
for w in ('wave1', 'wave2', 'wave3'):
    CH[w + '.op'] = [(w, 'opacity')]
    CH[w + '.s'] = [(w, 'scaleX'), (w, 'scaleY')]
for g in ('plus', 'minus', 'equals'):
    for p_, prop in (('x', 'x'), ('y', 'y'), ('op', 'opacity')):
        CH[f'{g}.{p_}'] = [(g, prop)]
    CH[g + '.s'] = [(g, 'scaleX'), (g, 'scaleY')]
for k in ('L', 'R'):
    for p, prop in (('x', 'x'), ('y', 'y'), ('rot', 'rotation'), ('sx', 'scaleX'), ('sy', 'scaleY')):
        CH[f'leg{k}.{p}'] = [('leg' + k, prop)]
    for v in 'HMF':
        CH[f'mem{k}{v}.x'] = [(f'mem{k}{v}', 'x')]
        CH[f'mem{k}{v}.y'] = [(f'mem{k}{v}', 'y')]
for z in ('z1', 'z2', 'steam1', 'steam2'):
    for p, prop in (('x', 'x'), ('y', 'y'), ('op', 'opacity'), ('s', 'scaleX'), ('s2', 'scaleY')):
        CH[f'{z}.{p}'] = [(z, prop)]

# ---------------------------------------------------------------- easing and key lists
IO = (0.42, 0, 0.58, 1)          # ease in and out
SINE = (0.37, 0, 0.63, 1)        # close to a sine half-wave
EO = (0.16, 0.6, 0.3, 1)         # fast start, soft landing
EI = (0.6, 0, 0.85, 0.45)        # slow start, fast end (falling)
LIN = (0.25, 0.25, 0.75, 0.75)   # linear, written as a cubic
SNAP = (0.3, 0, 0.1, 1)

def K(*pts, e=IO):
    """key list from (frame, value[, ease]) points; the ease shapes the segment that starts at its key."""
    return [(p[0], p[1], p[2] if len(p) > 2 else e) for p in pts]

def bez_split(e, t0):
    x1, y1, x2, y2 = e
    lo, hi = 0.0, 1.0
    for _ in range(60):
        s = (lo + hi) / 2
        x = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3
        if x < t0: lo = s
        else: hi = s
    s = (lo + hi) / 2
    P = [(0, 0), (x1, y1), (x2, y2), (1, 1)]
    L = lambda a, b: (a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s)
    A, B, C = L(P[0], P[1]), L(P[1], P[2]), L(P[2], P[3])
    D, E = L(A, B), L(B, C)
    F = L(D, E)
    def norm(p0, p1, p2, p3):
        w, h = p3[0] - p0[0], p3[1] - p0[1]
        f = lambda p: ((p[0] - p0[0]) / w, (p[1] - p0[1]) / h if abs(h) > 1e-9 else 0.0)
        a, b = f(p1), f(p2)
        return (round(a[0], 4), round(a[1], 4), round(b[0], 4), round(b[1], 4))
    return F[1], norm(P[0], A, D, F), norm(F, E, C, P[3])

def shift(keys, d, dur):
    """the same looping key list, played d frames later (wraps around the loop)."""
    d = int(round(d)) % dur
    if d == 0: return keys
    segs = []
    for (f0, v0, e0), (f1, v1, _) in zip(keys, keys[1:]):
        a, b = f0 + d, f1 + d
        if a >= dur: segs.append((a - dur, v0, e0, b - dur, v1))
        elif b <= dur: segs.append((a, v0, e0, b, v1))
        else:
            y, eL, eR = bez_split(e0, (dur - a) / (b - a))
            vm = v0 + (v1 - v0) * y
            segs.append((a, v0, eL, dur, vm))
            segs.append((0, vm, eR, b - dur, v1))
    segs.sort(key=lambda s: s[0])
    out = [(s[0], s[1], s[2]) for s in segs]
    out.append((segs[-1][3], segs[-1][4], IO))
    return out

def rep(keys, period, dur):
    """repeat a key list of length `period` until `dur`."""
    out = []
    for i in range(dur // period):
        out += [(f + i * period, v, e) for (f, v, e) in (keys if i == 0 else keys[1:])]
    return out

def osc(a, b, period, dur, phase=0.0, e=SINE):
    """swing a -> b -> a every `period` frames; `phase` (0..1 of a period) plays it late, for follow-through."""
    assert dur % period == 0 and period % 2 == 0
    base = rep(K((0, a), (period // 2, b), (period, a), e=e), period, dur)
    return shift(base, phase * period, dur)

def neg(keys):
    """mirror a key list for the other side."""
    if isinstance(keys, (int, float)): return -keys
    return [(f, -v, e) for (f, v, e) in keys]

def at(keys, f):
    """value of a channel at frame f (only used on key frames)."""
    if isinstance(keys, (int, float)): return keys
    for (kf, v, e) in keys:
        if kf == f: return v
    # between keys: evaluate the eased segment
    for (f0, v0, e0), (f1, v1, _) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            y, _, _ = bez_split(e0, (f - f0) / (f1 - f0)) if f1 > f0 else (0, 0, 0)
            return v0 + (v1 - v0) * y
    return keys[-1][1]

# ---------------------------------------------------------------- the rest pose: every mood keys all of these
PI = math.pi
DEFAULT = {
    'pose.x': 0, 'pose.y': 0, 'pose.rot': 0, 'pose.sx': 1, 'pose.sy': 1, 'bank.rot': 0,
    'head.y': -70, 'head.rot': 0,
    'eyes.x': 0, 'eyes.y': -48, 'eyes.sx': 1, 'eyes.sy': 1, 'eyes.op': 1, 'lids': 0,
    'happy.op': 0, 'asleep.op': 0, 'smile.op': 1, 'open.op': 0, 'open.sx': 1, 'open.sy': 1, 'grin.op': 0, 'cheeks.op': 0,
    'earL.rot': 0, 'earR.rot': 0, 'armL.rot': -REST, 'armR.rot': REST, 'armL.sy': 1, 'armR.sy': 1,
    'legL.x': -LEGX, 'legL.y': LEGY, 'legL.rot': 0, 'legL.sx': 1, 'legL.sy': 1,
    'legR.x': LEGX, 'legR.y': LEGY, 'legR.rot': 0, 'legR.sx': 1, 'legR.sy': 1,
    'tail.x': TAILX, 'tail.y': TAILY, 'tail.rot': TAILROT, 'tail.sx': 1, 'tail.sy': 1,
    'mem.op': 0,
    'jar.s': 0, 'berry.s': 0, 'mag.s': 0, 'mug.s': 0, 'blanket.op': 0, 'blanket.s': 0.7,
    'dots.op': 0, 'dots.s': 0, 'zs.op': 0,
    'waves.s': 0, 'pad.s': 0, 'pencil.s': 0, 'calc.s': 0, 'sums.s': 0, 'cardL.s': 0, 'cardR.s': 0, 'board.s': 0,
    'ping.s': 0, 'ping.op': 0, 'glint.op': 0, 'drop.s': 1.3, 'drop.op': 1,
}
HEADY, EYESY = -70, -48

def mirror_legs(m, x, y, rot, sx, sy):
    m.update({'legL.x': -x, 'legL.y': y, 'legL.rot': rot, 'legL.sx': sx, 'legL.sy': sy,
              'legR.x': x, 'legR.y': y, 'legR.rot': -rot, 'legR.sx': sx, 'legR.sy': sy})

def closed_eyes(m, which):
    m.update({'eyes.op': 0, 'eyes.sy': 0.12, which: 1})

# ---------------------------------------------------------------- the moods
def idle():
    D = 480
    m = {'_dur': D}
    m['tail.rot'] = osc(0.56, 0.66, 240, D)
    m['earR.rot'] = K((0, 0), (150, 0, EO), (155, 0.30), (163, -0.09), (171, 0.05), (180, 0), (480, 0))
    m['earL.rot'] = K((0, 0), (326, 0, EO), (331, -0.24), (339, 0.07), (347, 0), (480, 0))
    m['eyes.x'] = K((0, 0), (236, 0), (248, 4), (312, 4), (324, 0), (480, 0), e=SNAP)
    m['head.rot'] = K((0, 0), (238, 0), (258, 0.04), (310, 0.04), (334, 0), (480, 0))
    m['armL.rot'] = osc(-REST, -REST + 0.045, 240, D, 0.1)
    m['armR.rot'] = osc(REST, REST - 0.045, 240, D, 0.1)
    return m

def cheering():
    D = 48
    m = {'_dur': D}
    m['pose.y'] = K((0, 0), (5, 0, EO), (21, -15, EI), (36, 0), (48, 0))
    m['pose.sy'] = K((0, 0.93), (8, 1.06), (21, 1.0), (36, 1.04, EO), (41, 0.90), (48, 0.93))
    m['pose.sx'] = K((0, 1.06), (8, 0.95), (21, 1.0), (36, 0.97, EO), (41, 1.09), (48, 1.06))
    armL = K((0, 2.44), (9, 2.30), (23, 2.56), (35, 2.68), (43, 2.48), (48, 2.44))
    m['armL.rot'], m['armR.rot'] = armL, neg(armL)
    m['head.y'] = K((0, HEADY + 2), (8, HEADY), (21, HEADY - 1.5), (36, HEADY), (42, HEADY + 3), (48, HEADY + 2))
    earL = K((0, 0.06), (10, -0.18), (24, 0.0), (37, 0.16), (44, 0.0), (48, 0.06))
    m['earL.rot'], m['earR.rot'] = earL, neg(earL)
    m['tail.rot'] = K((0, 0.56), (11, 0.72), (25, 0.6), (38, 0.46), (45, 0.6), (48, 0.56))
    m.update({'eyes.sx': 1.08, 'eyes.sy': 1.08, 'smile.op': 0, 'grin.op': 1, 'mem.op': 1, 'lids': 0.22})
    m['_memF'] = (84, -12)
    mirror_legs(m, 30, LEGY, 0.1, 1, 1)
    return m

def cheering_in():  # the first jump: bigger than the hops, plays once, then hands over to the loop
    m = cheering()
    m['_dur'], m['_loop'] = 44, False
    m['pose.y'] = K((0, 0), (9, 0, EO), (25, -24, EI), (39, 0), (44, 0))
    m['pose.sy'] = K((0, 0.93), (9, 0.86), (15, 1.1), (25, 1.0), (39, 1.06, EO), (42, 0.89), (44, 0.93))
    m['pose.sx'] = K((0, 1.06), (9, 1.08), (15, 0.94), (25, 1.0), (39, 0.96, EO), (42, 1.08), (44, 1.06))
    armL = K((0, 2.3), (9, 2.05), (22, 2.75), (36, 2.72), (42, 2.5), (44, 2.44))
    m['armL.rot'], m['armR.rot'] = armL, neg(armL)
    m['head.y'] = K((0, HEADY + 2), (9, HEADY + 4), (17, HEADY - 2), (25, HEADY - 1.5), (39, HEADY), (42, HEADY + 3), (44, HEADY + 2))
    earL = K((0, 0.06), (11, -0.24), (26, 0.04), (40, 0.2), (44, 0.06))
    m['earL.rot'], m['earR.rot'] = earL, neg(earL)
    m['tail.rot'] = K((0, 0.56), (12, 0.66), (27, 0.54), (40, 0.44), (44, 0.56))
    return m

def proud():
    D = 240
    m = {'_dur': D}
    m['pose.rot'] = osc(-0.04, 0.04, 240, D)
    m['head.rot'] = osc(-0.04, 0.04, 240, D, 0.09)
    m['tail.rot'] = osc(0.52, 0.66, 240, D, 0.17)
    earL = osc(-0.05, 0.05, 240, D, 0.2)
    m['earL.rot'], m['earR.rot'] = earL, earL
    m['jar.s'] = 1
    m['jar.rot'] = osc(-0.05, 0.05, 240, D, 0.12)
    m['sparkle.s'] = K((0, 0), (40, 0, EO), (56, 1), (74, 0.75), (92, 1, EI), (112, 0), (240, 0))
    m.update({'armL.rot': -0.74, 'armR.rot': 0.74, 'cheeks.op': 1, 'head.y': HEADY + 1})
    closed_eyes(m, 'happy.op')
    return m

def gliding():
    D = 360
    m = {'_dur': D}
    m['pose.y'] = osc(-57, -47, 180, D)
    m['pose.x'] = osc(1, 15, 360, D, 0.25)
    m['pose.sx'], m['pose.sy'] = 0.92, 0.86
    m['bank.rot'] = osc(-0.11, 0.11, 360, D)
    m['armL.rot'] = osc(1.78, 1.88, 180, D, 0.1)
    m['armR.rot'] = osc(-1.88, -1.78, 180, D, 0.6)
    m['tail.rot'] = osc(PI + 0.19, PI - 0.19, 360, D, 0.13)
    m.update({'tail.x': 0, 'tail.y': -28, 'tail.sx': 0.8, 'tail.sy': 0.74, 'mem.op': 1, 'armL.sy': 1.4, 'armR.sy': 1.4})
    m['head.rot'] = osc(0.05, -0.05, 360, D, 0.05)    # the head stays nearly level while the body banks
    m['eyes.x'] = osc(-2.5, 2.5, 360, D, 0.2)         # and looks where the drift goes
    m['earL.rot'] = osc(-0.07, 0.03, 90, D)
    m['earR.rot'] = osc(-0.03, 0.07, 90, D, 0.5)
    mirror_legs(m, 54, -26, 1.05, 0.66, 1.9)
    return m

def curious():
    D = 300
    m = {'_dur': D}
    m['pose.rot'] = osc(-0.08, -0.035, 300, D)
    m['head.rot'] = osc(-0.25, -0.19, 300, D, 0.1)
    m['earL.rot'] = osc(-0.85, -0.72, 300, D, 0.22)
    m['earR.rot'] = osc(0.1, 0.04, 300, D, 0.22)
    m['tail.rot'] = osc(0.6, 0.74, 300, D, 0.25)
    m.update({'eyes.x': 4.5, 'eyes.y': EYESY - 3.5, 'armR.rot': 0.2, 'pose.x': 4})
    return m

def found_pose():
    m = {'pose.x': 14, 'armR.rot': 0.05, 'eyes.sx': 1.14, 'eyes.sy': 1.14, 'smile.op': 0, 'open.op': 1,
         'open.sx': 0.8, 'open.sy': 0.8, 'mag.s': 1, 'earL.rot': 0.1, 'earR.rot': -0.1}
    return m

def found_in():  # the "aha": plays once, then hands over to the loop
    m = found_pose()
    m['_dur'], m['_loop'] = 60, False
    m['pose.y'] = K((0, 0), (9, 0, EO), (21, -11, EI), (33, 0), (60, 0))
    m['pose.sy'] = K((0, 0.95), (9, 0.92), (19, 1.06), (33, 1.02, EO), (38, 0.94), (47, 1.02), (55, 1), (60, 1))
    m['pose.sx'] = K((0, 1.03), (9, 1.04), (19, 0.96), (33, 0.99, EO), (38, 1.04), (47, 0.99), (55, 1), (60, 1))
    m['armL.rot'] = K((0, 2.5), (11, 2.46), (25, 2.76), (37, 2.49), (48, 2.59), (60, FOUND_ARM))
    m['eyes.sx'] = m['eyes.sy'] = K((0, 1.0), (9, 0.95, EO), (21, 1.22), (40, 1.14), (60, 1.14))
    m['head.rot'] = K((0, 0), (12, 0.03), (28, -0.08), (44, -0.04), (60, -0.05))
    earL = K((0, 0.1), (12, -0.12), (26, 0.22), (40, 0.06), (60, 0.1))
    m['earL.rot'], m['earR.rot'] = earL, neg(earL)
    m['tail.rot'] = K((0, 0.45), (13, 0.56), (27, 0.34), (42, 0.48), (60, 0.45))
    return m

def found():
    D = 240
    m = found_pose()
    m['_dur'] = D
    m['armL.rot'] = osc(FOUND_ARM, FOUND_ARM + 0.06, 240, D)
    m['head.rot'] = osc(-0.05, -0.02, 240, D)
    m['tail.rot'] = osc(0.45, 0.53, 240, D)
    return m

def focused():
    D = 150
    m = {'_dur': D}
    m['head.y'] = K((0, HEADY + 3), (38, HEADY + 3, SNAP), (46, HEADY + 7.5), (56, HEADY + 2.5), (63, HEADY + 6.5), (76, HEADY + 3), (150, HEADY + 3))
    m['pose.sy'] = K((0, 0.985), (38, 0.985, SNAP), (47, 0.965), (57, 0.99), (64, 0.97), (78, 0.985), (150, 0.985))
    earL = K((0, 0.16), (40, 0.16), (49, 0.26), (58, 0.12), (66, 0.22), (80, 0.16), (150, 0.16))
    m['earL.rot'], m['earR.rot'] = earL, neg(earL)
    m['tail.rot'] = osc(0.6, 0.67, 150, D, 0.2)
    m.update({'pose.rot': -0.045, 'head.rot': -0.05, 'eyes.y': EYESY + 4.5, 'eyes.x': -1, 'eyes.sx': 0.95, 'eyes.sy': 0.95,
              'berry.s': 1, 'armL.rot': -0.86, 'armR.rot': 0.86, 'pose.sx': 1.02})
    return m

def cosy():
    D = 300
    m = {'_dur': D}
    m['pose.sy'] = osc(1.0, 1.03, 300, D)
    m['pose.sx'] = osc(1.0, 0.988, 300, D)
    m['head.rot'] = osc(0.04, 0.075, 300, D, 0.1)
    m['head.y'] = osc(HEADY + 3, HEADY + 1.5, 300, D, 0.06)
    m.update({'blanket.op': 1, 'blanket.s': 1, 'mug.s': 1, 'earL.rot': -0.14, 'earR.rot': 0.14, 'tail.rot': 0.5})
    closed_eyes(m, 'happy.op')
    y = K((0, 2), (149, -15), (150, 2), (299, -15), (300, 2), e=LIN)
    op = rep(K((0, 0), (36, 0.9), (100, 0.9), (150, 0)), 150, D)
    m['steam1.y'], m['steam1.op'] = y, op
    m['steam2.y'], m['steam2.op'] = shift(y, 75, D), shift(op, 75, D)
    return m

def sleepy():
    D = 360
    m = {'_dur': D}
    m['pose.sy'] = osc(0.92, 0.965, 360, D)
    m['pose.sx'] = osc(1.05, 1.03, 360, D)
    m['head.y'] = osc(HEADY + 8, HEADY + 5, 360, D, 0.07)
    m['head.rot'] = osc(0.13, 0.09, 360, D, 0.09)
    m['open.sx'] = m['open.sy'] = osc(0.45, 0.72, 360, D, 0.05)
    m.update({'smile.op': 0, 'open.op': 1, 'earL.rot': -0.38, 'earR.rot': 0.38, 'armL.rot': -0.5, 'armR.rot': 0.5,
              'tail.rot': 0.48, 'zs.op': 1})
    closed_eyes(m, 'asleep.op')
    zx = K((0, 0), (240, 24), (241, 0), (360, 0), e=LIN)
    zy = K((0, 0), (240, -36), (241, 0), (360, 0), e=(0.2, 0.4, 0.6, 1))
    zo = K((0, 0), (30, 1), (180, 1), (240, 0), (360, 0))
    zs = K((0, 0.8), (240, 1.7), (241, 0.8), (360, 0.8), e=LIN)
    for i, z in enumerate(('z1', 'z2')):
        d = 180 * i
        m[z + '.x'], m[z + '.y'], m[z + '.op'] = shift(zx, d, D), shift(zy, d, D), shift(zo, d, D)
        m[z + '.s'] = m[z + '.s2'] = shift(zs, d, D)
    return m

def thinking():
    D = 288
    m = {'_dur': D}
    m['head.rot'] = osc(0.13, 0.175, 288, D)
    m['pose.rot'] = osc(0.02, 0.045, 288, D, 0.1)
    m['tail.rot'] = osc(0.6, 0.7, 288, D, 0.3)
    m['earR.rot'] = osc(0.1, 0.16, 288, D, 0.2)
    m.update({'eyes.x': 3, 'eyes.y': EYESY - 5.5, 'armR.rot': 1.32, 'earL.rot': 0.04, 'dots.op': 1, 'dots.s': 1})
    hop = rep(K((0, 0), (4, 0, EO), (14, -10, EI), (24, 0), (96, 0)), 96, D)
    for i in range(3):
        m[f'dot{i + 1}.y'] = shift(hop, 16 * i, D)
    return m


# ---------------------------------------------------------------- the task moods: Liito doing what the agent is doing
def u(a):
    """the direction an arm points at rotation a (its local +y), in body space."""
    return (-math.sin(a), math.cos(a))

def reach(T, side=1):
    """one arm stretched to put its paw on T: (rotation, scaleY)."""
    vx, vy = T[0] - side * SHX, T[1] - SHY
    return math.atan2(-vx, vy), math.hypot(vx, vy) / ARM

def pencil_grip(T):
    """writing: where the paw holds the pencil so its point is on T. The pencil's angle is chosen per point so the arm stays
    close to its own length (the wrist turns as the line goes on). Returns (angle, paw, arm rotation, arm scaleY)."""
    best = None
    for i in range(96):
        th = 0.3 + i * 0.01
        px, py = T[0] + PENCIL_TIP * math.sin(th), T[1] - PENCIL_TIP * math.cos(th)
        if py < -82: continue                               # never up at the chin
        r, k = reach((px, py))
        cost = abs(k - 1) + 0.15 * abs(th - 0.65)
        if best is None or cost < best[0]:
            best = (cost, th, (px, py), r, k)
    assert best is not None, ('pencil cannot reach', T)
    return best[1:]

def pad_point(lx, ly):
    c, s_ = math.cos(PAD_ROT), math.sin(PAD_ROT)
    return (PAD_AT[0] + lx * c - ly * s_, PAD_AT[1] + lx * s_ + ly * c)

def keys_from(frames, values, e=SINE):
    return [(f, v, e) for f, v in zip(frames, values)]

def listening():
    D = 240
    m = {'_dur': D}
    m['pose.rot'] = osc(0.025, 0.04, 240, D)
    m['head.rot'] = osc(0.11, 0.15, 120, D, 0.1)          # tilted toward the sound, nodding gently
    m['head.y'] = osc(HEADY, HEADY + 1.5, 120, D, 0.1)
    m['earR.rot'] = K((0, 0.16), (52, 0.16, EO), (57, 0.4), (64, 0.08), (71, 0.22), (80, 0.16), (172, 0.16, EO), (177, 0.36),
                      (184, 0.1), (192, 0.16), (240, 0.16))  # perked toward the sound, twitching
    m['earL.rot'] = osc(-0.1, -0.05, 240, D, 0.2)
    m['armL.rot'] = osc(-0.62, -0.56, 120, D, 0.2)         # paws together in front: all ears
    m['armR.rot'] = osc(0.62, 0.56, 120, D, 0.2)
    m['tail.rot'] = osc(0.6, 0.7, 240, D, 0.25)
    m.update({'eyes.x': 4, 'eyes.y': EYESY - 1.5, 'eyes.sx': 1.1, 'eyes.sy': 1.1, 'waves.s': 1, 'pose.x': -4})
    # the sound arrives: the outer arc lights first, then the middle, then the inner one, each drifting toward the ear.
    # An arc never goes out completely, so any single frame (and a 64 px badge) still shows the sound.
    base_op = rep(K((0, 0.3), (10, 1, SINE), (30, 0.3), (60, 0.3)), 60, D)
    base_s = rep(K((0, 1.1), (30, 0.95, LIN), (60, 1.1)), 60, D)
    for i, d in ((3, 0), (2, 9), (1, 18)):
        m[f'wave{i}.op'], m[f'wave{i}.s'] = shift(base_op, d, D), shift(base_s, d, D)
    return m

def writing():
    D = 216
    m = {'_dur': D}
    m.update({'pad.s': 1, 'pencil.s': 1, 'eyes.y': EYESY + 6, 'eyes.sx': 0.96, 'eyes.sy': 0.96, 'pose.rot': 0.02,
              'earL.rot': 0.08, 'earR.rot': -0.06})
    rl, kl = reach(pad_point(-20, -12), -1)                # the left paw holds the pad's top left corner
    m['armL.rot'], m['armL.sy'] = rl, kl
    # the point writes each line from left to right with a small scribble, hops to the next line, then rests
    plan = [(10, 58, 0), (70, 118, 1), (130, 162, 2)]
    pts = []                                               # (frame, target)
    lx0, ly0, _ = PAD_LINES[0]
    rest = pad_point(lx0 - 1, ly0 - 7)
    pts.append((0, rest))
    for (f0, f1, i) in plan:
        x, y, w = PAD_LINES[i]
        steps = (f1 - f0) // 4
        for k in range(steps + 1):
            jig = 0 if k in (0, steps) else (1.4 if k % 2 else -1.4)
            pts.append((f0 + 4 * k, pad_point(x + w * k / steps, y + jig)))
        if i < 2:
            nx, ny, _ = PAD_LINES[i + 1]
            pts.append((f1 + 6, pad_point((x + w + nx) / 2, (y + ny) / 2 - 6)))   # lifted between lines
    x, y, w = PAD_LINES[2]
    pts.append((172, pad_point(x + w + 4, y - 8)))
    pts.append((200, rest))
    pts.append((D, rest))
    sol = [(f, pencil_grip(t)) for f, t in pts]
    m['pencil.rot'] = [(f, g[0], SINE) for f, g in sol]
    m['pencil.x'] = [(f, g[1][0], SINE) for f, g in sol]
    m['pencil.y'] = [(f, g[1][1], SINE) for f, g in sol]
    m['armR.rot'] = [(f, g[2], SINE) for f, g in sol]
    m['armR.sy'] = [(f, g[3], SINE) for f, g in sol]
    # the lines appear as they are written; after the third the page clears, out of sight, and the loop starts again
    for i, (f0, f1, _) in enumerate(plan):
        m[f'line{i + 1}.sx'] = K((0, 0), (f0, 0, LIN), (f1, 1), (194, 1), (195, 0), (D, 0))
    m['lines.op'] = K((0, 1), (180, 1), (192, 0), (200, 0), (206, 1), (D, 1))
    # eyes follow the point a little; the head bobs as each line starts
    m['eyes.x'] = K((0, -1), (10, -1), (58, 4), (70, -1), (118, 4), (130, -1), (162, 2), (200, -1), (D, -1))
    m['head.rot'] = K((0, 0.07), (10, 0.07, EO), (16, 0.09), (64, 0.06), (70, 0.06, EO), (76, 0.09), (124, 0.06), (130, 0.06, EO),
                      (136, 0.09), (172, 0.07), (D, 0.07))
    m['head.y'] = K((0, HEADY + 3), (10, HEADY + 3, EO), (16, HEADY + 4.5), (64, HEADY + 3), (70, HEADY + 3, EO), (76, HEADY + 4.5),
                    (124, HEADY + 3), (130, HEADY + 3, EO), (136, HEADY + 4.5), (172, HEADY + 3), (D, HEADY + 3))
    m['tail.rot'] = osc(0.58, 0.66, 216, D, 0.3)
    return m

def searching():
    D = 240
    m = {'_dur': D}
    m['armL.rot'] = osc(2.98, 2.5, 240, D)                # the magnifier sweeps from above the head to beside it, and back
    m['eyes.x'] = osc(-2.5, -6, 240, D, 0.04)             # the eyes and head follow the lens
    m['eyes.y'] = osc(EYESY - 6.5, EYESY - 2, 240, D, 0.04)
    m['head.rot'] = osc(-0.02, -0.1, 240, D, 0.06)
    m['pose.rot'] = osc(-0.015, -0.035, 240, D, 0.08)
    m['earL.rot'] = osc(0.06, -0.06, 120, D, 0.2)
    m['earR.rot'] = osc(-0.04, 0.06, 120, D, 0.3)
    m['tail.rot'] = osc(0.5, 0.6, 240, D, 0.2)
    m.update({'pose.x': 12, 'mag.s': 1, 'drop.s': 0, 'drop.op': 0, 'glint.op': 1, 'armR.rot': 0.34, 'smile.op': 0, 'open.op': 1,
              'open.sx': 0.55, 'open.sy': 0.55, 'eyes.sx': 1.06, 'eyes.sy': 1.06})
    # a scanning ring leaves the lens every 1.3 s
    m['ping.op'] = shift(rep(K((0, 0), (4, 0.9), (40, 0), (80, 0)), 80, D), 40, D)     # timed so the widest ring never meets the
    m['ping.s'] = shift(rep(K((0, 0.72), (40, 1.3, EO), (41, 0.72), (80, 0.72)), 80, D), 40, D)   # lens at its leftmost
    return m


def searching_in():
    """the arm comes up first and the lens appears only once it is high, so the lens never passes the artboard's left edge
    on the way in (a blend would sweep it through horizontal at half size). Plays once, then hands over to the loop."""
    loop = searching()
    m = {ch: at(v, 0) for ch, v in loop.items() if not ch.startswith('_')}   # everything held at the loop's first frame...
    m['_dur'], m['_loop'] = 26, False
    a0 = at(loop['armL.rot'], 0)
    m['armL.rot'] = K((0, 1.15), (22, a0, EO), (26, a0))                   # ...but the arm rises
    m['mag.s'] = K((0, 0), (11, 0, EO), (19, 1.12), (26, 1))                # and the lens pops in near the top
    m['glint.op'] = K((0, 0), (14, 0), (22, 1), (26, 1))
    return m

def calculating():
    D = 144
    m = {'_dur': D}
    rl, kl = reach((CALC_AT[0] - 20, CALC_AT[1] - 9), -1)   # the left paw holds the calculator's top left corner
    m.update({'calc.s': 1, 'sums.s': 1, 'armL.rot': rl, 'armL.sy': kl, 'eyes.y': EYESY + 5, 'eyes.x': 3, 'eyes.sx': 0.96,
              'eyes.sy': 0.96, 'head.rot': 0.05, 'head.y': HEADY + 2, 'pose.rot': 0.015})
    taps = [2, 1, 5, 1, 2, 5]                              # key indices (row major): the three keys the right paw can reach
    arm_k, sy_k, glow = [], [], []
    for i, key in enumerate(taps):
        kx, ky = CALC_KEYS[key]
        T = (CALC_AT[0] + kx, CALC_AT[1] + ky)
        hover = reach((T[0] + 1, T[1] - 7))
        press = reach(T)
        f = 24 * i
        arm_k += [(f, hover[0], SNAP), (f + 9, hover[0], EI), (f + 13, press[0], EO), (f + 16, press[0], IO)]
        sy_k += [(f, hover[1], SNAP), (f + 9, hover[1], EI), (f + 13, press[1], EO), (f + 16, press[1], IO)]
        glow.append((f + 13, kx, ky))
    first = (arm_k[0][1], sy_k[0][1])
    arm_k.append((D, first[0], IO)); sy_k.append((D, first[1], IO))
    m['armR.rot'], m['armR.sy'] = arm_k, sy_k
    gx, gy, gop = [], [], []
    for (f, kx, ky) in glow:
        gx += [(f - 1, kx, LIN), (f, kx, LIN)]
        gy += [(f - 1, ky, LIN), (f, ky, LIN)]
        gop += [(f - 1, 0, LIN), (f, 1, IO), (f + 10, 0, IO)]
    m['glow.x'] = [(0, glow[-1][1], LIN)] + gx + [(D, glow[-1][1], LIN)]
    m['glow.y'] = [(0, glow[-1][2], LIN)] + gy + [(D, glow[-1][2], LIN)]
    m['glow.op'] = [(0, 0, IO)] + gop + [(D, 0, IO)]
    # the screen's digits change with each press
    for d, pattern in (('dig1', (1, 0.5, 1, 0.75, 0.5, 1)), ('dig2', (0.6, 1, 0.45, 1, 0.8, 0.6)), ('dig3', (1, 1, 0.6, 0.6, 1, 1))):
        ks = [(0, pattern[-1], SNAP)]
        for i, v in enumerate(pattern):
            ks.append((24 * i + 13, v, SNAP))
        ks[-1] = (ks[-1][0], pattern[-1], SNAP)
        ks.append((D, pattern[-1], SNAP))
        m[d + '.sy'] = ks
    # + - = pop out beside the head and float up, one after another
    for g, off, dx in (('plus', 13, 0), ('minus', 61, -6), ('equals', 109, 5)):
        base = {'s': K((0, 0), (8, 1.15, EO), (14, 1), (58, 1), (70, 0.6), (71, 0), (D, 0)),
                'op': K((0, 0), (6, 1), (44, 1), (68, 0), (D, 0)),
                'y': K((0, 0), (70, -58, (0.2, 0.4, 0.6, 1)), (71, 0), (D, 0)),
                'x': K((0, dx), (70, dx + 7), (71, dx), (D, dx))}
        for p_, keys in base.items():
            m[f'{g}.{p_}'] = shift(keys, off, D)
    m['earR.rot'] = osc(-0.05, 0.04, 48, D, 0.3)
    m['tail.rot'] = osc(0.58, 0.66, 144, D, 0.2)
    return m

def comparing():
    D = 240
    m = {'_dur': D}
    m['armL.rot'] = osc(CARD_ARM - 0.1, CARD_ARM + 0.1, 120, D)        # weighed like a balance: one card up, the other down
    m['armR.rot'] = osc(-CARD_ARM - 0.1, -CARD_ARM + 0.1, 120, D)
    m['eyes.x'] = osc(5, -5, 120, D, 0.02)                             # looking at the card that is up
    m['head.rot'] = osc(0.05, -0.05, 120, D, 0.06)
    m['pose.rot'] = osc(0.015, -0.015, 120, D, 0.1)
    earL = osc(0.06, -0.06, 120, D, 0.15)
    m['earL.rot'], m['earR.rot'] = earL, earL
    m['tail.rot'] = osc(0.56, 0.66, 240, D, 0.3)
    m.update({'cardL.s': 1, 'cardR.s': 1, 'pose.x': 4, 'eyes.y': EYESY - 3, 'eyes.sx': 1.04, 'eyes.sy': 1.04})
    m['check.s'] = K((0, 0), (106, 0, EO), (116, 1.2), (124, 1), (166, 1), (178, 0), (D, 0))   # the better offer gets the check
    return m

def presenting():
    D = 240
    m = {'_dur': D}
    m['armR.rot'] = osc(-1.6, -1.74, 120, D)               # pointing at the chart
    m['armL.rot'] = osc(0.16, 0.36, 120, D, 0.5)           # the other paw open toward you
    m['head.rot'] = K((0, -0.03), (110, -0.03), (124, 0.07), (160, 0.07), (174, -0.03), (D, -0.03))
    m['eyes.x'] = K((0, 0), (110, 0, EO), (122, 6), (160, 6), (172, 0), (D, 0))        # a glance at the chart, then back to you
    # talking
    talk = rep(K((0, 0), (5, 1), (11, 1), (16, 0), (30, 0)), 30, D)
    m['open.op'] = talk
    m['smile.op'] = [(f, 1 - v, e) for (f, v, e) in talk]
    m['open.sx'] = rep(K((0, 0.75), (8, 0.95), (16, 0.75), (30, 0.75)), 30, D)
    m['open.sy'] = rep(K((0, 0.7), (8, 1.0), (16, 0.7), (30, 0.7)), 30, D)
    m['pose.y'] = osc(0, -2, 120, D, 0.2)
    m['earL.rot'] = osc(-0.04, 0.05, 120, D, 0.2)
    m['earR.rot'] = osc(0.04, -0.05, 120, D, 0.25)
    m.update({'board.s': 1, 'pose.x': -26})
    m['tail.rot'] = osc(-0.06, 0.04, 240, D, 0.3)
    m['pose.rot'] = osc(0.02, 0.035, 120, D, 0.1)
    for i in range(3):
        f0 = 8 + 14 * i
        m[f'bar{i + 1}.sy'] = K((0, 0), (f0, 0, EO), (f0 + 20, 1), (206, 1, EI), (218, 0), (D, 0))
    return m

STATES = [('idle', idle()), ('cheering', cheering()), ('proud', proud()), ('gliding', gliding()), ('curious', curious()),
          ('found', found()), ('focused', focused()), ('cosy', cosy()), ('sleepy', sleepy()), ('thinking', thinking()),
          ('listening', listening()), ('writing', writing()), ('searching', searching()), ('calculating', calculating()),
          ('comparing', comparing()), ('presenting', presenting())]
INTRO = {'cheering': cheering_in(), 'found': found_in(), 'searching': searching_in()}

# ---------------------------------------------------------------- membrane points follow the paws
def foot(side, m, f=0):
    lx, ly = at(m.get(f'leg{"L" if side < 0 else "R"}.x'), f), at(m.get(f'leg{"L" if side < 0 else "R"}.y'), f)
    rot = at(m.get(f'leg{"L" if side < 0 else "R"}.rot'), f)
    sy = at(m.get(f'leg{"L" if side < 0 else "R"}.sy'), f)
    return (lx - math.sin(rot) * LEGLEN * sy, ly + math.cos(rot) * LEGLEN * sy)

def add_membrane(m):
    for side, k in ((-1, 'L'), (1, 'R')):
        armk = m[f'arm{k}.rot']
        # while the membrane is hidden its points only need to be in the right place for a blend: one key is enough
        still = isinstance(armk, (int, float)) or m.get('mem.op', 0) == 0
        frames = [0] if still else [kf for (kf, _, _) in armk]
        eases = [IO] if still else [e for (_, _, e) in armk]
        F = (side * m['_memF'][0], m['_memF'][1]) if '_memF' in m else foot(side, m)
        H, M = [], []
        for f, e in zip(frames, eases):
            fa = m['_dur'] if (still and m.get('_loop', True) is False) else f   # a hidden membrane in an arrival waits where its loop starts
            h = hand(side, at(armk, fa), 0.96 * at(m.get(f'arm{k}.sy', 1), fa))
            mid = ((h[0] + F[0]) / 2, (h[1] + F[1]) / 2)
            cx, cy = 0 - mid[0], -60 - mid[1]
            d = math.hypot(cx, cy) or 1
            mm = (mid[0] + cx / d * 9, mid[1] + cy / d * 9)
            H.append((f, h, e)); M.append((f, mm, e))
        for v, lst in (('H', H), ('M', M)):
            if len(lst) == 1:
                m[f'mem{k}{v}.x'], m[f'mem{k}{v}.y'] = lst[0][1][0], lst[0][1][1]
            else:
                m[f'mem{k}{v}.x'] = [(f, p[0], e) for (f, p, e) in lst]
                m[f'mem{k}{v}.y'] = [(f, p[1], e) for (f, p, e) in lst]
        m[f'mem{k}F.x'], m[f'mem{k}F.y'] = F

def check_loop(name, m):
    dur = m.get('_dur', 1)
    for ch, k in m.items():
        if ch.startswith('_') or isinstance(k, (int, float, tuple)): continue
        assert k[0][0] == 0 and k[-1][0] == dur, (name, ch, k[0][0], k[-1][0])
        assert all(a[0] < b[0] for a, b in zip(k, k[1:])), (name, ch, 'frames not increasing')
        if m.get('_loop', dur > 1):
            assert abs(k[0][1] - k[-1][1]) < 1e-6, (name, ch, 'loop seam', k[0][1], k[-1][1])

def complete(m):
    full = dict(DEFAULT)
    full.update(m)
    add_membrane(full)
    return full

# ---------------------------------------------------------------- writing timelines
def key_xml(keys, ind):
    if isinstance(keys, (int, float)):
        return f'<KeyFrameDouble value="{n(keys)}" frame="0" interpolationType="linear"/>', True
    rows = []
    for i, (f, v, e) in enumerate(keys):
        if i == len(keys) - 1:
            rows.append(f'<KeyFrameDouble value="{n(v)}" frame="{f}" interpolationType="linear"/>')
        else:
            rows.append(f'<KeyFrameDouble value="{n(v)}" frame="{f}" interpolationType="cubic"><CubicEaseInterpolator x1="{n(e[0])}" y1="{n(e[1])}" x2="{n(e[2])}" y2="{n(e[3])}"/></KeyFrameDouble>')
    return ('\n' + ind).join(rows), False

NAMES = {}  # id key -> readable name for comments
def timeline(name, tid, m, order):
    dur = m.get('_dur', 1)
    loop = ' loopValue="loop"' if m.get('_loop', dur > 1) else ''
    by_obj = {}
    for ch in order:
        if ch not in m: continue
        for (obj, prop) in CH[ch]:
            by_obj.setdefault(obj, []).append((prop, m[ch]))
    L = [f'        <LinearAnimation duration="{dur}"{loop} name="{name}" id="{tid}">']
    for obj, props in by_obj.items():
        simple = all(isinstance(k, (int, float)) for _, k in props)
        if simple:
            inner = ''.join(f'<KeyedProperty property="{p}">{key_xml(k, "")[0]}</KeyedProperty>' for p, k in props)
            L.append(f'            <KeyedObject objectId="{I(obj)}">{inner}</KeyedObject>  <!-- {NAMES.get(obj, obj)} -->')
        else:
            L.append(f'            <KeyedObject objectId="{I(obj)}">  <!-- {NAMES.get(obj, obj)} -->')
            for p, k in props:
                xml, one = key_xml(k, ' ' * 20)
                if one:
                    L.append(f'                <KeyedProperty property="{p}">{xml}</KeyedProperty>')
                else:
                    L.append(f'                <KeyedProperty property="{p}">')
                    L.append(' ' * 20 + xml)
                    L.append('                </KeyedProperty>')
            L.append('            </KeyedObject>')
    L.append('        </LinearAnimation>')
    return '\n'.join(L)

NAMES.update({'pose': 'Pose', 'bank': 'Bank', 'head': 'Head', 'headBack': 'Head Back', 'eyes': 'Eyes', 'lidL': 'Lid L', 'lidR': 'Lid R',
              'happy': 'Eyes Happy', 'asleep': 'Eyes Asleep', 'smile': 'Mouth Smile', 'grin': 'Mouth Grin', 'open': 'Mouth Open', 'cheeks': 'Cheeks',
              'earL': 'Ear L', 'earR': 'Ear R', 'armL': 'Arm L', 'armR': 'Arm R', 'legL': 'Leg L', 'legR': 'Leg R', 'tail': 'Tail',
              'memL': 'Membrane L', 'memR': 'Membrane R', 'memLH': 'Membrane L, paw point', 'memLM': 'Membrane L, edge point',
              'memLF': 'Membrane L, foot point', 'memRH': 'Membrane R, paw point', 'memRM': 'Membrane R, edge point',
              'memRF': 'Membrane R, foot point', 'jar': 'Jar', 'sparkle': 'Sparkle', 'berry': 'Berry', 'mag': 'Magnifier', 'mug': 'Mug',
              'blanket': 'Blanket', 'dots': 'Think Dots', 'zs': 'Zs', 'dot1': 'Dot 1', 'dot2': 'Dot 2', 'dot3': 'Dot 3',
              'z1': 'Z 1', 'z2': 'Z 2', 'steam1': 'Steam 1', 'steam2': 'Steam 2', 'breath': 'Breath', 'squish': 'Squish',
              'eyeL': 'Eye L', 'eyeR': 'Eye R', 'tapLidL': 'Tap Lid L', 'tapLidR': 'Tap Lid R',
              'waves': 'Waves', 'wave1': 'Wave 1', 'wave2': 'Wave 2', 'wave3': 'Wave 3', 'pad': 'Notepad', 'lines': 'Pad Lines',
              'line1': 'Pad Line 1', 'line2': 'Pad Line 2', 'line3': 'Pad Line 3', 'pencil': 'Pencil', 'calc': 'Calculator',
              'glow': 'Key Glow', 'dig1': 'Digit 1', 'dig2': 'Digit 2', 'dig3': 'Digit 3', 'sums': 'Sums', 'plus': 'Plus',
              'minus': 'Minus', 'equals': 'Equals', 'cardL': 'Card L', 'cardR': 'Card R', 'check': 'Check', 'board': 'Board',
              'bar1': 'Bar 1', 'bar2': 'Bar 2', 'bar3': 'Bar 3', 'ping': 'Ping', 'drop': 'Drop', 'glint': 'Glint'})

ORDER = list(DEFAULT.keys())
MEMCH = [f'mem{k}{v}.{a}' for k in 'LR' for v in 'HMF' for a in 'xy']
FX = ['jar.rot', 'sparkle.s', 'dot1.y', 'dot2.y', 'dot3.y'] + [f'{z}.{p}' for z in ('z1', 'z2', 'steam1', 'steam2') for p in ('x', 'y', 'op', 's', 's2')]
FX += ['pencil.rot', 'pencil.x', 'pencil.y', 'lines.op', 'line1.sx', 'line2.sx', 'line3.sx', 'glow.x', 'glow.y', 'glow.op', 'dig1.sy', 'dig2.sy', 'dig3.sy',
       'check.s', 'bar1.sy', 'bar2.sy', 'bar3.sy'] + [f'{w}.{p}' for w in ('wave1', 'wave2', 'wave3') for p in ('op', 's')] \
      + [f'{g}.{p}' for g in ('plus', 'minus', 'equals') for p in ('x', 'y', 'op', 's')]
ORDER = ORDER + MEMCH + FX

# state and timeline ids
for mname, _ in STATES:
    I('state:' + mname); I('anim:' + mname)
for mname in INTRO:
    I('state:' + mname + ':in'); I('anim:' + mname + ':in')

TL = []
for mname, m in STATES:
    check_loop(mname, m)
    TL.append(timeline(f'mood: {mname}', I('anim:' + mname), complete(m), ORDER))
    if mname in INTRO:
        a_, b_ = complete(INTRO[mname]), complete(m)   # the arrival must end exactly where the loop starts
        for ch in a_:
            if ch.startswith('_'): continue
            va, vb = at(a_[ch], INTRO[mname]['_dur']), at(b_.get(ch, a_[ch]), 0)
            assert abs(va - vb) < 1e-6, (mname, ch, 'arrival does not end on the loop start', va, vb)
        TL.append(timeline(f'mood: {mname}, arriving', I('anim:' + mname + ':in'), a_, ORDER))

breath = {'_dur': 216, 'breath.sy': osc(1.0, 1.022, 216, 216), 'breath.sx': osc(1.0, 0.99, 216, 216)}
blink = {'_dur': 420, 'blink': K((0, 1), (128, 1, EI), (132, 0.08, EO), (140, 1), (296, 1, EI), (300, 0.08, EO), (307, 1), (311, 1, EI), (315, 0.08, EO), (323, 1), (420, 1))}
tap_rest = {'_dur': 1, 'squish.sx': 1, 'squish.sy': 1, 'squish.y': 0, 'taplids': 0}
tap = {'_dur': 34, '_loop': False,
       'squish.sy': K((0, 1), (5, 0.84, EO), (12, 1.08), (19, 0.97), (26, 1.01), (34, 1), e=IO),
       'squish.sx': K((0, 1), (5, 1.12, EO), (12, 0.94), (19, 1.02), (26, 0.995), (34, 1), e=IO),
       'squish.y': K((0, 0), (5, 0, EO), (12, -6, EI), (19, 0), (34, 0)),
       'taplids': K((0, 0), (5, 0.36), (18, 0.36), (30, 0), (34, 0), e=EO)}
ALWAYS = ['breath.sx', 'breath.sy', 'blink', 'squish.sx', 'squish.sy', 'squish.y', 'taplids']
TL.append(timeline('breath', I('anim:breath'), breath, ALWAYS))
TL.append(timeline('blink', I('anim:blink'), blink, ALWAYS))
TL.append(timeline('tap: rest', I('anim:tapRest'), tap_rest, ALWAYS))
TL.append(timeline('tap: squish', I('anim:tap'), tap, ALWAYS))

# ---------------------------------------------------------------- state machine
def cond_mood(m):
    return (f'<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyEnum><DataBindContext sourcePathIds="12:1-12:2" propertyKey="637"/>'
            f'</BindablePropertyEnum></TransitionPropertyViewModelComparator><TransitionValueEnumComparator value="{ENUM[m]}"/></TransitionViewModelCondition>')

def cond_tap():
    return (f'<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext sourcePathIds="12:1-{I("tapProp")}" propertyKey="686"/>'
            f'</BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>')

def target(m):
    return I('state:' + m + ':in') if m in INTRO else I('state:' + m)

# The blend into a mood has that mood's character: quick and springy into the lively ones (the curve overshoots a little),
# slow and soft into the restful ones. (milliseconds, x1, y1, x2, y2)
BLENDS = {'idle': (300, 0.3, 1.15, 0.4, 1), 'cheering': (260, 0.3, 1.5, 0.5, 1), 'proud': (300, 0.3, 1.3, 0.5, 1),
          'gliding': (320, 0.3, 1.3, 0.5, 1), 'curious': (300, 0.3, 1.2, 0.45, 1), 'found': (260, 0.3, 1.4, 0.5, 1),
          'focused': (300, 0.3, 1.15, 0.4, 1), 'cosy': (350, 0.3, 0, 0.2, 1), 'sleepy': (350, 0.4, 0, 0.3, 1),
          'thinking': (300, 0.3, 1.15, 0.4, 1),
          'listening': (300, 0.3, 1.2, 0.45, 1), 'writing': (300, 0.3, 1.15, 0.4, 1), 'searching': (320, 0.3, 1.2, 0.45, 1),
          'calculating': (300, 0.3, 1.15, 0.4, 1), 'comparing': (320, 0.3, 1.2, 0.45, 1), 'presenting': (320, 0.3, 1.25, 0.5, 1)}
def to_mood(m, blend=True):
    if not blend:
        return f'<StateTransition stateToId="{target(m)}">{cond_mood(m)}</StateTransition>  <!-- mood is {m} -->'
    d, x1, y1, x2, y2 = BLENDS[m]
    return (f'<StateTransition stateToId="{target(m)}" duration="{d}" interpolationType="cubic"><CubicEaseInterpolator x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"/>'
            f'{cond_mood(m)}</StateTransition>  <!-- mood is {m} -->')

SM = []
a = SM.append
a(f'        <StateMachine name="Main" id="{I("sm")}">')
a(f'            <StateMachineListenerSingle targetId="{I("hit")}" listenerTypeValue="{"down" if not TEST else "exit"}" name="Tap on Liito" id="{I("lsTap")}">')
a(f'                <ListenerViewModelChange><BindablePropertyTrigger propertyValue="1"><DataBindContext sourcePathIds="12:1-{I("tapProp")}" propertyKey="686" direction="true"/></BindablePropertyTrigger></ListenerViewModelChange>  <!-- fires _tap -->')
a('            </StateMachineListenerSingle>')
if TEST:
    a(f'            <StateMachineListenerSingle targetId="{I("hit")}" listenerTypeValue="click" name="TEST set mood" id="{I("lsTest")}">')
    a(f'                <ListenerViewModelChange><BindablePropertyEnum propertyValue="{ENUM[TEST]}"><DataBindContext sourcePathIds="12:1-12:2" propertyKey="637" direction="true"/></BindablePropertyEnum></ListenerViewModelChange>')
    a('            </StateMachineListenerSingle>')
if TESTS:
    for i, tm in enumerate(TESTS):
        a(f'            <StateMachineListenerSingle targetId="{I("testHit" + str(i))}" listenerTypeValue="click" name="TEST set mood {tm}" id="{I("lsTest" + str(i))}">')
        a(f'                <ListenerViewModelChange><BindablePropertyEnum propertyValue="{ENUM[tm]}"><DataBindContext sourcePathIds="12:1-12:2" propertyKey="637" direction="true"/></BindablePropertyEnum></ListenerViewModelChange>')
        a('            </StateMachineListenerSingle>')
a(f'            <StateMachineLayer name="Mood" id="{I("layerMood")}">')
a(f'                <AnyState x="0" y="-140" id="{I("moodAny")}"/>')
a(f'                <ExitState x="0" y="-280" id="{I("moodExit")}"/>')
a(f'                <EntryState x="0" y="0" id="{I("moodEntry")}">  <!-- starts in the state of the current mood, with no blend: the first frame is already right -->')
for m in MOODS[1:]:
    a('                    ' + to_mood(m, False))
a(f'                    <StateTransition stateToId="{I("state:idle")}"/>  <!-- otherwise idle -->')
a('                </EntryState>')
row = 0
for mname, _ in STATES:
    variants = [(mname, I('state:' + mname), I('anim:' + mname), 480)]
    if mname in INTRO:
        variants.insert(0, (mname + ', arriving', I('state:' + mname + ':in'), I('anim:' + mname + ':in'), 240))
    for label, sid, aid, x in variants:
        a(f'                <AnimationState animationId="{aid}" x="{x}" y="{row * 110}" id="{sid}">  <!-- {label} -->')
        for other in MOODS:
            if other != mname:
                a('                    ' + to_mood(other))
        if sid == ids.get('state:' + mname + ':in'):
            a(f'                    <StateTransition stateToId="{I("state:" + mname)}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>  <!-- then the loop -->')
        a('                </AnimationState>')
    row += 1
a('            </StateMachineLayer>')
for lname, key in (('Breath', 'breath'), ('Blink', 'blink')):
    a(f'            <StateMachineLayer name="{lname}" id="{I("layer" + lname)}">')
    a(f'                <AnyState x="0" y="-140" id="{I(key + "Any")}"/>')
    a(f'                <ExitState x="0" y="-280" id="{I(key + "Exit")}"/>')
    a(f'                <EntryState x="0" y="0" id="{I(key + "Entry")}">')
    a(f'                    <StateTransition stateToId="{I("state:" + key)}"/>')
    a('                </EntryState>')
    a(f'                <AnimationState animationId="{I("anim:" + key)}" x="240" y="0" id="{I("state:" + key)}"/>')
    a('            </StateMachineLayer>')
# Tap: rest, and twin states A and B that play the same squish, so a tap during a squish restarts it.
a(f'            <StateMachineLayer name="Tap" id="{I("layerTap")}">')
a(f'                <AnyState x="0" y="-140" id="{I("tapAny")}"/>')
a(f'                <ExitState x="0" y="-280" id="{I("tapExit")}"/>')
a(f'                <EntryState x="0" y="0" id="{I("tapEntry")}">')
a(f'                    <StateTransition stateToId="{I("state:tapRest")}"/>')
a('                </EntryState>')
a(f'                <AnimationState animationId="{I("anim:tapRest")}" x="240" y="0" id="{I("state:tapRest")}">  <!-- rest -->')
a(f'                    <StateTransition stateToId="{I("state:tapA")}">{cond_tap()}</StateTransition>  <!-- _tap fired -->')
a('                </AnimationState>')
for me, other, y in (('tapA', 'tapB', -60), ('tapB', 'tapA', 60)):
    a(f'                <AnimationState animationId="{I("anim:tap")}" x="480" y="{y}" id="{I("state:" + me)}">  <!-- squish -->')
    a(f'                    <StateTransition stateToId="{I("state:" + other)}">{cond_tap()}</StateTransition>  <!-- _tap fired again: restart -->')
    a(f'                    <StateTransition stateToId="{I("state:tapRest")}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>  <!-- done -->')
    a('                </AnimationState>')
a('            </StateMachineLayer>')
a('        </StateMachine>')

HEADER = '''<!-- Liito  (240x240, contain)
     The mascot. Mood follows the user's effort, never their balance. Liito is never sad, angry, disappointed or begging.
     In a live conversation the app sets the task moods from what the agent is really doing (never from a timer).

     View model LiitoVM  (names and types are fixed by rive/contract.json):
       mood        enum LiitoMood     in     default "idle"
       _tap        trigger            private: a pointer went down on Liito. The app does not read or write it.

     How it works  (the long version is the "Liito" section of rive/README.md)
       Rig        Root > Squish > Breath > Pose > Bank > Body. Parts with their own pivot: Head (face) and Head Back (skull and
                  ears, same keys), each eye with its lower lids, each ear, each arm (the magnifier rides the left one), each leg, the tail,
                  the two membranes (three keyed points each), and the props: jar, berry, mug, blanket, dots, z, steam.
       Mood       one looping timeline per LiitoMood value. Every mood keys the same set of rest-pose properties, so any mood
                  blends cleanly into any other. Each state has a transition to every other mood (260 to 350 ms, with the curve of
                  the mood being entered); the EntryState has a conditioned, unblended transition per mood, so the first frame
                  already shows the mood the app set.
                  "cheering" and "found" enter through a one-shot (a first big jump, an "aha" bounce), then hold their loop.
       Breath     always-on loop on the Breath node (scales from the feet).
       Blink      always-on loop on the two eye nodes. Invisible while a mood hides the open eyes.
       Tap        pointer down on the Hit shape (the character only) fires _tap; rest, A and B play a short squish with smiling eyes.
       Tasks      the last six moods show Liito doing what the agent is doing in a live conversation (LiitoMood values 0:251 to 0:256):
                    listening    head tilted toward the sound, right ear perked and twitching, three green arcs arriving at the ear
                    writing      a notepad in front of the belly, a pencil in the right paw; three lines appear as they are written
                    searching    the magnifier (an empty lens with a glint) sweeps beside and above the head; the eyes follow it; a
                                 scanning ring leaves the lens
                    calculating  a calculator held in front of the chest; the right paw taps keys that light up; + - = float up
                    comparing    an offer card in each raised paw, weighed like a balance; the eyes go from one to the other; the
                                 better one gets a green check
                    presenting   a chart on an easel beside Liito (root space, on the ground line); Liito points at it and talks
                                 while its three bars grow
                  Their props are hidden by scale and opacity in every other mood. The pencil lives in body space and follows the
                  paw (keys), so the arm can stretch without skewing it.
       Source     written by rive/tools/liito-gen.py (python3 rive/tools/liito-gen.py rive/sisu-ui/12_liito.rml). Change the
                  generator, not this file.

     Ids: 12:1 to 12:6 are the view model, its Default instance and the artboard. Everything else counts up from 12:7. -->'''

doc = f'''{HEADER}
<Rive version="1" kind="fragment">
    <!-- View model -->
    <ViewModel defaultInstanceId="12:3" name="LiitoVM" id="12:1">
        <ViewModelPropertyEnumCustom enumId="0:240" name="mood" id="12:2"/>
        <ViewModelPropertyTrigger name="_tap" id="{I('tapProp')}"/>
        <ViewModelInstance exports="true" name="Default" id="12:3">
            <ViewModelInstanceEnum propertyValue="0:241" viewModelPropertyId="12:2" id="12:4"/>  <!-- mood = idle -->
            <ViewModelInstanceTrigger viewModelPropertyId="{I('tapProp')}" id="{I('tapInst')}"/>  <!-- _tap -->
        </ViewModelInstance>
    </ViewModel>

    <Artboard defaultStateMachineId="{I('sm')}" viewModelId="12:1" viewModelInstanceId="12:3" clip="true" width="240" height="240"
            x="1040" y="380" styleId="12:6" name="Liito" id="12:5">
        <LayoutComponentStyle name="Artboard Style" id="12:6"/>

{SCENE}
        <!-- State machine. Declared before the timelines so the editor opens it first. -->
{chr(10).join(SM)}

        <!-- Timelines. A mood timeline keys every rest-pose property at frame 0 and adds keys where the mood moves. -->
{chr(10).join(TL)}
    </Artboard>
</Rive>
'''
# ids used in the scene were allocated while building strings; the state machine id must exist before the artboard line is formatted (it does: I() is idempotent)
open(out_path, 'w').write(doc)
print('wrote', out_path, len(doc), 'bytes; last id', f'12:{_c[0]}')
