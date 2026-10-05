"""Re-author the saved builder's four actions with weight, overlap and arcs.

A staged, one-time motion pass over the saved craftsperson, in the same spirit
as the Founder's reviewed repair scripts. It reads the saved scene, replaces
only the four Builder_* actions and writes a staged .blend (plus a numeric
report) for review. The rebuild keeps reading the promoted .blend, so hand
edits made after promotion stay authoritative; do not rerun this over them.

Every pose is solved analytically from animator key poses: the pelvis carries
the weight, the spine and chest counter-rotate it, the head stabilises the
gaze, and two-bone IK places each ankle and wrist with a knee/elbow pole.
Bone twist is derived from the same pole so knees and elbows stay hinges.

Contracts preserved from the previous pass and gated by verify-builder-source:
- walk/carry: left heel contact at phase 0 and 60% flat-foot stance per side;
  carry reuses the walk's exact ankle paths;
- idle/work: the feet never move and planted soles stay level;
- wrists stay inside the reviewed grip bend (< 50 degrees);
- the mallet exists only in work, the crate only in carry.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='tmp/citizen-sprites/motion-v2/builder.blend')
parser.add_argument('--table', action='store_true', help='print per-frame leg/arm reach while tuning keys')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
destination = ROOT / args.output
assert 'tmp' in destination.relative_to(ROOT).parts, 'Author into staging; review before promotion'
destination.parent.mkdir(parents=True, exist_ok=True)

scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert rig.get('realm_anatomy') == 'adult-craftsperson-v1', 'Start from the saved adult craftsperson'
for track in rig.animation_data.nla_tracks:
    track.mute = True

# ── Character frame ────────────────────────────────────────────────────────
# Blender: +X is the character's left, -Y is forward, +Z is up.
LEFT, FWD, UP = Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))
SIDES = (('l', 1), ('r', -1))


def P(x, f, z):
    """Lateral (+left), forward, up -> Blender armature space."""
    return Vector((x, -f, z))


def yaw(deg):
    """Positive turns toward the character's left (the right side comes forward)."""
    return Quaternion(UP, math.radians(deg))


def pitch(deg):
    """Positive leans the top forward."""
    return Quaternion(LEFT, math.radians(deg))


def roll(deg):
    """Positive tilts the top toward the character's left."""
    return Quaternion((0, 1, 0), math.radians(deg))


def smooth(a, b, t):
    u = max(0.0, min(1.0, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


def wrap(p):
    return p - math.floor(p)


class Loop:
    """Periodic Hermite spline through animator keys on a unit phase loop.

    keys: (phase, value[, tangent_scale]). Tangents come from the neighbours;
    tangent_scale 0 makes an eased hold, >1 a snappier pass-through.
    """

    def __init__(self, keys):
        self.keys = sorted(keys, key=lambda k: k[0])
        assert all(0 <= k[0] < 1 for k in self.keys)

    def _value(self, i):
        n = len(self.keys)
        k = self.keys[i % n]
        t = k[0] + math.floor(i / n)
        return t, k[1], (k[2] if len(k) > 2 else 1.0)

    def _tangent(self, i):
        t0, v0, _ = self._value(i - 1)
        t1, v1, scale = self._value(i)
        t2, v2, _ = self._value(i + 1)
        return (v2 - v0) * (scale / (t2 - t0))

    def __call__(self, p):
        p = wrap(p)
        n = len(self.keys)
        i = max(j for j in range(n) if self.keys[j][0] <= p) if p >= self.keys[0][0] else -1
        t0, v0, _ = self._value(i)
        t1, v1, _ = self._value(i + 1)
        span = t1 - t0
        u = (p - t0) / span
        m0, m1 = self._tangent(i) * span, self._tangent(i + 1) * span
        u2, u3 = u * u, u * u * u
        return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1


# ── Rest skeleton ──────────────────────────────────────────────────────────
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.matrix_basis = Matrix.Identity(4)
rig.data.pose_position = 'POSE'
bpy.context.view_layer.update()
REST = {b.name: b.matrix_local.copy() for b in rig.data.bones}
ORDERED = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
PB = rig.pose.bones


def head(name):
    return REST[name].translation.copy()


def rest_q(name):
    return REST[name].to_quaternion()


THIGH = (head('lowerleg.l') - head('upperleg.l')).length
SHIN = (head('foot.l') - head('lowerleg.l')).length
UPPER_ARM = (head('lowerarm.l') - head('upperarm.l')).length
FOREARM = (head('wrist.l') - head('lowerarm.l')).length
ANKLE_Z = 0.146325  # the previous pass's planted ankle height: same ground line


def update():
    bpy.context.view_layer.update()


def basis(axis, ref):
    a = axis.normalized()
    r = (ref - a * ref.dot(a))
    assert r.length > 1e-6, 'Degenerate pole'
    r.normalize()
    return Matrix((a, r, a.cross(r))).transposed()


def aligned(name, rest_axis, rest_ref, axis, ref):
    """World rotation mapping (rest_axis, rest_ref) onto (axis, ref), applied to rest."""
    q = (basis(axis, ref) @ basis(rest_axis, rest_ref).transposed()).to_quaternion()
    return q @ rest_q(name)


def place(name, orientation, at=None):
    bone = PB[name]
    m = orientation.to_matrix().to_4x4()
    m.translation = bone.head.copy() if at is None else at
    bone.matrix = m
    update()


def two_bone(root, target, l1, l2, pole):
    d = target - root
    dist = d.length
    assert dist < (l1 + l2) * .9999, f'Unreachable target: {dist:.4f} >= {l1 + l2:.4f}'
    axis = d / dist
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    bend = (pole - axis * pole.dot(axis)).normalized()
    return root + axis * a + bend * h, dist / (l1 + l2)


REST_THIGH = (head('lowerleg.l') - head('upperleg.l')).normalized()
REST_SHIN = (head('foot.l') - head('lowerleg.l')).normalized()
REST_ARM = {s: (head(f'lowerarm.{s}') - head(f'upperarm.{s}')).normalized() for s, _ in SIDES}
REST_FORE = {s: (head(f'wrist.{s}') - head(f'lowerarm.{s}')).normalized() for s, _ in SIDES}
REST_HAND = {s: (head(f'hand.{s}') - head(f'wrist.{s}')).normalized() for s, _ in SIDES}
ELBOW_BACK = Vector((0, 1, 0))  # the rest T-pose elbow points backward, palms down
HAND_BACK = Vector((0, 0, 1))   # back of the hand in the rest pose (the mallet handle axis)


def angle(a, b):
    return math.degrees(a.angle(b))


class Pose:
    """One authored frame: weight, spine chain, IK targets and props."""

    def __init__(self):
        self.pelvis_at = Vector()
        self.pelvis = Quaternion()
        self.spine = Quaternion()
        self.chest = Quaternion()
        self.head = Quaternion()
        self.feet = {}
        self.hands = {}
        self.cargo = None
        self.tool = False


def apply(pose, report):
    for bone in ORDERED:
        bone.matrix_basis = Matrix.Identity(4)
    update()
    place('hips', pose.pelvis @ rest_q('hips'), head('hips') + pose.pelvis_at)
    place('spine', pose.spine @ rest_q('spine'))
    place('chest', pose.chest @ rest_q('chest'))
    place('head', pose.head @ rest_q('head'))
    for side, sign in SIDES:
        ankle, foot_q, pole = pose.feet[side]
        hip = PB[f'upperleg.{side}'].head.copy()
        knee, extension = two_bone(hip, ankle, THIGH, SHIN, pole)
        report[f'leg.{side}'] = extension
        place(f'upperleg.{side}', aligned(f'upperleg.{side}', REST_THIGH, FWD, knee - hip, pole))
        place(f'lowerleg.{side}', aligned(f'lowerleg.{side}', REST_SHIN, FWD, ankle - knee, pole))
        place(f'foot.{side}', foot_q @ rest_q(f'foot.{side}'))
        place(f'toes.{side}', foot_q @ rest_q(f'toes.{side}'))
        report['ankleError'] = max(report.get('ankleError', 0), (PB[f'foot.{side}'].head - ankle).length)
    for side, sign in SIDES:
        wrist, pole, hand_dir, back = pose.hands[side]
        shoulder = PB[f'upperarm.{side}'].head.copy()
        elbow, extension = two_bone(shoulder, wrist, UPPER_ARM, FOREARM, pole)
        report[f'arm.{side}'] = extension
        place(f'upperarm.{side}', aligned(f'upperarm.{side}', REST_ARM[side], ELBOW_BACK, elbow - shoulder, pole))
        place(f'lowerarm.{side}', aligned(f'lowerarm.{side}', REST_FORE[side], ELBOW_BACK, wrist - elbow, pole))
        fore = (wrist - elbow).normalized()
        # The short wrist bone takes half the bend; the hand completes it.
        mid = (fore + hand_dir.normalized()).normalized()
        place(f'wrist.{side}', aligned(f'wrist.{side}', REST_HAND[side], HAND_BACK, mid, back))
        place(f'hand.{side}', aligned(f'hand.{side}', REST_HAND[side], HAND_BACK, hand_dir, back))
        report['wristError'] = max(report.get('wristError', 0), (PB[f'wrist.{side}'].head - wrist).length)
        bend = angle(PB[f'wrist.{side}'].head - PB[f'lowerarm.{side}'].head,
                     PB[f'hand.{side}'].head - PB[f'wrist.{side}'].head)
        report['wristBend'] = max(report.get('wristBend', 0), bend)
    cargo = PB['builder_cargo']
    if pose.cargo:
        at, q = pose.cargo
        m = (q @ rest_q('builder_cargo')).to_matrix().to_4x4()
        m.translation = head('builder_cargo') + at
        cargo.matrix = m
    cargo.scale = (1, 1, 1) if pose.cargo else (0, 0, 0)
    PB['builder_tool'].scale = (1, 1, 1) if pose.tool else (0, 0, 0)
    update()


# ── Shared vocabulary ──────────────────────────────────────────────────────
def level_foot(ankle, toe_out, pole_out=0.0):
    """A planted sole: the rest orientation turned about the vertical only."""
    q = yaw(toe_out)
    return ankle, q, (q @ FWD + LEFT * pole_out).normalized()


def arm_target(sign, shoulder, abduct, swing, elbow, lag_hand=0.0):
    """FK arm (degrees) solved back into a wrist target and elbow pole.

    abduct lifts the upper arm out to the side, swing carries it forward,
    elbow flexes the forearm forward and lag_hand lets the hand trail.
    """
    down = Vector((0, 0, -1))
    upper = (Quaternion(FWD, math.radians(abduct * sign)) @ Quaternion(LEFT, math.radians(-swing))) @ down
    # the flexion hinge is lateral to the upper arm: forearm rises forward
    hinge = upper.cross(FWD).normalized() if abs(upper.dot(FWD)) < .98 else LEFT
    fore = Quaternion(hinge, math.radians(elbow)) @ upper
    elbow_at = shoulder + upper * UPPER_ARM
    wrist = elbow_at + fore * FOREARM
    pole = (elbow_at - (shoulder + wrist) * .5)
    if pole.length < 1e-4:
        pole = -FWD
    pole = (pole.normalized() + (-FWD) * .35 + LEFT * sign * .12).normalized()
    hand = Quaternion(hinge, math.radians(lag_hand)) @ fore
    back = (LEFT * sign - hand * hand.dot(LEFT * sign)).normalized()
    return wrist, pole, hand, back


def shoulder_world(pose, side):
    """Where the chest would put this shoulder (for FK arm targets)."""
    hips = head('hips') + pose.pelvis_at
    spine = hips + pose.pelvis @ (head('spine') - head('hips'))
    chest = spine + pose.spine @ (head('chest') - head('spine'))
    return chest + pose.chest @ (head(f'upperarm.{side}') - head('chest'))


# ── WALK / CARRY ───────────────────────────────────────────────────────────
STRIDE = 0.95       # metres per cycle (the previous clip used 0.64)
STANCE = 0.6        # fraction of the cycle each sole is planted (gate contract)
FOOT_X = 0.118      # soles a touch inside the hip joints: a single walking line
TOE_OUT = 6.0
SWING_LIFT = 0.11
REACH_BIAS = 0.0    # land as far ahead as the foot leaves behind


def walk_foot(p, side, sign):
    """Ankle path, sole orientation and knee pole for one side (shared with carry)."""
    local = wrap(p - (0.0 if side == 'l' else 0.5))
    contact = STANCE * STRIDE / 2 + REACH_BIAS
    toe_out = TOE_OUT * sign
    if local <= STANCE:
        f = contact - STRIDE * local
        return level_foot(P(sign * FOOT_X, f, ANKLE_Z), toe_out)
    s = (local - STANCE) / (1 - STANCE)
    start, end = contact - STRIDE * STANCE, contact
    m = -STRIDE * (1 - STANCE)
    h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    f = h00 * start + h10 * m + h01 * end + h11 * m
    lift = SWING_LIFT * math.sin(math.pi * s) * (1 - .25 * s)
    # Toe hangs after lift-off, then the sole levels and rises for the next heel.
    toe_down = 22 * math.sin(math.pi * min(1, s / .62)) ** 1.1 * (1 - smooth(.35, .8, s)) - 8 * math.sin(math.pi * smooth(.45, 1, s))
    x = sign * (FOOT_X + .012 * math.sin(math.pi * s))  # swing clears the stance ankle
    q = yaw(toe_out) @ Quaternion(LEFT, math.radians(toe_down))
    ankle = P(x, f, ANKLE_Z + lift)
    return ankle, q, (yaw(toe_out) @ FWD).normalized()


def walk_pose(p, carry=False):
    pose = Pose()
    # Weight: lowest just after each heel contact, highest over the planted foot.
    bob = -math.cos(4 * math.pi * (p - .05))
    height = (-.040 if not carry else -.052) + .019 * bob
    sway = .022 * math.cos(2 * math.pi * (p - .30))
    pose.pelvis_at = Vector((sway, 0, height))
    pelvis_yaw = -(6.5 if not carry else 3.5) * math.cos(2 * math.pi * (p - .02))
    pelvis_roll = -3.2 * math.cos(2 * math.pi * (p - .18))
    lean = 4.0 if not carry else -4.5
    brake = .9 * math.cos(4 * math.pi * (p - .04))  # tiny forward pitch as each heel lands
    pose.pelvis = yaw(pelvis_yaw) @ roll(pelvis_roll) @ pitch(1.5 + brake * .5)
    pose.spine = yaw(pelvis_yaw * .35) @ roll(pelvis_roll * .3) @ pitch(lean * .55 + brake)
    chest_yaw = (5.5 if not carry else 2.0) * math.cos(2 * math.pi * (p - .05))
    pose.chest = yaw(chest_yaw) @ roll(-pelvis_roll * .45) @ pitch(lean + brake * .6 + (1.0 if carry else 0))
    pose.head = yaw(chest_yaw * .2) @ roll(pelvis_roll * .1) @ pitch(3.0 if not carry else -3.0 + .8 * bob)
    for side, sign in SIDES:
        pose.feet[side] = walk_foot(p, side, sign)
    if not carry:
        for side, sign in SIDES:
            # Arms counter the legs, trail the chest by ~2 frames, and the
            # forearm and hand trail the upper arm (overlapping action).
            opposite = 0.0 if side == 'r' else 0.5
            swing = 18 * math.cos(2 * math.pi * (p - opposite - .07)) + 2
            forward = .5 + .5 * math.cos(2 * math.pi * (p - opposite - .12))
            elbow = 12 + 16 * forward ** 1.4
            hand_lag = 7 * math.sin(2 * math.pi * (p - opposite - .10))
            pose.hands[side] = arm_target(sign, shoulder_world(pose, side), 13.5 + 1.5 * forward, swing, elbow, hand_lag)
        return pose
    # Crate rides the chest with a one-frame lag and a softened bounce.
    lagged = -math.cos(4 * math.pi * (p - .10))
    crate_at = Vector((sway * .7, -.015, height + .018 - .010 * lagged))
    crate_q = roll(pelvis_roll * .25 - sway * 40) @ yaw(chest_yaw * .6) @ pitch(-2.0 + .9 * lagged)
    pose.cargo = (crate_at, crate_q)
    center = head('builder_cargo') + crate_at
    for side, sign in SIDES:
        grip = center + crate_q @ Vector((sign * .238, .03, -.02))
        wrist = grip + crate_q @ Vector((sign * .02, .04, -.05))
        pole = (LEFT * sign * .85 + (-FWD) * .6 + Vector((0, 0, -.35))).normalized()
        hand_dir = (crate_q @ Vector((-sign * .25, -1, -.15))).normalized()
        back = (crate_q @ (LEFT * sign)).normalized()
        pose.hands[side] = (wrist, pole, hand_dir, back)
    return pose


# ── IDLE (4 s loop) ────────────────────────────────────────────────────────
IDLE_FEET = {'l': (P(.142, .065, ANKLE_Z), 11.0), 'r': (P(-.150, .015, ANKLE_Z), -14.0)}
breath = Loop([(0.0, 0.0), (.42, 1.0), (.62, .72), (.86, .12)])
glance = Loop([(0.0, 0.0), (.18, 0.0, 0), (.36, 1.0), (.58, .92, 0), (.78, 0.0, 0)])
shift = Loop([(0.0, 0.0), (.30, .55), (.55, 1.0), (.80, .45)])


def idle_pose(p):
    pose = Pose()
    b, g, w = breath(p), glance(p), shift(p)
    # Contrapposto: weight on the right leg, left hip and knee soften.
    pose.pelvis_at = Vector((-.030 - .012 * w, -.018 + .004 * w, -.013 + .003 * b - .002 * w))
    pose.pelvis = roll(2.6 + 1.2 * w) @ yaw(-3.0 - 1.5 * w) @ pitch(.6)
    pose.spine = roll(-.8 - .6 * w) @ yaw(-1.0) @ pitch(1.4 - 1.1 * b)
    pose.chest = roll(-2.2 - .9 * w) @ yaw(1.5 + 2.5 * g) @ pitch(1.2 - 1.4 * b)
    pose.head = yaw(3.0 + 16.0 * g) @ roll(1.4 + 2.2 * g) @ pitch(3.0 - 1.0 * b + 1.5 * g)
    for side, sign in SIDES:
        ankle, toe_out = IDLE_FEET[side]
        pose.feet[side] = level_foot(ankle, toe_out, pole_out=.18 * sign)
    for side, sign in SIDES:
        sway = (.6 if side == 'l' else -.6) * w
        pose.hands[side] = arm_target(sign, shoulder_world(pose, side), 12.5 + .8 * b, 3.5 + sway + .8 * b,
                                      13 + 2 * b, 4 + 2 * b)
    return pose


# ── WORK: mallet strike (1.6 s loop) ───────────────────────────────────────
# Frame keys at 15 fps: ready 0 · lift 1–6 · apex hold 7–8 · whip 9–10 ·
# contact 11–12 · rebound 13 · settle 14–16 · recover 17–23.
F = lambda frame: frame / 24
WORK_FEET = {'l': (P(.155, .12, ANKLE_Z), 9.0), 'r': (P(-.165, -.12, ANKLE_Z), -24.0)}
work_keys = {
    # pelvis offset (x, f, z), pelvis yaw, torso pitch, chest yaw, head pitch
    'pelvis': Loop([(F(0), P(-.010, .010, -.035)), (F(7), P(-.028, -.032, -.030), 0), (F(8), P(-.028, -.035, -.028), 0),
                    (F(11), P(.012, .050, -.078), 0), (F(12), P(.012, .052, -.082), 0), (F(14), P(.008, .045, -.070)),
                    (F(18), P(-.004, .022, -.046))]),
    'yaw': Loop([(F(0), -4.0), (F(7), -13.0, 0), (F(8), -14.0, 0), (F(11), 5.0, 0), (F(14), 4.0), (F(19), -2.0)]),
    'pitch': Loop([(F(0), 10.0), (F(7), -4.0, 0), (F(8), -5.0, 0), (F(10), 16.0, 1.6), (F(11), 25.0, 0), (F(12), 27.0, 0),
                   (F(14), 23.0), (F(19), 13.0)]),
    'chest': Loop([(F(0), -6.0), (F(7), -19.0, 0), (F(8), -20.0, 0), (F(11), 9.0, 0), (F(14), 6.0), (F(19), -2.0)]),
    'look': Loop([(F(0), 20.0), (F(7), 9.0), (F(8), 9.0, 0), (F(11), 26.0, 0), (F(14), 25.0), (F(19), 22.0)]),
    # right wrist in pelvis-free character space; elbow pole; mallet direction
    'wrist': Loop([(F(0), P(-.235, .30, .98)), (F(3), P(-.28, .24, 1.15)), (F(6), P(-.27, .02, 1.55)),
                   (F(7), P(-.275, -.04, 1.64), 0), (F(8), P(-.27, -.07, 1.68), 0), (F(9), P(-.24, .08, 1.72), 1.6),
                   (F(10), P(-.19, .40, 1.18), 1.8), (F(11), P(-.16, .44, .80), 0), (F(12), P(-.16, .445, .79), 0),
                   (F(13), P(-.16, .43, .88), 0), (F(15), P(-.17, .41, .84)), (F(19), P(-.20, .36, .90))]),
    'pole': Loop([(F(0), P(-.9, -.5, -.3)), (F(6), P(-.85, -.2, .5)), (F(8), P(-.8, -.1, .6)), (F(10), P(-.8, -.45, -.1)),
                  (F(11), P(-.7, -.6, -.3)), (F(17), P(-.85, -.55, -.35))]),
    'mallet': Loop([(F(0), P(-.10, .75, .65)), (F(4), P(-.15, .15, 1.0)), (F(7), P(-.05, -.95, -.10), 0),
                    (F(8), P(-.05, -.90, -.35), 0), (F(9), P(-.05, -.35, 1.0), 1.5), (F(10), P(0.0, .95, .20), 1.5),
                    (F(11), P(0.0, .80, -.55), 0), (F(12), P(0.0, .80, -.55), 0), (F(13), P(0.0, .85, -.30), 0),
                    (F(16), P(-.05, .85, .15)), (F(20), P(-.08, .80, .50))]),
    # left arm: steadies in front on the lift, braces the thigh on the strike
    'lwrist': Loop([(F(0), P(.225, .20, .90)), (F(6), P(.205, .25, .96), 0), (F(8), P(.205, .25, .96), 0),
                    (F(10), P(.215, .28, .90), 1.4), (F(11), P(.215, .24, .80), 0), (F(15), P(.215, .22, .82)),
                    (F(19), P(.225, .19, .84))]),
}


def work_pose(p):
    pose = Pose()
    pose.tool = True
    pose.pelvis_at = work_keys['pelvis'](p)
    y, t, c, look = work_keys['yaw'](p), work_keys['pitch'](p), work_keys['chest'](p), work_keys['look'](p)
    pose.pelvis = yaw(y) @ pitch(t * .25)
    pose.spine = yaw(y + c * .35) @ pitch(t * .55)
    pose.chest = yaw(y + c) @ pitch(t)
    pose.head = yaw((y + c) * .4) @ pitch(look)
    for side, sign in SIDES:
        ankle, toe_out = WORK_FEET[side]
        pose.feet[side] = level_foot(ankle, toe_out, pole_out=.25 * sign)
    wrist = work_keys['wrist'](p)
    pole = work_keys['pole'](p).normalized()
    mallet = work_keys['mallet'](p).normalized()
    shoulder = shoulder_world(pose, 'r')
    elbow_guess, _ = two_bone(shoulder, wrist, UPPER_ARM, FOREARM, pole)
    fore = (wrist - elbow_guess).normalized()
    # Hand axis: the forearm with the handle component removed, so the
    # handle leaves the fist square and the wrist bend stays reviewable.
    hand = (fore - mallet * fore.dot(mallet)).normalized()
    pose.hands['r'] = (wrist, pole, hand, mallet)
    lw = work_keys['lwrist'](p)
    lpole = (LEFT * .5 + (-FWD) * .8 + Vector((0, 0, -.3))).normalized()
    lshoulder = shoulder_world(pose, 'l')
    lelbow, _ = two_bone(lshoulder, lw, UPPER_ARM, FOREARM, lpole)
    lfore = (lw - lelbow).normalized()
    lhand = (lfore + FWD * .25).normalized()
    pose.hands['l'] = (lw, lpole, lhand, (LEFT - lhand * lhand.dot(LEFT)).normalized())
    return pose


ACTIONS = [('walk', 'Builder_Walk', 24, 1.0666667222976685, lambda p: walk_pose(p)),
           ('idle', 'Builder_Rest', 24, 4.0, idle_pose),
           ('work', 'Builder_Hammer', 24, 1.6, work_pose),
           ('carry', 'Builder_Carry', 24, 1.0666667222976685, lambda p: walk_pose(p, carry=True))]
MARKERS = {'work': [('ready', 1), ('lift', 3), ('apex', 8), ('whip', 10), ('contact', 12), ('rebound', 14), ('recover', 18)],
           'walk': [('left contact', 1), ('left passing', 8), ('right contact', 13), ('right passing', 20)],
           'carry': [('left contact', 1), ('left passing', 8), ('right contact', 13), ('right passing', 20)]}


def slot(action):
    handles = {bag.slot_handle for layer in action.layers for strip in layer.strips
               for bag in strip.channelbags if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(s for s in action.slots if s.handle in handles)


report = {'profile': 'adult-craftsperson-v1', 'motion': 'builder-motion-v2', 'stride': STRIDE, 'actions': {}}
old = {a['realm_id']: a for a in bpy.data.actions if 'realm_id' in a}
assert sorted(old) == ['carry', 'idle', 'walk', 'work'], sorted(old)
for a in old.values():
    bpy.data.actions.remove(a)
walk_feet = {}
for action_id, clip, frames, duration, author in ACTIONS:
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    action['realm_id'], action['realm_frames'], action['realm_duration'] = action_id, frames, duration
    action['realm_motion'] = 'builder-motion-v2'
    rig.animation_data.action = action
    stats, previous, per_frame = {}, {}, []
    for f in range(frames + 1):
        scene.frame_set(f + 1)
        frame_stats = {}
        apply(author((f % frames) / frames), frame_stats)
        for key, value in frame_stats.items():
            stats[key] = max(stats.get(key, 0), value)
        feet = {s: PB[f'foot.{s}'].head.copy() for s, _ in SIDES}
        drops = {s: (PB[f'foot.{s}'].head - PB[f'toes.{s}'].head).z for s, _ in SIDES}
        per_frame.append({'feet': {s: list(v) for s, v in feet.items()}, 'toeDrop': drops,
                          'hips': list(PB['hips'].head), 'wristBend': frame_stats['wristBend'],
                          **{k: frame_stats[k] for k in ('leg.l', 'leg.r', 'arm.l', 'arm.r')}})
        if action_id == 'walk':
            walk_feet[f] = feet
        if action_id == 'carry':
            stats['carryFootError'] = max(stats.get('carryFootError', 0),
                                          max((feet[s] - walk_feet[f][s]).length for s, _ in SIDES))
        for bone in ORDERED:
            if bone.name in previous:
                bone.rotation_quaternion.make_compatible(previous[bone.name])
            previous[bone.name] = bone.rotation_quaternion.copy()
            for path in ['location', 'rotation_quaternion', 'scale']:
                bone.keyframe_insert(data_path=path, frame=f + 1, group=bone.name)
    action.use_frame_range = True
    action.frame_start, action.frame_end = 1, frames + 1
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'
    for name, frame in MARKERS.get(action_id, []):
        action.pose_markers.new(name).frame = frame
    if action_id in ('idle', 'work'):
        first = per_frame[0]['feet']
        stats['standingDrift'] = max((Vector(fr['feet'][s]) - Vector(first[s])).length for fr in per_frame for s, _ in SIDES)
    planted = []
    for f, fr in enumerate(per_frame[:frames]):
        phase = f / frames
        for s, sign in SIDES:
            local = wrap(phase + (0.5 if s == 'r' else 0.0))
            if action_id in ('idle', 'work') or local <= STANCE:
                planted.append(fr['toeDrop'][s])
    stats['toeDrop'] = [min(planted), max(planted)]
    if args.table:
        print(f'{action_id:6s} frame  legL   legR   armL   armR   hipsZ  wrist')
        for f, fr in enumerate(per_frame[:frames]):
            print(f"{action_id:6s} {f:5d}  {fr['leg.l']:.3f}  {fr['leg.r']:.3f}  {fr['arm.l']:.3f}  {fr['arm.r']:.3f}"
                  f"  {fr['hips'][2]:.3f}  {fr['wristBend']:5.1f}")
    stats['legReach'] = max(max(fr['leg.l'], fr['leg.r']) for fr in per_frame)
    stats['armReach'] = max(max(fr['arm.l'], fr['arm.r']) for fr in per_frame)
    stats['hipsHeight'] = [min(fr['hips'][2] for fr in per_frame), max(fr['hips'][2] for fr in per_frame)]
    report['actions'][action_id] = {'frames': frames, 'duration': duration, **stats}
    assert stats['ankleError'] < 2e-6 and stats['wristError'] < 2e-6, (action_id, stats)
    assert stats['legReach'] < .9985 and stats['armReach'] < .9975, (action_id, stats['legReach'], stats['armReach'])
    assert stats['wristBend'] < 45, (action_id, stats['wristBend'])
    assert .1185 < stats['toeDrop'][0] and stats['toeDrop'][1] < .1195, (action_id, stats['toeDrop'])
    assert stats.get('standingDrift', 0) < 1e-5 and stats.get('carryFootError', 0) < 2e-6, (action_id, stats)

rig['realm_motion'] = 'builder-motion-v2'
scene['Realm motion'] = (f'Builder motion v2: weighted walk ({STRIDE:.2f} m stride, counter-rotation, arm swing with '
                         'overlap), contrapposto rest with breath and glance, anticipated mallet strike, '
                         'counterbalanced carry.')
text = bpy.data.texts.get('START HERE - Builder')
NOTE = ('\nMotion v2 was authored by scripts/citizen-sprites/animate_builder.py from key poses; the saved\n'
        'keys are now the source. Edit them in the Action Editor; do not rerun the script over edits.\n')
if text and NOTE not in text.as_string():
    text.write(NOTE)
rig.animation_data.action = next(a for a in bpy.data.actions if a.get('realm_id') == 'idle')
rig.animation_data.action_slot = slot(rig.animation_data.action)
scene.frame_start, scene.frame_end = 1, 25
scene.frame_set(1)
update()
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
destination.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
print('Staged builder motion:', destination)
