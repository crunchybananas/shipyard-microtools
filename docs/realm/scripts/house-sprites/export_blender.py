"""Export the saved architectural library without regenerating its geometry."""
import argparse
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--out',default='tmp/house-sprites/houses-213')
parser.add_argument('--witness-only',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
destination=ROOT/args.out;destination.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
assert scene.get('realm_architecture')=='carpentered-homes-v1'
roots=[o for o in scene.objects if 'realm_home' in o]
assert len(roots)==12
report={'profile':scene['realm_architecture'],'steps':json.loads(scene['realm_step_names']),'homes':[]}
depsgraph=bpy.context.evaluated_depsgraph_get()
for o in scene.objects:
    o.select_set(False)
for root in roots:
    root.select_set(True)
    parts=[]
    inverse=root.matrix_world.inverted()
    for obj in root.children:
        if obj.type!='MESH':continue
        obj.hide_set(False);obj.hide_viewport=False;obj.hide_render=False;obj.select_set(True)
        start,end=obj['realm_start'],obj['realm_end']
        assert 0<=start<end<=16,(obj.name,start,end)
        evaluated=obj.evaluated_get(depsgraph)
        evaluated_mesh=evaluated.to_mesh()
        points=[inverse @ obj.matrix_world @ vertex.co for vertex in evaluated_mesh.vertices]
        # glTF uses Y up: preserve an independent source-space witness after
        # the standard Blender-to-glTF axis conversion, before any renderer.
        converted=[(p.x,p.z,-p.y) for p in points]
        parts.append({'name':obj.name,'start':start,'end':end,'vertices':len(obj.data.vertices),
                      'light':bool(obj.get('realm_light')),
                      'bounds':{'min':[min(p[a] for p in converted) for a in range(3)],
                                'max':[max(p[a] for p in converted) for a in range(3)]}})
        evaluated.to_mesh_clear()
    stages=[]
    for step in range(16):
        installed=[p for p in parts if p['start']<=step<p['end']]
        stages.append({'step':step,'parts':len(installed),
                       'bounds':{'min':[min(p['bounds']['min'][a] for p in installed) for a in range(3)],
                                 'max':[max(p['bounds']['max'][a] for p in installed) for a in range(3)]}})
    report['homes'].append({'name':root.name,'variant':root['realm_home'],'tier':root['realm_tier'],
                            'dimensions':json.loads(root['realm_dimensions']),'parts':parts,'stages':stages})
bpy.context.view_layer.update()
if not args.witness_only:
    bpy.ops.export_scene.gltf(filepath=str(destination/'homes.glb'),export_format='GLB',
                              use_selection=True,export_extras=True,export_animations=False,export_apply=True)
(destination/'source.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'homes':len(roots),'parts':sum(len(h['parts']) for h in report['homes']),
                  'output':str(destination/'homes.glb')}))
