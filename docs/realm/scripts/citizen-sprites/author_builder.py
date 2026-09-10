"""Stage the builder from the saved adult skeleton; never overwrite the Founder.

The editable result owns all four actions and its wardrobe. Walking retains the
source ankle trajectories. Work and cargo use wrist targets and an elbow pole,
so a bent arm has one continuous sleeve instead of intersecting shoulder parts.
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
parser.add_argument('--output', default='tmp/citizen-sprites/builder-212/builder.blend')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
destination = ROOT / args.output
assert 'tmp' in destination.relative_to(ROOT).parts, 'Author into staging; review before promotion'
destination.parent.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert rig.get('realm_anatomy') == 'adult-traveler-v1', 'Start from the saved adult Founder'


def update():
    bpy.context.view_layer.update()


def slot(action):
    handles = {bag.slot_handle for layer in action.layers for strip in layer.strips
               for bag in strip.channelbags
               if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(s for s in action.slots if s.handle in handles)


def smooth(a, b, t):
    u = max(0, min(1, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


for track in rig.animation_data.nla_tracks:
    track.mute = True
old_actions = [a for a in bpy.data.actions if 'realm_id' in a]
original_bones = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
library = {}
for key, frames in [('walk', 24), ('idle', 24)]:
    action = next(a for a in old_actions if a['realm_id'] == key)
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot(action)
    samples = []
    for f in range(frames + 1):
        value = 1 + (f % frames) / frames * action['realm_frames']
        scene.frame_set(int(value), subframe=value % 1)
        update()
        samples.append({b.name: b.matrix.copy() for b in original_bones})
    library[key] = samples

rig.animation_data.action = None
for b in rig.pose.bones:
    b.matrix_basis = Matrix.Identity(4)
rig.data.pose_position = 'REST'
update()
rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}

# Preserve the proven skeleton and ankle paths, not the oversized source art.
for obj in list(scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.data.objects.remove(obj, do_unlink=True)

PALETTE = {
    'linen': '#b4a88b', 'cloth': '#4e6061', 'leather': '#66503c',
    'boot': '#443c33', 'trouser': '#645e4f', 'skin': '#ab7b59',
    'hair': '#40382f', 'grey': '#8a8374', 'eye': '#c3b5a0',
    'iris': '#353a32', 'mouth': '#704737', 'metal': '#888579',
    'wood': '#84684a', 'woodedge': '#65503a', 'thread': '#c4b593',
}
materials = {}
for name, hex_color in PALETTE.items():
    mat = bpy.data.materials.new(f'Builder {name}')
    mat.use_nodes = True
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb] + [1]
    mat.diffuse_color = linear
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear
    bsdf.inputs['Roughness'].default_value = .57 if name == 'metal' else .87
    bsdf.inputs['Metallic'].default_value = .62 if name == 'metal' else 0
    materials[name] = mat


def mesh(name, vertices, faces, weights, kind, smooth_faces=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    uv = data.uv_layers.new(name='Surface')
    for p in data.polygons:
        p.use_smooth = smooth_faces
        for loop in p.loop_indices:
            v = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = (v.x, v.z)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = rig
    data.materials.append(materials[kind])
    groups = {}
    for i, record in enumerate(weights):
        for bone_name, weight in record.items():
            if weight <= 0:
                continue
            if bone_name not in groups:
                groups[bone_name] = obj.vertex_groups.new(name=bone_name)
            groups[bone_name].add([i], weight, 'REPLACE')
    mod = obj.modifiers.new('Builder skin', 'ARMATURE')
    mod.object = rig
    return obj


def body_weights(z):
    chest = smooth(1.10, 1.33, z)
    spine = (1 - chest) * smooth(.92, 1.12, z)
    return {'chest': chest, 'spine': spine, 'hips': 1 - chest - spine}


def ellipsoid(name, center, radii, kind, bone, segments=24, rings=12, rotation=None):
    vertices, faces = [], []
    c = Vector(center)
    for row in range(rings + 1):
        lat = math.pi * row / rings
        for j in range(segments):
            a = math.tau * j / segments
            v = Vector((radii[0] * math.sin(lat) * math.cos(a),
                        radii[1] * math.sin(lat) * math.sin(a), radii[2] * math.cos(lat)))
            vertices.append(c + (rotation @ v if rotation else v))
            if row:
                i = (row - 1) * segments + j
                n = (row - 1) * segments + (j + 1) % segments
                faces.append((i, n, n + segments, i + segments))
    weights = [bone if isinstance(bone, dict) else {bone: 1} for _ in vertices]
    return mesh(name, vertices, faces, weights, kind)


def box(name, center, size, kind, bone, bevel=.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Worn edges', 'BEVEL')
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    faces = [list(p.vertices) for p in obj.data.polygons]
    bpy.data.objects.remove(obj, do_unlink=True)
    return mesh(name, coords, faces, [{bone: 1} for _ in coords], kind, False)


# Plain wool trousers and shaped leather boots use the same rest joints and
# sole level as the proven walk, with a narrower, continuous adult silhouette.
for side, sign in [('l', 1), ('r', -1)]:
    center_x = rest[f'upperleg.{side}'].translation.x
    knee_z = rest[f'lowerleg.{side}'].translation.z
    profile = [(.265, .053), (.32, .058), (.40, .058), (.46, .061),
               (.52, .067), (.65, .076), (.80, .082), (.94, .083)]
    vv, ff, ww = [], [], []
    for row in range(36):
        z = .265 + row / 35 * .675
        r = profile[-1][1]
        for (za, ra), (zb, rb) in zip(profile, profile[1:]):
            if za <= z <= zb:
                t = (z - za) / (zb - za)
                r = ra + (rb - ra) * t
                break
        lower = 1 - smooth(knee_z - .06, knee_z + .06, z)
        for j in range(32):
            a = j * math.tau / 32
            fold = .0016 * math.sin(z * 65 + 2 * math.cos(a * 3))
            vv.append((center_x + (r + fold) * math.cos(a), (r * .92 + fold) * math.sin(a), z))
            ww.append({f'upperleg.{side}': 1 - lower, f'lowerleg.{side}': lower})
            if row:
                i, n = (row - 1) * 32 + j, (row - 1) * 32 + (j + 1) % 32
                ff.append((i, n, n + 32, i + 32))
    mesh(f'Builder trousers {side}', vv, ff, ww, 'trouser')
    profile = [(0, .061, -.167, .075), (.014, .061, -.167, .075),
               (.036, .060, -.166, .073), (.067, .058, -.159, .069),
               (.095, .055, -.126, .062), (.126, .053, -.062, .064),
               (.18, .052, -.049, .061), (.245, .053, -.046, .060),
               (.282, .057, -.051, .065)]
    vv, ff, ww = [], [], []
    for row, (z, rx, front, back) in enumerate(profile):
        for j in range(48):
            a = j * math.tau / 48
            vv.append((center_x + rx * math.cos(a), (front + back) / 2 + (back - front) / 2 * math.sin(a), z))
            lower = .70 * smooth(.13, .28, z)
            ww.append({f'foot.{side}': 1 - lower, f'lowerleg.{side}': lower})
            if row:
                i, n = (row - 1) * 48 + j, (row - 1) * 48 + (j + 1) % 48
                ff.append((i, n, n + 48, i + 48))
    ff += [tuple(reversed(range(48))), tuple((len(profile) - 1) * 48 + j for j in range(48))]
    boot = mesh(f'Builder boot {side}', vv, ff, ww, 'boot')
    boot.data.materials.append(materials['woodedge'])
    for p in boot.data.polygons:
        if max(boot.data.vertices[i].co.z for i in p.vertices) <= .014:
            p.material_index = 1

# A fitted torso and continuous sleeves. The shirt's arm roots share torso
# weights and sit inside its shoulder; the rolled cuffs are below the elbow.
BODY = [(.80, .183, .101), (.89, .188, .108), (1.00, .168, .108),
        (1.13, .174, .113), (1.26, .203, .120), (1.37, .213, .117),
        (1.43, .188, .102), (1.48, .080, .066), (1.505, .065, .055)]


def cross_section(z):
    for (a, x, y), (b, xx, yy) in zip(BODY, BODY[1:]):
        if a <= z <= b:
            t = (z - a) / (b - a)
            return x + (xx - x) * t, y + (yy - y) * t
    return BODY[0][1:] if z < BODY[0][0] else BODY[-1][1:]


def front_surface(x, z, depth=.006):
    rx, ry = cross_section(z)
    return Vector((x, -ry * math.sqrt(max(.02, 1 - (x / rx) ** 2)) - depth, z))


vertices, faces, weights = [], [], []
for row, (z, rx, ry) in enumerate(BODY):
    for j in range(48):
        a = j * math.tau / 48
        pleat = 1 + .012 * math.cos(a * 12) * (1 - smooth(1.15, 1.4, z))
        vertices.append((rx * math.cos(a) * pleat, ry * math.sin(a) * pleat, z))
        weights.append(body_weights(z))
        if row:
            i, n = (row - 1) * 48 + j, (row - 1) * 48 + (j + 1) % 48
            faces.append((i, n, n + 48, i + 48))
faces += [tuple(reversed(range(48))), tuple((len(BODY) - 1) * 48 + j for j in range(48))]
mesh('Builder linen shirt', vertices, faces, weights, 'linen')

for side, sign in [('l', 1), ('r', -1)]:
    shoulder, elbow, wrist = [rest[f'{part}.{side}'].translation for part in ['upperarm', 'lowerarm', 'wrist']]
    upper, lower = (elbow - shoulder).length, (wrist - elbow).length
    total = upper + lower
    axis = (wrist - shoulder).normalized()
    radial_y = Vector((0, 1, 0))
    radial_z = axis.cross(radial_y).normalized()

    def arm_weights(t):
        lower_weight = smooth(upper - .06, upper + .06, t)
        chest = .6 * (1 - smooth(-.025, .085, t))
        return {f'upperarm.{side}': (1 - lower_weight) * (1 - chest),
                f'lowerarm.{side}': lower_weight * (1 - chest), 'chest': chest}

    def tube(name, start, end, rings, kind, radius):
        vv, ff, ww = [], [], []
        for row in range(rings):
            t = start + (end - start) * row / (rings - 1)
            center = shoulder.lerp(elbow, t / upper) if t <= upper else elbow.lerp(wrist, (t - upper) / lower)
            for j in range(24):
                a = j * math.tau / 24
                r = radius(t, a)
                vv.append(center + radial_y * (math.cos(a) * r * .88) + radial_z * (math.sin(a) * r))
                ww.append(arm_weights(t))
                if row:
                    i, n = (row - 1) * 24 + j, (row - 1) * 24 + (j + 1) % 24
                    ff.append((i, n, n + 24, i + 24))
        ff += [tuple(reversed(range(24))), tuple((rings - 1) * 24 + j for j in range(24))]
        return mesh(name, vv, ff, ww, kind)

    tube(f'Builder sleeve {side}', -.047, upper + .095, 24, 'linen',
         lambda t, a: .077 - .019 * max(0, t / total) + .003 * math.sin(t * 60 + .8 * math.cos(a * 3)))
    tube(f'Builder rolled cuff {side}', upper + .056, upper + .102, 8, 'linen',
         lambda t, a: .070 + .003 * math.cos((t - upper) * 320))
    tube(f'Builder forearm {side}', upper + .081, total + .034, 18, 'skin',
         lambda t, a: .049 - .016 * (t - upper) / lower)
    # Closed but relaxed fingers: useful at tiny scale, with a real thumb and
    # separate knuckles in close views instead of spherical mittens.
    hand = f'hand.{side}'
    ellipsoid(f'Builder wrist {side}', (sign * .723, 0, 1.4124), (.034, .030, .026), 'skin',
              {f'wrist.{side}': .75, f'lowerarm.{side}': .25})
    ellipsoid(f'Builder palm {side}', (sign * .782, -.002, 1.4124), (.050, .032, .023), 'skin', hand)
    for finger in range(4):
        ellipsoid(f'Builder finger {side} {finger}',
                  (sign * (.824 - .003 * abs(1.5 - finger)), -.023 + finger * .015, 1.401),
                  (.017, .008, .018), 'skin', hand, 12, 8)
    ellipsoid(f'Builder thumb {side}', (sign * .784, -.030, 1.391), (.024, .013, .014), 'skin', hand, 16, 8)

# A short split apron follows the hip and the top of each thigh. Its hem cannot
# sweep through a knee in the walk. Waistcoat panels follow the shirt surface.
for sign, side in [(1, 'l'), (-1, 'r')]:
    vv, ff, ww = [], [], []
    for row in range(16):
        z = .785 + row / 15 * .45
        width = .176 - .055 * smooth(1.03, 1.23, z)
        for j in range(10):
            x = sign * (.009 + (width - .009) * j / 9)
            vv.append(front_surface(x, z, .023 + .016 * (1 - smooth(.8, 1.05, z))))
            w = body_weights(z)
            leg = .24 * (1 - smooth(.785, .95, z))
            w = {key: value * (1 - leg) for key, value in w.items()}
            w[f'upperleg.{side}'] = leg
            ww.append(w)
            if row and j:
                i = row * 10 + j
                ff.append((i - 11, i - 10, i, i - 1) if sign == 1 else (i - 1, i, i - 10, i - 11))
    mesh(f'Builder split apron {side}', vv, ff, ww, 'leather')
    vv, ff, ww = [], [], []
    for row in range(16):
        z = 1.01 + row / 15 * .424
        rx, _ = cross_section(z)
        inner = .025 + .072 * smooth(1.30, 1.45, z)
        outer = rx * .86
        for j in range(8):
            x = sign * (inner + (outer - inner) * j / 7)
            vv.append(front_surface(x, z, .011))
            ww.append(body_weights(z))
            if row and j:
                i = row * 8 + j
                ff.append((i - 9, i - 8, i, i - 1) if sign == 1 else (i - 1, i, i - 8, i - 9))
    mesh(f'Builder waistcoat {side}', vv, ff, ww, 'cloth')

for j in range(4):
    z = 1.1 + j * .075
    ellipsoid(f'Builder shirt button {j}', front_surface(0, z, .011), (.006, .004, .006), 'woodedge', body_weights(z), 12, 6)

vv, ff, ww = [], [], []
for row in range(24):
    z = 1.0 + row / 23 * .44
    rx, ry = cross_section(z)
    for j in range(33):
        a = -.05 + j / 32 * (math.pi + .1)
        vv.append(((rx + .006) * math.cos(a), (ry + .010) * math.sin(a), z))
        ww.append(body_weights(z))
        if row and j:
            i = row * 33 + j
            ff.append((i - 34, i - 33, i, i - 1))
mesh('Builder waistcoat back', vv, ff, ww, 'cloth')

# Neck, skull and jaw: the head is 0.26m of an adult body, with small eyes,
# cheek planes and a broad nose. These are editable geometry, not painted eyes
# on the oversized source head.
ellipsoid('Builder neck', (0, .005, 1.515), (.056, .056, .090), 'skin', {'chest': .25, 'head': .75})
HEAD = [(1.548, .033, .040, -.017), (1.575, .063, .061, -.009),
        (1.615, .088, .076, -.002), (1.665, .099, .084, .004),
        (1.710, .096, .086, .010), (1.754, .092, .089, .016),
        (1.790, .067, .070, .022), (1.812, .022, .024, .024),
        (1.820, .001, .001, .025)]


def head_section(z):
    for i, ((za, xa, ya, ca), (zb, xb, yb, cb)) in enumerate(zip(HEAD, HEAD[1:])):
        if za <= z <= zb:
            t = (z - za) / (zb - za)
            # Cubic Hermite interpolation removes the horizontal bands of a
            # low-ring ellipsoid while preserving the authored jaw profile.
            before, after = HEAD[max(0, i - 1)], HEAD[min(len(HEAD) - 1, i + 2)]
            values = []
            for channel in (1, 2, 3):
                a, b = HEAD[i][channel], HEAD[i + 1][channel]
                ma = (b - before[channel]) / (zb - before[0]) * (zb - za)
                mb = (after[channel] - a) / (after[0] - za) * (zb - za)
                values.append((2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*ma+(-2*t**3+3*t*t)*b+(t**3-t*t)*mb)
            return values
    return HEAD[-1][1:]


vv, ff = [], []
for row in range(81):
    z = 1.548 + row / 80 * .272
    rx, ry, cy = head_section(z)
    for j in range(128):
        a = j * math.tau / 128
        x, y = rx * math.cos(a), cy + ry * math.sin(a)
        front = max(0, -math.sin(a)) ** 12
        nose = math.exp(-(x/.015)**2) * (.027*math.exp(-((z-1.679)/.016)**2)+.010*math.exp(-((z-1.702)/.022)**2))
        socket = .004 * math.exp(-((abs(x)-.036)/.018)**2-((z-1.701)/.012)**2)
        cheek = .005 * math.exp(-((abs(x)-.048)/.026)**2-((z-1.668)/.020)**2)
        lip = .006 * math.exp(-(x/.030)**2-((z-1.638)/.009)**2)
        vv.append((x, y + front * (socket - nose - cheek - lip), z))
        if row:
            i, n = (row - 1) * 128 + j, (row - 1) * 128 + (j + 1) % 128
            ff.append((i, n, n + 128, i + 128))
ff += [tuple(reversed(range(128))), tuple(80 * 128 + j for j in range(128))]
head = mesh('Builder head', vv, ff, [{'head': 1} for _ in vv], 'skin')
# A cylindrical pigment map supplies a soft cropped hairline, salt at the
# temples and short stubble. Colour never cuts a polygon-sized stair into the
# face, and the nose/cheek volumes share the continuous underlying mesh.
face = bpy.data.materials.new('Builder face')
face.use_nodes = True
face.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .86
face.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (1, 1, 1, 1)
pigment = bpy.data.images.new('Builder face pigment', width=1024, height=512)
pixels = []
for y in range(512):
    z = 1.54 + (y + .5) / 512 * .29
    for x in range(1024):
        a = (x + .5) / 1024 * math.tau
        front, side = max(0, -math.sin(a)), abs(math.cos(a))
        grain = (math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1
        back = max(0, math.sin(a))
        hairline = 1.70 + .054 * math.sqrt(front) - .065 * back ** .8 + .001 * math.sin(a * 7)
        scalp = smooth(hairline - .0018, hairline + .0018, z)
        beardline = 1.632 + .050 * side ** 8
        beard = (1 - smooth(beardline - .006, beardline + .008, z)) * smooth(-.10, .08, -math.sin(a))
        stubble = beard * (.38 + .10 * grain)
        temple = smooth(.90, .99, side) * smooth(1.65, 1.67, z) * (1 - smooth(1.718, 1.747, z))
        skin_color, hair_color = (.70, .53, .40), (.24 + .11 * temple, .215 + .10 * temple, .18 + .09 * temple)
        weight = max(scalp, stubble)
        variation = .985 + .035 * grain
        pixels.extend([(s * (1 - weight) + h * weight) * variation for s, h in zip(skin_color, hair_color)] + [1])
pigment.pixels.foreach_set(pixels)
pigment.pack()
node = face.node_tree.nodes.new('ShaderNodeTexImage')
node.image = pigment
face.node_tree.links.new(node.outputs['Color'], face.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
head.data.materials.clear()
head.data.materials.append(face)
uv = head.data.uv_layers.active
for p in head.data.polygons:
    coords = []
    for loop in p.loop_indices:
        v = head.data.vertices[head.data.loops[loop].vertex_index].co
        # Preserve the original cylindrical angle despite sculpted face depth.
        index = head.data.loops[loop].vertex_index
        coords.append(((index % 128) / 128, (v.z - 1.54) / .29))
    seam = max(u for u, _ in coords) - min(u for u, _ in coords) > .5
    for loop, (u, v) in zip(p.loop_indices, coords):
        uv.data[loop].uv = (u + (1 if seam and u < .5 else 0), v)
for sign in [-1, 1]:
    ellipsoid(f'Builder ear {sign}', (sign * .102, .009, 1.667), (.018, .015, .030), 'skin', 'head', 16, 10)
    ellipsoid(f'Builder eye {sign}', (sign * .035, -.070, 1.701), (.014, .003, .0045), 'eye', 'head', 20, 8)
    ellipsoid(f'Builder iris {sign}', (sign * .034, -.073, 1.700), (.0045, .0017, .0040), 'iris', 'head', 16, 8)
    ellipsoid(f'Builder eyelid {sign}', (sign * .035, -.069, 1.706), (.017, .004, .0047), 'skin', 'head', 20, 8)
    ellipsoid(f'Builder brow {sign}', (sign * .039, -.078, 1.719), (.025, .0045, .005), 'hair', 'head', 16, 8,
              Quaternion((0, 1, 0), sign * -.08).to_matrix())
ellipsoid('Builder mouth', (0, -.084, 1.638), (.022, .002, .0023), 'mouth', 'head', 20, 8)

# Hair and beard are regions of the same closed head surface. Separate caps
# created small intersections which flickered on the scalp at game scale.

# Dedicated prop bones make visibility an authored clip property. The cargo
# is held with both hands; the mallet is rigidly attached to the striking hand.
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
tool = rig.data.edit_bones.new('builder_tool')
tool.head, tool.tail = (-.795, 0, 1.4124), (-.795, 0, 1.6124)
tool.parent = rig.data.edit_bones['hand.r']
cargo = rig.data.edit_bones.new('builder_cargo')
cargo.head, cargo.tail = (0, -.295, 1.045), (0, -.295, 1.145)
cargo.parent = rig.data.edit_bones['root']
bpy.ops.object.mode_set(mode='OBJECT')
update()
box('Builder mallet handle', (-.795, 0, 1.449), (.027, .028, .315), 'wood', 'builder_tool', .006)
box('Builder mallet head', (-.795, 0, 1.618), (.17, .088, .085), 'woodedge', 'builder_tool', .013)
box('Builder mallet face left', (-.886, 0, 1.618), (.012, .090, .087), 'metal', 'builder_tool', .004)
box('Builder mallet face right', (-.704, 0, 1.618), (.012, .090, .087), 'metal', 'builder_tool', .004)
for row in range(3):
    z = .94 + row * .084
    for y in [-.453, -.137]:
        box(f'Builder crate long board {row} {y}', (0, y, z), (.425, .021, .078), 'wood', 'builder_cargo')
    for x in [-.212, .212]:
        box(f'Builder crate end board {row} {x}', (x, -.295, z), (.021, .30, .078), 'wood', 'builder_cargo')
for x in [-.173, .173]:
    for y in [-.470, -.120]:
        box(f'Builder crate batten {x} {y}', (x, y, 1.025), (.038, .016, .28), 'woodedge', 'builder_cargo')
for j in range(5):
    box(f'Builder crate lid {j}', (-.172 + j * .086, -.295, 1.161), (.079, .326, .023), 'wood', 'builder_cargo')

rig.data.pose_position = 'POSE'
update()
ordered = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}


def rotate_to(bone, child, target):
    before = (child.head - bone.head).normalized()
    after = (target - bone.head).normalized()
    turn = before.rotation_difference(after)
    matrix = (turn @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
    matrix.translation = bone.head
    bone.matrix = matrix
    update()


def solve_arm(side, target):
    shoulder, elbow, wrist = [rig.pose.bones[f'{name}.{side}'] for name in ['upperarm', 'lowerarm', 'wrist']]
    a, b, c = [bone.head.copy() for bone in [shoulder, elbow, wrist]]
    upper, lower, distance = (b - a).length, (c - b).length, (target - a).length
    assert .03 < distance < upper + lower - .001, f'Unreachable {side} wrist {distance}'
    axis = (target - a).normalized()
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    pole = Vector((1 if side == 'l' else -1, 0, -.65))
    pole = (pole - axis * pole.dot(axis)).normalized()
    goal = a + axis * along + pole * math.sqrt(max(0, upper * upper - along * along))
    rotate_to(shoulder, elbow, goal)
    axis = (elbow.head - shoulder.head).normalized()
    current, desired = wrist.head - elbow.head, target - elbow.head
    current = (current - axis * current.dot(axis)).normalized()
    desired = (desired - axis * desired.dot(axis)).normalized()
    angle = math.atan2(axis.dot(current.cross(desired)), current.dot(desired))
    matrix = (Quaternion(axis, angle) @ shoulder.matrix.to_quaternion()).to_matrix().to_4x4()
    matrix.translation = shoulder.head
    shoulder.matrix = matrix
    update()
    rotate_to(elbow, wrist, target)
    return (wrist.head - target).length


def world_rotation(name, delta):
    bone = rig.pose.bones[name]
    matrix = (delta @ rest[name].to_quaternion()).to_matrix().to_4x4()
    matrix.translation = bone.head
    bone.matrix = matrix
    update()


def hand_rotation(side, axis, up):
    x = axis.normalized() * (1 if side == 'l' else -1)
    z = (up - x * up.dot(x)).normalized()
    y = z.cross(x).normalized()
    return Matrix((x, y, z)).transposed().to_quaternion()


report = {'profile': 'adult-craftsperson-v1', 'actions': {}}
for old in old_actions:
    bpy.data.actions.remove(old)
for action_id, clip, frames, duration in [('walk', 'Builder_Walk', 24, 1.0666667222976685),
                                          ('idle', 'Builder_Rest', 24, 4),
                                          ('work', 'Builder_Hammer', 24, 1.6),
                                          ('carry', 'Builder_Carry', 24, 1.0666667222976685)]:
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    action['realm_id'], action['realm_frames'], action['realm_duration'] = action_id, frames, duration
    rig.animation_data.action = action
    previous, max_ankle_error, max_wrist_error = {}, 0, 0
    for f in range(frames + 1):
        scene.frame_set(f + 1)
        for bone in ordered:
            bone.matrix_basis = Matrix.Identity(4)
            bone.rotation_mode = 'QUATERNION'
        update()
        sample = library['walk' if action_id in ['walk', 'carry'] else 'idle'][f if action_id != 'work' else 0]
        for bone in ordered:
            if bone.name in sample:
                bone.matrix = sample[bone.name]
                update()
        phase = (f / frames) % 1
        hip_motion = rig.pose.bones['hips'].head - rest['hips'].translation
        if action_id == 'carry':
            bob = Vector((hip_motion.x * .45, 0, hip_motion.z * .65))
            cargo = rig.pose.bones['builder_cargo']
            cargo.matrix = Matrix.Translation(bob) @ rest['builder_cargo']
            update()
            for side, sign in [('l', 1), ('r', -1)]:
                palm_axis = Vector((-sign * .7, -.68, .05)).normalized()
                grip = Vector((sign * .227, -.275, 1.08)) + bob
                target = grip - palm_axis * .078
                max_wrist_error = max(max_wrist_error, solve_arm(side, target))
                turn = hand_rotation(side, palm_axis, Vector((0, 0, 1)))
                world_rotation(f'wrist.{side}', turn)
                world_rotation(f'hand.{side}', turn)
            world_rotation('head', Quaternion((1, 0, 0), .06))
        elif action_id == 'work':
            lift = smooth(.02, .27, phase)
            strike = smooth(.33, .46, phase)
            recover = smooth(.60, .96, phase)
            raised = lift * (1 - strike)
            low = strike * (1 - recover)
            # Hold, brisk strike, small rebound and a slower return.
            wrist = Vector((-.255, -.195 - .145 * low + .04 * raised,
                            1.075 + .235 * raised - .055 * low + .018 * math.sin(math.pi * smooth(.46, .58, phase)) * low))
            max_wrist_error = max(max_wrist_error, solve_arm('r', wrist))
            swing = .18 - .38 * raised + 1.95 * low
            palm_axis = rig.pose.bones['wrist.r'].head - rig.pose.bones['lowerarm.r'].head
            turn = hand_rotation('r', palm_axis, Vector((0, -math.sin(swing), math.cos(swing))))
            world_rotation('wrist.r', turn)
            world_rotation('hand.r', turn)
            max_wrist_error = max(max_wrist_error, solve_arm('l', Vector((.235, -.265, 1.026))))
            turn = Quaternion((0, 0, 1), -math.pi / 2)
            world_rotation('wrist.l', turn)
            world_rotation('hand.l', turn)
            world_rotation('head', Quaternion((1, 0, 0), .10 + .045 * low))
        rig.pose.bones['builder_tool'].scale = (1, 1, 1) if action_id == 'work' else (0, 0, 0)
        rig.pose.bones['builder_cargo'].scale = (1, 1, 1) if action_id == 'carry' else (0, 0, 0)
        update()
        for side in ['l', 'r']:
            max_ankle_error = max(max_ankle_error, (rig.pose.bones[f'foot.{side}'].head - sample[f'foot.{side}'].translation).length)
        for bone in ordered:
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
    if action_id == 'work':
        for name, frame in [('ready', 1), ('backswing', 8), ('contact', 12), ('rebound', 14), ('recover', 21)]:
            action.pose_markers.new(name).frame = frame
    report['actions'][action_id] = {'frames': frames, 'duration': duration,
                                  'maxAnkleError': max_ankle_error, 'maxWristError': max_wrist_error}
    assert max_ankle_error < 2e-6 and max_wrist_error < 2e-6, report

rig.name = 'Builder - editable skeleton'
rig['realm_anatomy'] = report['profile']
rig['realm_character'] = 'builder'
scene['Realm source'] = 'Builder body, wardrobe and face; saved adult Founder skeleton and ankle paths (KayKit CC0 derivative)'
for text in list(bpy.data.texts):
    bpy.data.texts.remove(text)
bpy.data.texts.new('START HERE - Builder').write('Builder: editable mesh, materials and four saved actions.\n'
    'Use the Action Editor to choose Builder_Walk, Builder_Rest, Builder_Hammer or Builder_Carry.\n'
    'Do not rerun author_builder.py over an edited scene: that is a staging bootstrap.\n'
    'Re-export the saved source, normalize action time and bake through citizen-sprites.\n'
    'The ankle paths come from the preserved adult Founder. Props and wrist grips belong to the saved clips.\n')
rig.animation_data.action = next(a for a in bpy.data.actions if a.get('realm_id') == 'idle')
rig.animation_data.action_slot = slot(rig.animation_data.action)
scene.frame_start, scene.frame_end = 1, 25
scene.frame_set(1)
update()
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
destination.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
print('Staged builder:', destination)
