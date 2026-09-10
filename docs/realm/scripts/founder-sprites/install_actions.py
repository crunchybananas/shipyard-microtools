"""One-time addition of the approved standing study to the saved walk scene.
Preserve the existing scene and walk; write a new founder-actions.blend.
"""
import bpy, json
from pathlib import Path
def skeleton_slot(action):
    handles={bag.slot_handle for layer in action.layers for strip in layer.strips for bag in strip.channelbags if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(slot for slot in action.slots if slot.handle in handles)

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/sprites/founder'
PACK=ROOT/'tmp/founder-sprites/gesture-bootstrap'
manifest=json.loads((PACK/'manifest.json').read_text())
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
walk=rig.animation_data.action
old_objects=set(bpy.data.objects)
# Preserve the saved editor's original file. A new file owns the extended library.
bpy.ops.import_scene.gltf(filepath=str(PACK/'founder-actions.glb'))
imported_objects=set(bpy.data.objects)-old_objects
source=next(o for o in imported_objects if o.type=='ARMATURE')
imported_actions={}
for a in bpy.data.actions:
    if a==walk:continue
    for id,contract in manifest['actions'].items():
        if a.name.startswith(contract['clip']):imported_actions[id]=a
assert len(imported_actions)==4, list(imported_actions)
for obj in [rig,source]:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:track.mute=True

def curves(action):
    if hasattr(action,'fcurves'):return list(action.fcurves)
    return [f for layer in action.layers for strip in layer.strips for bag in strip.channelbags for f in bag.fcurves]

# Sample before changing any imported timeline or destination action.
pose_library={}
for id,c in manifest['actions'].items():
    action=imported_actions[id]
    source.animation_data.action=action
    if action.slots:source.animation_data.action_slot=skeleton_slot(action)
    start,end=action.frame_range
    samples=[]
    for f in range(c['frames']+1):
        t=start+(end-start)*f/c['frames']
        scene.frame_set(int(t),subframe=t-int(t));bpy.context.view_layer.update()
        samples.append({b.name:(source.matrix_world @ b.matrix).copy() for b in source.pose.bones})
    pose_library[id]=samples

ordered=sorted(rig.pose.bones,key=lambda b:len(b.parent_recursive))
for id,c in manifest['actions'].items():
    if id=='walk':
        destination=walk
    else:
        destination=bpy.data.actions.new(c['clip']+' - authored')
    destination.use_fake_user=True
    rig.animation_data.action=destination
    if destination.slots:rig.animation_data.action_slot=skeleton_slot(destination)
    for f,pose in enumerate(pose_library[id]):
        scene.frame_set(f+1);bpy.context.view_layer.update()
        targets=[b for b in ordered if b.name in ['foot.l','foot.r','toes.l','toes.r']] if id=='walk' else ordered
        for b in targets:
            matrix=rig.matrix_world.inverted() @ pose[b.name]
            if id=='walk':
                # Keep the user's hip, knee and ankle position keys. Correct
                # only each boot's orientation and its inherited toe bend.
                matrix.translation=b.matrix.translation
            b.rotation_mode='QUATERNION'
            b.matrix=matrix
            b.keyframe_insert(data_path='rotation_quaternion',frame=f+1,group=b.name)
            if id!='walk':
                b.keyframe_insert(data_path='location',frame=f+1,group=b.name)
                b.keyframe_insert(data_path='scale',frame=f+1,group=b.name)
            bpy.context.view_layer.update()
    destination['realm_id']=id;destination['realm_duration']=c['duration'];destination['realm_frames']=c['frames']
    for curve in curves(destination):
        if id=='walk' and not any(f'pose.bones["{name}"].rotation_quaternion'==curve.data_path for name in ['foot.l','foot.r','toes.l','toes.r']):continue
        for key in curve.keyframe_points:key.interpolation='LINEAR'
    for marker in list(destination.pose_markers):destination.pose_markers.remove(marker)
    for frame,label in c['beats']:
        marker=destination.pose_markers.new(label);marker.frame=frame+1
    destination.name=c['clip']

# The source actors are temporary; preserve the original rig, mesh and review set.
source.animation_data_clear()
for obj in imported_objects:bpy.data.objects.remove(obj,do_unlink=True)
for a in list(bpy.data.actions):
    if a in imported_actions.values() and a!=walk:bpy.data.actions.remove(a)
# Imported names may have temporarily forced .001 suffixes.
for a in bpy.data.actions:
    if 'realm_id' in a:a.name=manifest['actions'][a['realm_id']]['clip']
rig.animation_data.action=next(a for a in bpy.data.actions if a.get('realm_id')=='point')
rig.animation_data.action_slot=skeleton_slot(rig.animation_data.action)
scene.render.fps=15;scene.render.fps_base=1
scene.frame_start=1;scene.frame_end=48;scene.frame_set(18)
scene.timeline_markers.clear()
for frame,label in manifest['actions']['point']['beats']:
    marker=scene.timeline_markers.new(label);marker.frame=frame+1
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='DOPESHEET_EDITOR':area.spaces.active.mode='ACTION';area.spaces.active.show_region_ui=False
readme=bpy.data.texts.get('START HERE - Founder walk') or bpy.data.texts.new('START HERE - Founder actions')
readme.name='START HERE - Founder actions'
readme.clear();readme.write('FOUNDER — WALK AND STANDING ACTIONS\n\nSpace plays/pauses. The Action Editor chooses a clip.\nRealm_Grounded_Walk: frames 1–24 at 22.5 fps.\nRealm_Take_Stock: frames 1–48 at 12 fps.\nRealm_Direct_Work / Realm_Beckon: frames 1–48 at 15 fps.\nThe last extra key (25 or 49) closes the loop; exclude it from playback.\nNamed pose markers identify anticipation, indication and recovery.\n\nSave this file, then run node scripts/founder-sprites/rebuild-from-blender.mjs.\nThe browser workshop selects each action at its own exact cadence.\n\nOriginal character: Kay Lousberg / KayKit (CC0).\nRealm: toe correction, grounded legs, standing gesture choreography, eight-view bake.\nThe prior founder-walk.blend is preserved.\n')
scene['Realm actions']='walk, idle, point, beckon; editable keys and named beats'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'founder-actions.blend'))
print('Saved extended animation library:',OUT/'founder-actions.blend')
