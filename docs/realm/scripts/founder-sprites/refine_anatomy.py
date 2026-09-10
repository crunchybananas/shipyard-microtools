"""Stage an adult-proportion Founder from the preserved pre-anatomy scene.

Run against founder-actions-before-anatomy.blend, never an already reshaped rig.
Mesh bind coordinates and rest joints change together. Saved upper-body poses
are retargeted; two-bone IK keeps each original ankle trajectory and sole angle.
The authoritative scene is replaced only after reviewing the staged export.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='tmp/founder-sprites/anatomy-206/founder-anatomy.blend')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
destination = ROOT / args.output
destination.parent.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert not rig.get('realm_anatomy'), 'Start with the preserved pre-anatomy source'


def slot(action):
    handles = {bag.slot_handle for layer in action.layers for strip in layer.strips
               for bag in strip.channelbags
               if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(s for s in action.slots if s.handle in handles)


def update():
    bpy.context.view_layer.update()


for track in rig.animation_data.nla_tracks:
    track.mute = True
ordered = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
actions = [a for a in bpy.data.actions if 'realm_id' in a]
library = []
for action in actions:
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot(action)
    frames = action['realm_frames']
    samples = []
    for f in range(frames + 1):
        scene.frame_set(f + 1)
        update()
        samples.append({b.name: b.matrix.copy() for b in ordered})
    library.append((action, samples, [(m.name, m.frame) for m in action.pose_markers]))

rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
rig.data.pose_position = 'REST'
update()
rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
meshes = []
for obj in scene.objects:
    if obj.type != 'MESH':
        continue
    parent = obj.parent
    while parent and parent != rig:
        parent = parent.parent
    if parent == rig or any(m.type == 'ARMATURE' and m.object == rig for m in obj.modifiers):
        meshes.append((obj, [obj.matrix_world @ v.co for v in obj.data.vertices]))

ANKLE = .14523719251155853
HIP = .5192506313323975
NECK = 1.2414252758026123
SHOULDER_X = .2120073288679123
SHOULDER_Z = 1.106760859489441
WRIST_X = .7131814360618591
LEG_X = .17094504833221436


def height(z):
    if z <= ANKLE:
        return z
    if z <= HIP:
        return ANKLE + (z - ANKLE) * 2.10
    return ANKLE + (HIP - ANKLE) * 2.10 + (z - HIP) * .82


def body(p):
    return Vector((p.x * .57, p.y * .46, height(p.z)))


def head(p):
    return Vector((p.x * .26, p.y * .28, height(NECK) + (p.z - NECK) * .32))


def arm(p):
    sign = 1 if p.x >= 0 else -1
    x = abs(p.x)
    if x < SHOULDER_X:
        x *= .65
    elif x < WRIST_X:
        x = SHOULDER_X * .65 + (x - SHOULDER_X) * 1.13
    else:
        x = SHOULDER_X * .65 + (WRIST_X - SHOULDER_X) * 1.13 + (x - WRIST_X) * .70
    return Vector((sign * x, p.y * .62, height(SHOULDER_Z) + (p.z - SHOULDER_Z) * .62))


def leg(p):
    sign = 1 if p.x >= 0 else -1
    return Vector((sign * LEG_X * .80 + (p.x - sign * LEG_X) * .65,
                   .0185859 + (p.y - .0185859) * .70, height(p.z)))


def cloak(p):
    result = body(p)
    fall = min(1, max(0, (1.24 - p.z) / 1.16))
    result.z += .31 * fall * fall
    result.y += .13 * fall * fall
    return result


def bone_map(name, p):
    if name == 'root':
        return p.copy()
    if name == 'head':
        return head(p)
    if any(part in name for part in ['arm', 'wrist', 'hand', 'elbow']):
        return arm(p)
    if any(part in name for part in ['leg', 'foot', 'toe', 'heel', 'knee']):
        return leg(p)
    return body(p)


bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:
    old_z_axis = bone.z_axis.copy()
    bone.head, bone.tail = bone_map(bone.name, bone.head), bone_map(bone.name, bone.tail)
    bone.align_roll(old_z_axis)
bpy.ops.object.mode_set(mode='OBJECT')
update()
for obj, coordinates in meshes:
    mapping = (head if obj.name == 'Cube.210' else arm if obj.name in ['Cube.199', 'Cube.202']
               else leg if obj.name in ['Cube.194', 'Cube.187'] else cloak if obj.name == 'Rogue_Cape' else body)
    inverse = obj.matrix_world.inverted()
    for v, p in zip(obj.data.vertices, coordinates):
        v.co = inverse @ mapping(p)
    obj.data.update()
    if obj.name in ['Cube.199', 'Cube.202']:
        # Keep the original gloves. The heavily blended old sleeve produces
        # jagged shoulder patches after an adult shoulder/arm retarget.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        remove = [bm.verts[i] for i, p in enumerate(coordinates) if abs(p.x) < WRIST_X - .006]
        bmesh.ops.delete(bm, geom=remove, context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()

rig.data.pose_position = 'POSE'
update()
new_rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
hip_offset = new_rest['hips'].translation - rest['hips'].translation


def material(kind):
    name = f'Realm {kind}'
    result = bpy.data.materials.get(name)
    if result:
        return result
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    color = {'cloth': (67, 86, 76), 'leather': (98, 75, 55), 'metal': (161, 144, 107)}[kind]
    linear = [pow(v / 255, 2.2) for v in color] + [1]
    result.diffuse_color = linear
    bsdf = result.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear
    bsdf.inputs['Roughness'].default_value = .6 if kind == 'metal' else .9
    bsdf.inputs['Metallic'].default_value = .7 if kind == 'metal' else 0
    return result


def skinned_mesh(name, vertices, faces, weights, kind, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='Surface')
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
        for loop in polygon.loop_indices:
            p = mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv = (p.x, p.z)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = rig
    obj.data.materials.append(material(kind))
    groups = {}
    for i, record in enumerate(weights):
        for name, weight in record.items():
            if weight <= 0:
                continue
            if name not in groups:
                groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([i], weight, 'REPLACE')
    modifier = obj.modifiers.new('Founder skin', 'ARMATURE')
    modifier.object = rig
    return obj


for side in ['l', 'r']:
    shoulder, elbow, wrist = [new_rest[f'{part}.{side}'].translation for part in ['upperarm', 'lowerarm', 'wrist']]
    upper, lower = (elbow - shoulder).length, (wrist - elbow).length
    total = upper + lower
    axis = (wrist - shoulder).normalized()
    radial_y = Vector((0, 1, 0))
    radial_z = axis.cross(radial_y).normalized()

    def sleeve_weights(t):
        lower_weight = max(0, min(1, (t - upper + .045) / .09))
        chest_weight = .25 * max(0, min(1, (.055 - t) / .09))
        return {f'upperarm.{side}': (1 - lower_weight) * (1 - chest_weight),
                f'lowerarm.{side}': lower_weight * (1 - chest_weight), 'chest': chest_weight}

    def tube(name, start, end, rings, kind, radius):
        vertices, faces, weights = [], [], []
        segments = 16
        for ring in range(rings):
            t = start + (end - start) * ring / (rings - 1)
            center = shoulder.lerp(elbow, t / upper) if t <= upper else elbow.lerp(wrist, (t - upper) / lower)
            r = radius(t)
            for j in range(segments):
                angle = math.tau * j / segments
                p = center + radial_y * (math.cos(angle) * r * .9) + radial_z * (math.sin(angle) * r)
                vertices.append(p)
                weights.append(sleeve_weights(t))
            if ring:
                for j in range(segments):
                    a, b = (ring - 1) * segments + j, (ring - 1) * segments + (j + 1) % segments
                    faces.append((a, b, b + segments, a + segments))
        faces.extend([tuple(reversed(range(segments))), tuple((rings - 1) * segments + j for j in range(segments))])
        return skinned_mesh(name, vertices, faces, weights, kind)

    tube(f'Founder fitted sleeve {side}', -.035, total + .003, 25, 'cloth',
         lambda t: .083 - .030 * max(0, min(1, t / total)) + .002 * math.sin(t / total * math.pi * 7))
    tube(f'Founder leather cuff {side}', total - .069, total + .011, 5, 'leather', lambda t: .062)
    tube(f'Founder sleeve seam {side}', .094, .102, 2, 'leather', lambda t: .081)

# The strap follows the actual garment surface, including its changing depth.
# Transfer local garment weights so the strap moves with the underlying cloth.
torso = bpy.data.objects['PrototypePete_body.025']
coordinates = [torso.matrix_world @ v.co for v in torso.data.vertices]
polygons = [list(p.vertices) for p in torso.data.polygons]
bvh = BVHTree.FromPolygons(coordinates, polygons)


def surface(x, z):
    hit, normal, index, _ = bvh.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))
    assert hit is not None, f'Strap leaves the tunic at {x}, {z}'
    result = {}
    vertices = polygons[index]
    proximity = [1 / max(.0001, (coordinates[v] - hit).length) for v in vertices]
    total = sum(proximity)
    for i, proximity_weight in zip(vertices, proximity):
        for group in torso.data.vertices[i].groups:
            name = torso.vertex_groups[group.group].name
            result[name] = result.get(name, 0) + group.weight * proximity_weight / total
    normalization = sum(result.values())
    result = {name: weight / normalization for name, weight in result.items()}
    hit.y -= .009
    return hit, result


vertices, faces, weights = [], [], []
for ring in range(18):
    t = ring / 17
    x, z = -.10 + .235 * t, 1.41 - .50 * t
    for offset in [-.017, .017]:
        p, record = surface(x + offset, z)
        vertices.append(p)
        weights.append(record)
    if ring:
        n = ring * 2
        faces.append((n - 2, n, n + 1, n - 1))
strap = skinned_mesh('Founder fitted survey strap', vertices, faces, weights, 'leather')
solid = strap.modifiers.new('Leather thickness', 'SOLIDIFY')
solid.thickness = .005
center, record = surface(-.095, 1.39)
center.y -= .007
vertices, faces, weights = [], [], []
for ring in range(24):
    angle = ring * math.tau / 24
    for j in range(6):
        section = j * math.tau / 6
        radius = .022 + .004 * math.cos(section)
        vertices.append(center + Vector((radius * math.cos(angle), .004 * math.sin(section), radius * math.sin(angle))))
        weights.append(record)
    for j in range(6):
        a, b = ring * 6 + j, ring * 6 + (j + 1) % 6
        faces.append((a, b, ((ring + 1) % 24) * 6 + (j + 1) % 6, ((ring + 1) % 24) * 6 + j))
skinned_mesh('Founder bronze cloak clasp', vertices, faces, weights, 'metal')


def rotate_to(bone, child, target):
    before = (child.head - bone.head).normalized()
    after = (target - bone.head).normalized()
    turn = before.rotation_difference(after)
    matrix = (turn @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
    matrix.translation = bone.head
    bone.matrix = matrix
    update()


def solve_leg(side, target):
    hip, knee, foot = [rig.pose.bones[f'{name}.{side}'] for name in ['upperleg', 'lowerleg', 'foot']]
    a, b, c = [bone.head.copy() for bone in [hip, knee, foot]]
    upper, lower = (b - a).length, (c - b).length
    distance = (target - a).length
    assert distance < upper + lower, f'Unreachable {side} ankle {distance} / {upper + lower}'
    axis = (target - a).normalized()
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    pole = Vector((0, -1, 0))
    pole = (pole - axis * pole.dot(axis)).normalized()
    goal = a + axis * along + pole * math.sqrt(max(0, upper * upper - along * along))
    rotate_to(hip, knee, goal)
    rotate_to(knee, foot, target)


def solve_arm(side, target):
    shoulder, elbow, wrist = [rig.pose.bones[f'{name}.{side}'] for name in ['upperarm', 'lowerarm', 'wrist']]
    a, b, c = [bone.head.copy() for bone in [shoulder, elbow, wrist]]
    upper, lower, distance = (b - a).length, (c - b).length, (target - a).length
    assert distance < upper + lower, f'Unreachable {side} wrist {distance} / {upper + lower}'
    axis = (target - a).normalized()
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    pole = Vector((1 if side == 'l' else -1, 0, -.65))
    pole = (pole - axis * pole.dot(axis)).normalized()
    goal = a + axis * along + pole * math.sqrt(max(0, upper * upper - along * along))
    rotate_to(shoulder, elbow, goal)
    # Match the sleeve's existing elbow plane before flexing its hinge.
    axis = (elbow.head - shoulder.head).normalized()
    current, desired = wrist.head - elbow.head, target - elbow.head
    current = (current - axis * current.dot(axis)).normalized()
    desired = (desired - axis * desired.dot(axis)).normalized()
    swivel = math.atan2(axis.dot(current.cross(desired)), current.dot(desired))
    matrix = (Quaternion(axis, swivel) @ shoulder.matrix.to_quaternion()).to_matrix().to_4x4()
    matrix.translation = shoulder.head
    shoulder.matrix = matrix
    update()
    rotate_to(elbow, wrist, target)


def smooth(a, b, phase):
    t = max(0, min(1, (phase - a) / (b - a)))
    return t * t * (3 - 2 * t)


report = {'profile': 'adult-traveler-v1', 'actions': {}}
for old_action, samples, markers in library:
    clip_name = old_action.name
    old_action.name += ' - pre anatomy'
    action = bpy.data.actions.new(clip_name)
    action.use_fake_user = True
    for key in ['realm_id', 'realm_duration', 'realm_frames']:
        action[key] = old_action[key]
    rig.animation_data.action = action
    previous = {}
    max_ankle_error = 0
    for f, sample in enumerate(samples):
        scene.frame_set(f + 1)
        for bone in ordered:
            bone.matrix_basis = Matrix.Identity(4)
        update()
        for bone in ordered:
            original = sample[bone.name]
            target = original.to_quaternion().to_matrix().to_4x4()
            if bone.name == 'root':
                target.translation = original.translation
            elif bone.name == 'hips':
                target.translation = original.translation + hip_offset
                target.translation.x *= .80
            else:
                inherited = bone.parent.matrix @ new_rest[bone.parent.name].inverted() @ new_rest[bone.name]
                target.translation = inherited.translation
            bone.rotation_mode = 'QUATERNION'
            bone.matrix = target
            update()
        phase = (f / old_action['realm_frames']) % 1
        action_id = old_action['realm_id']
        reach = (smooth(.025, .34, phase) * (1 - smooth(.66, .94, phase))
                 if action_id in ['point', 'beckon'] else 0)
        for side, sign in [('l', 1), ('r', -1)]:
            wrist = rig.pose.bones[f'wrist.{side}']
            posed = wrist.head.copy()
            hip_motion = rig.pose.bones['hips'].head - new_rest['hips'].translation
            target = Vector((sign * .32 + hip_motion.x, -.035, .93 + hip_motion.z))
            if action_id == 'walk':
                target.y += sign * .10 * math.cos(phase * math.tau)
            weight = reach if side == 'r' else 0
            target = target.lerp(posed, weight)
            solve_arm(side, target)
            for name in ['wrist', 'hand']:
                bone = rig.pose.bones[f'{name}.{side}']
                bone.matrix_basis = Matrix.Identity(4)
                update()
                if action_id == 'beckon' and side == 'r':
                    rotation = bone.matrix.to_quaternion().slerp(sample[bone.name].to_quaternion(), weight)
                    matrix = rotation.to_matrix().to_4x4()
                    matrix.translation = bone.head
                    bone.matrix = matrix
                    update()
        for side in ['l', 'r']:
            target = sample[f'foot.{side}'].translation.copy()
            target.x *= .80
            solve_leg(side, target)
            foot = rig.pose.bones[f'foot.{side}']
            name = f'foot.{side}'
            # Shortening the boot changes its diagonal ankle-to-toe rest axis.
            # Retarget the rotation delta, not the old absolute bone rotation,
            # so the newly proportioned sole stays level in contact.
            sole_rotation = sample[name].to_quaternion() @ rest[name].to_quaternion().inverted() @ new_rest[name].to_quaternion()
            sole = sole_rotation.to_matrix().to_4x4()
            sole.translation = foot.head
            foot.matrix = sole
            update()
            toe = rig.pose.bones[f'toes.{side}']
            level = sample[f'toes.{side}'].to_quaternion().to_matrix().to_4x4()
            level.translation = toe.head
            toe.matrix = level
            update()
            max_ankle_error = max(max_ankle_error, (foot.head - target).length)
        for bone in ordered:
            if bone.name in previous:
                bone.rotation_quaternion.make_compatible(previous[bone.name])
            previous[bone.name] = bone.rotation_quaternion.copy()
            for path in ['location', 'rotation_quaternion', 'scale']:
                bone.keyframe_insert(data_path=path, frame=f + 1, group=bone.name)
    action.use_frame_range = True
    action.frame_start, action.frame_end = 1, action['realm_frames'] + 1
    for name, frame in markers:
        marker = action.pose_markers.new(name)
        marker.frame = frame
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'
    report['actions'][action['realm_id']] = {'frames': len(samples), 'maxAnkleError': max_ankle_error}
    assert max_ankle_error < 2e-6, report
    bpy.data.actions.remove(old_action)

rig['realm_anatomy'] = report['profile']
scene['Realm anatomy'] = 'Adult proportions; retargeted saved gestures; original ankle trajectories and level soles'
rig.animation_data.action = next(a for a in bpy.data.actions if a.get('realm_id') == 'idle')
rig.animation_data.action_slot = slot(rig.animation_data.action)
scene.frame_start, scene.frame_end = 1, 48
scene.frame_set(1)
update()
readme = bpy.data.texts.get('START HERE - Founder actions')
if readme:
    readme.write('\nADULT TRAVELER PROPORTIONS\nMesh and bind joints reshaped together; new continuous sleeves, fitted strap and bronze clasp.\nThe four actions were retargeted. Feet retain the original trajectories and level soles.\nThe pre-anatomy source is preserved in founder-actions-before-anatomy.blend.\nUse the normal saved-scene rebuild after edits; do not rerun refine_anatomy.py over this file.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
destination.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
print('Staged editable Founder:', destination)
