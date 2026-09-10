"""Export saved animation actions and independent Blender joint witnesses."""
import bpy,json,argparse,sys
from pathlib import Path
def skeleton_slot(action):
    handles={bag.slot_handle for layer in action.layers for strip in layer.strips for bag in strip.channelbags if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(slot for slot in action.slots if slot.handle in handles)

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='assets/sprites/founder/source/blender-actions.glb')
parser.add_argument('--witness',default='assets/sprites/founder/blender-actions-validation.json')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
actions=[a for a in bpy.data.actions if 'realm_id' in a]
assert len(actions)==4, 'Expected the four Founder actions in founder-actions.blend'
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True)
for o in scene.objects:
    if o.type!='MESH':continue
    parent=o.parent
    while parent and parent!=rig:parent=parent.parent
    if parent==rig or any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):o.select_set(True)
bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:track.mute=True
witness={}
for a in actions:
    rig.animation_data.action=a;rig.animation_data.action_slot=skeleton_slot(a)
    frames=a['realm_frames'];records=[]
    assert abs(a.frame_range[0]-1)<.001 and abs(a.frame_range[1]-(frames+1))<.001, f'{a.name}: preserve frames 1–{frames+1}'
    for frame in range(frames+1):
        scene.frame_set(frame+1);bpy.context.view_layer.update()
        joints={}
        for bone in rig.pose.bones:
            p=rig.matrix_world @ bone.head
            joints[bone.name]=[p.x,p.z,-p.y]
        records.append(joints)
    witness[a['realm_id']]={'clip':a.name,'frames':frames,'duration':a['realm_duration'],'samples':records}
    a.use_frame_range=True;a.frame_start=1;a.frame_end=frames+1
# Export at integer FPS, then normalize each action independently in Node.
scene.render.fps=24;scene.render.fps_base=1
scene.frame_start=1;scene.frame_end=49;scene.frame_set(1)
rig.animation_data.action=next(a for a in actions if a['realm_id']=='walk')
rig.animation_data.action_slot=skeleton_slot(rig.animation_data.action)
if rig.get('realm_anatomy'):
    rig.data.pose_position='REST';bpy.context.view_layer.update()
    body_points=[o.matrix_world @ v.co for o in bpy.context.selected_objects if o.type=='MESH' for v in o.data.vertices]
    head=bpy.data.objects['Cube.210']
    head_points=[head.matrix_world @ v.co for v in head.data.vertices]
    witness['anatomy']={'profile':rig['realm_anatomy'],
        'height':max(p.z for p in body_points)-min(p.z for p in body_points),
        'headHeight':max(p.z for p in head_points)-min(p.z for p in head_points),
        'headWidth':max(p.x for p in head_points)-min(p.x for p in head_points),
        'legLength':sum(rig.data.bones[f'{part}.l'].length for part in ['upperleg','lowerleg']),
        'meshes':sorted(o.name for o in bpy.context.selected_objects if o.type=='MESH')}
    rig.data.pose_position='POSE';bpy.context.view_layer.update()
destination=ROOT/args.output
destination.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',use_selection=True,export_animations=True,export_frame_range=False,export_force_sampling=True,export_animation_mode='ACTIONS',export_extras=True)
(ROOT/args.witness).write_text(json.dumps(witness)+'\n')
print(f'Exported saved Blender actions: {destination}')
