"""Read the saved Blender source without changing it."""
import json
from pathlib import Path
import bpy
from mathutils import Matrix

root = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
objects = []
for obj in scene.objects:
    if obj.type != 'MESH':
        continue
    parent = obj.parent
    while parent and parent != rig:
        parent = parent.parent
    if parent != rig and not any(m.type == 'ARMATURE' and m.object == rig for m in obj.modifiers):
        continue
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    objects.append({'name': obj.name, 'vertices': len(points), 'faces': len(obj.data.polygons),
        'bounds': [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)],
        'parent': obj.parent.name if obj.parent else None, 'parentBone': obj.parent_bone,
        'materials': [m.name for m in obj.data.materials],
        'groups': [g.name for g in obj.vertex_groups],
        'matrix': [list(row) for row in obj.matrix_world]})
report = {'rig': rig.name, 'profile': rig.get('realm_anatomy'), 'objects': objects,
    'bones': {b.name: {'head': list(b.head_local), 'tail': list(b.tail_local),
                      'matrix': [list(row) for row in b.matrix_local]} for b in rig.data.bones},
    'actions': [{k: a[k] for k in a.keys() if k.startswith('realm_')} | {'name': a.name} for a in bpy.data.actions if 'realm_id' in a],
    'images': [{'name': i.name, 'size': list(i.size), 'path': i.filepath} for i in bpy.data.images]}
destination = root / 'tmp/citizen-sprites/source-inspection.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'rig': report['rig'], 'objects': objects, 'actions': report['actions'], 'images': report['images']}, indent=2))
