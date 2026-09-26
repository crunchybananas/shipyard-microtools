"""Original bird rig and working-boat assets. Separate Blender background process.
Game coordinates: metres, Y-up, bird faces +Z. All birds share one skin/material.
The .blend preserves the armature and authored pose actions; runtime steers bones.
"""
import bpy, bmesh, math, json, random
from pathlib import Path
from mathutils import Vector
SRC=Path(__file__).resolve().parent;ROOT=SRC.parents[1]
scene=bpy.data.scenes.new('Island living assets');bpy.context.window.scene=scene
DATA={};ACTIVE='gull';SPECIES='gull'
def coord(p):return (p[0],-p[2],p[1])
PAL={'white':(.70,.72,.68,1),'mantle':(.27,.32,.34,1),'tip':(.023,.031,.039,1),'beak':(.60,.37,.047,1),'foot':(.46,.30,.11,1),'eye':(.006,.008,.009,1),'iris':(.43,.34,.12,1),'shine':(.75,.81,.78,1),'red':(.33,.058,.022,1),'crow':(.027,.038,.052,1),'crowwing':(.015,.023,.034,1),'wood':(.35,.28,.19,1),'edge':(.45,.39,.29,1),'songbreast':(.40,.20,.068,1),'songslate':(.06,.115,.17,1),'songdark':(.026,.044,.068,1),'iron':(.07,.087,.082,1)}
def add(v,f,color,bone='body',smooth=True):
    d=DATA.setdefault(ACTIVE,{'v':[],'f':[],'c':[],'b':[],'s':[]})
    k=len(d['v']);d['v'] += [coord(p) for p in v];d['f'] += [tuple(k+i for i in q) for q in f]
    c=PAL.get(color,color);d['c'] += [c]*len(v);d['b'] += [bone]*len(v);d['s'] += [smooth]*len(f)
def ell(p,r,color,bone='body',n=12,rings=7):
    v=[];f=[]
    for i in range(rings+1):
        t=math.pi*i/rings
        for j in range(n):
            a=j*math.tau/n;v.append((p[0]+r[0]*math.sin(t)*math.cos(a),p[1]+r[1]*math.cos(t),p[2]+r[2]*math.sin(t)*math.sin(a)))
    for i in range(rings):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
    add(v,f,color,bone)
def tube(points,r,color,bone='body',n=6):
    v=[];f=[]
    for i,p in enumerate(points):
        d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);d.normalize();u=d.cross(Vector((0,1,0)))
        if u.length<.01:u=d.cross(Vector((1,0,0)))
        u.normalize();w=d.cross(u).normalized();rr=r[i] if isinstance(r,list) else r
        for j in range(n):a=j*math.tau/n;v.append(tuple(Vector(p)+rr*(u*math.cos(a)+w*math.sin(a))))
    for i in range(len(points)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
    f.extend([tuple(range(n-1,-1,-1)),tuple((len(points)-1)*n+j for j in range(n))]);add(v,f,color,bone)
def feather(a,b,width,color,bone):
    a,b=Vector(a),Vector(b);d=b-a;side=d.cross(Vector((0,1,0))).normalized();v=[]
    # A convex lens in section with a rounded taper and a fine central ridge.
    for t,w in [(0,.32),(.35,1),(.79,.68),(1,.06)]:
        p=a+d*t
        for s,h in [(-1,0),(0,.009),(1,0),(0,-.003)]:v.append(tuple(p+side*width*w*s+Vector((0,h,0))))
    f=[]
    for i in range(3):
        for j in range(4):a0=i*4+j;b0=i*4+(j+1)%4;f.append((a0,b0,b0+4,a0+4))
    f.extend([(3,2,1,0),(12,13,14,15)]);add(v,f,color,bone)

def bird(species):
    global ACTIVE,SPECIES
    ACTIVE=species;SPECIES=species;crow=species=='crow';song=species=='songbird'
    white='crow' if crow else 'songbreast' if song else 'white';mantle='crowwing' if crow else 'songslate' if song else 'mantle';tip='crowwing' if crow else 'songdark' if song else 'tip'
    n=18;v=[];f=[]
    # Continuous pear-shaped torso, narrowing into the neck instead of stacked balls.
    rings=[(.13,.052,.07,-.13),(.20,.125,.17,-.24),(.28,.148,.20,-.285),(.35,.13,.18,-.25),(.405,.075,.195,-.095),(.45,.051,.225,.095)]
    for y,rx,front,back in rings:
        for j in range(n):
            a=j*math.tau/n;v.append((rx*math.cos(a),y,(front+back)/2+math.sin(a)*(front-back)/2))
    for i in range(len(rings)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
    f.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]);add(v,f,white)
    # Skin weights blend the upper neck into the head joint.
    dd=DATA[ACTIVE]
    for i,p in enumerate(v):
        if p[1]>.395:dd['b'][i]={'body':max(0,1-(p[1]-.395)/.055),'head':min(1,(p[1]-.395)/.055)}
        if p[2]<-.08 and p[1]>.26:dd['c'][i]=PAL[mantle]
    ell((0,.473,.205),(.083,.085,.102),'songslate' if song else white,'head',16,9)
    # Tapered upper mandible with nostrils, hooked tip and a separate lower jaw.
    length=.14 if crow else .082 if song else .115;bc='songdark' if song else 'crowwing' if crow else 'beak'
    tube([(0,.455,.279),(0,.456,.33),(0,.438,.279+length)],[.020,.016,.003],bc,'head',7)
    tube([(0,.441,.282),(0,.439,.326),(0,.435,.27+length)],[.012,.010,.002],bc,'jaw',6)
    for side in [-1,1]:
        ell((side*.074,.488,.248),(.008,.010,.012),'crowwing' if crow or song else 'iris','eyes',10,6)
        ell((side*.082,.489,.252),(.003,.0065,.0075),'eye','eyes',8,5)
        ell((side*.085,.493,.256),(.0015,.002,.002),'shine','eyes',6,4)
        ell((side*.020,.462,.329),(.0025,.003,.008),'tip','head',6,4)
        if not crow and not song:ell((side*.008,.434,.358),(.002,.003,.007),'red','jaw',6,4)
    # Tail feathers fan from the rump, carrying different lengths and fine seams.
    for j in range(7):
        x=(j-3)*.018
        feather((x,.265,-.21),(x*1.6,.205,-(.55 if crow else .465)+abs(j-3)*.012),.019,tip if crow else mantle,'tail')
    for side in [-1,1]:
        wing='wingL' if side<0 else 'wingR';hand='handL' if side<0 else 'handR'
        # Continuous closed wing cover; real shoulder, elbow and swept wrist.
        stations=[(.065,.325,.055,.15),(.23,.33,.06,.16),(.39,.34,-.015,.13),(.56,.335,-.08,.085),(.72,.31,-.19,.01)]
        v=[];f=[]
        for x,y,z,w in stations:
            v += [(side*x,y,z+w),(side*x,y+.018,z),(side*x,y,z-w),(side*x,y-.008,z)]
        for i in range(4):
            for j in range(4):a=i*4+j;b=i*4+(j+1)%4;f.append((a,b,b+4,a+4))
        f.extend([(3,2,1,0),(16,17,18,19)]);add(v,f,mantle,wing)
        dd=DATA[ACTIVE]
        for i in range(8,20):
            w=max(0,min(1,(abs(v[i][0])-.34)/.19));dd['b'][-20+i]={wing:1-w,hand:w}
        for j in range(8):
            u=j/7;x=.14+u*.38
            feather((side*x,.342,.06-u*.08),(side*(x+.035),.317,-.19-u*.13),.030,mantle,wing if j<5 else hand)
        for j in range(7):
            u=j/6;x=.40+u*.27
            feather((side*x,.335,-.018-u*.12),(side*(.59+u*.19),.296,-.34-u*.075),.026,tip,hand)
            if not crow and not song and j>3:ell((side*(.57+u*.19),.301,-.317-u*.075),(.017,.002,.007),'white',hand,6,3)
        # Ankles and webbed toes are weighted to separate planted-foot joints.
        foot='footL' if side<0 else 'footR';x=side*.057;fc='crowwing' if crow else 'foot'
        tube([(x,.18,.008),(x,.085,.014),(x,.022,.038)],[.011,.008,.008],fc,foot,6)
        for j in [-1,0,1]:
            tube([(x,.018,.033),(x+j*.019,.010,.083),(x+j*.036,.007,.13-abs(j)*.014)],[.008,.006,.0027],fc,foot,5)
        if not crow and not song:
            add([(x-.032,.011,.11),(x,.012,.041),(x+.032,.011,.11),(x,.009,.132)],[(0,1,3),(1,2,3)],fc,foot)
        else:tube([(x,.015,.04),(x,.010,-.016)],.004,fc,foot,5)

bird('gull');bird('crow');bird('songbird')
# The source armature has anatomical pivots, all axes aligned in game space.
arm=bpy.data.armatures.new('Coastal bird skeleton');rig=bpy.data.objects.new('BirdRig',arm);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
assert 'EDIT' in [x.identifier for x in bpy.ops.object.mode_set.get_rna_type().properties['mode'].enum_items]
bpy.ops.object.mode_set(mode='EDIT')
joints={'root':((0,0,0),None),'body':((0,.25,0),'root'),'head':((0,.397,.15),'body'),'jaw':((0,.443,.282),'head'),'eyes':((0,.489,.25),'head'),'tail':((0,.26,-.21),'body'),'wingL':((-.065,.325,.045),'body'),'wingR':((.065,.325,.045),'body'),'handL':((-.38,.337,-.03),'wingL'),'handR':((.38,.337,-.03),'wingR'),'footL':((-.057,.085,.014),'root'),'footR':((.057,.085,.014),'root')}
for name,(p,parent) in joints.items():
    b=arm.edit_bones.new(name);b.head=coord(p);b.tail=coord((p[0],p[1]+.075,p[2]));b.roll=0
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

# Boat: seven lapped strakes each side, an open interior, thwarts, ribs and keel.
ACTIVE='doryCraft'
N=24
def hull(t,h,side):
    z=(t-.5)*3.1;profile=max(.002,math.sin(math.pi*t))**.63
    width=(.19+.46*h)*profile
    return (side*width,-.26+h*.58+.12*(abs(t-.5)*2)**3,z)
for side in [-1,1]:
    for k in range(7):
        v=[];f=[];lo=k/7;hi=(k+1)/7+.012
        for i in range(N+1):
            t=i/N
            for h,offset in [(lo,0),(hi,0),(hi,-.027),(lo,-.027)]:
                x,y,z=hull(t,h,side);v.append((x+side*offset,y,z))
        for i in range(N):
            for j in range(4):a=i*4+j;b=i*4+(j+1)%4;f.append((a,b,b+4,a+4))
        f += [(3,2,1,0),tuple(N*4+j for j in range(4))]
        c=tuple(v*(.94+k*.019) for v in PAL['wood'][:3])+(1,);add(v,f,c,None)
    tube([hull(i/N,1.02,side) for i in range(N+1)],.035,'edge',None,7)
# Four fitted bottom boards close the hull below the ribs; narrow seams remain.
for strip in range(4):
    v=[];f=[]
    for i in range(N+1):
        t=i/N;w=hull(t,0,1)[0];z=(t-.5)*3.1;y=hull(t,0,1)[1]+.024
        a=-1+strip*.5+.018;b=-1+(strip+1)*.5-.018
        v += [(w*a,y,z),(w*b,y,z),(w*b,y-.023,z),(w*a,y-.023,z)]
    for i in range(N):
        for j in range(4):a=i*4+j;b=i*4+(j+1)%4;f.append((a,b,b+4,a+4))
    f += [(3,2,1,0),tuple(N*4+j for j in range(4))];add(v,f,'wood',None)
for t in [0,1]:
    tube([(0,hull(t,h,1)[1],(t-.5)*3.1) for h in [0,.35,.7,1.04]],.028,'edge',None,7)
for t in [.17,.3,.43,.57,.7,.83]:
    points=[hull(t,h,-1) for h in [1,.7,.35,0]]+[hull(t,h,1) for h in [0,.35,.7,1]]
    tube(points,.028,'edge',None,5)
for z in [-.65,.63]:
    t=z/3.1+.5;w=hull(t,.78,1)[0]
    tube([(-w,.175,z),(w,.175,z)],.064,'edge',None,4)
tube([(0,-.255,-1.48),(0,-.275,0),(0,-.255,1.48)],.043,'iron',None,6)
ACTIVE='doryOarCraft'
tube([(0,-1.23,0),(0,.82,0)],[.021,.028],'wood',None,7)
# Blade aligned with the old Cylinder's local Y so its existing prop pose survives.
add([(-.027,.71,-.012),(.027,.71,-.012),(.12,1.15,-.017),(.105,1.30,-.017),(-.105,1.30,-.017),(-.12,1.15,-.017),(-.027,.71,.012),(.027,.71,.012),(.12,1.15,.017),(.105,1.30,.017),(-.105,1.30,.017),(-.12,1.15,.017)],[(0,5,4,3,2,1),(6,7,8,9,10,11)]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],'edge',None)

# Authored standing figures: asymmetrical weight, sleeves, hands and human head scale.
PAL.update({'oilskin':(.055,.085,.088,1),'oilskinFold':(.038,.058,.06,1),'hoodVoid':(.005,.009,.013,1),'hand':(.145,.17,.16,1),'boot':(.023,.032,.033,1),'eyeLight':(.34,.49,.45,1)})
def coastalFigure(name,hooded):
    global ACTIVE;ACTIVE=name
    rings=[(.12,.29,.16),(.31,.30,.17),(.61,.245,.145),(.94,.21,.13),(1.19,.23,.135),(1.37,.27,.14),(1.46,.11,.083)]
    v=[];f=[];N=24
    for j,(y,rx,rz) in enumerate(rings):
        for i in range(N):
            a=i*math.tau/N;fold=1+.045*math.sin(a*7+j*.23)+.024*math.sin(a*13-j*.31)
            xx=.027*math.sin(j*.45)+math.cos(a)*rx*fold
            yy=y+(.026*math.sin(a*5+.7) if j==0 else 0)
            zz=math.sin(a)*rz*fold+.025*(j/6)
            v.append((xx,yy,zz))
    for j in range(len(rings)-1):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
    f += [tuple(range(N-1,-1,-1)),tuple((len(rings)-1)*N+i for i in range(N))]
    add(v,f,'oilskin',None)
    # A front overlap and stitched hem express the weight of the coat.
    tube([(.038,.13,.167),(.053,.61,.16),(.035,.94,.146),(.025,1.36,.166)],[.012,.012,.010,.008],'oilskinFold',None,5)
    for side in [-1,1]:
        shoulder=(side*.225,1.32,.015);elbow=(side*.305,1.08,.012);wrist=(side*(.225 if hooded else .255),.87,.145)
        tube([shoulder,elbow,wrist],[.105,.085,.056],'oilskin',None,10)
        ell((wrist[0],.815,.158),(.049,.087,.037),'hand',None,10,7)
        for k in range(3):
            tube([(wrist[0]+(k-1)*.019,.823,.19),(wrist[0]+(k-1)*.017,.762,.19)],[.007,.0045],'oilskinFold',None,5)
        ell((side*.115,.07,.045+(side>0)*.025),(.079,.065,.164),'boot',None,12,7)
    tube([(.02,1.39,.02),(.025,1.51,.05)],[.075,.073],'hand',None,12)
    if hooded:
        ell((.024,1.595,.046),(.162,.205,.148),'oilskin',None,20,12)
        ell((.024,1.58,.174),(.104,.141,.022),'hoodVoid',None,18,10)
        pts=[(.024+math.sin(a)*.112,1.58+math.cos(a)*.148,.179-.016*abs(math.sin(a))) for a in [i*math.tau/32 for i in range(33)]]
        tube(pts,.012,'oilskinFold',None,6)
        for side in [-1,1]:ell((.024+side*.041,1.607,.196),(.009,.004,.004),'eyeLight',None,6,4)
    else:
        ell((.024,1.592,.055),(.109,.145,.105),'hand',None,18,10)
        ell((.024,1.64,.02),(.113,.103,.107),'oilskinFold',None,18,8)
        # A quiet face plane and nose read as a person without a bright mask.
        ell((.024,1.585,.155),(.025,.045,.019),'hand',None,10,6)
coastalFigure('watcherCraft',True)
coastalFigure('tideFigureCraft',False)

# The lower hand: a small work-worn person, independently articulated. Authored
# at human scale; runtime exaggerates it only inside the 1:240 model for legibility.
ACTIVE='keeperCraft'
PAL.update({'keeperCoat':(.21,.31,.29,1),'keeperFold':(.13,.21,.20,1),'keeperSkin':(.55,.46,.32,1),'keeperHair':(.14,.15,.12,1)})
v=[];f=[];N=16
for j,(y,rx,rz) in enumerate([(.48,.21,.135),(.75,.19,.135),(1.02,.18,.125),(1.26,.22,.13),(1.39,.19,.105),(1.44,.08,.065)]):
    for i in range(N):
        a=i*math.tau/N;fold=1+.04*math.sin(a*7+j*.31)
        v.append((math.cos(a)*rx*fold,y,math.sin(a)*rz*fold))
for j in range(5):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
f.extend([tuple(range(N-1,-1,-1)),tuple(5*N+i for i in range(N))]);add(v,f,'keeperCoat','keeperRoot')
for side in [-1,1]:
    x=.105*side;tube([(x,.07,0),(x,.48,0),(x,.66,0)],[.062,.071,.074],'keeperFold','keeperRoot',8)
    ell((x,.052,.045),(.069,.052,.13),'boot','keeperRoot',12,6)
# Collar and a cap shade the face without assigning a particular identity.
ell((0,1.435,0),(.090,.037,.084),'keeperFold','keeperRoot',12,6)
ell((0,1.545,.012),(.092,.124,.096),'keeperSkin','keeperHead',16,8)
ell((0,1.606,-.005),(.10,.076,.103),'keeperHair','keeperHead',16,6)
ell((0,1.637,.06),(.12,.022,.12),'keeperCoat','keeperHead',12,5)
ell((0,1.54,.108),(.021,.036,.026),'keeperSkin','keeperHead',8,5)
for side in [-1,1]:
    suffix='L' if side<0 else 'R';upper='keeperUpper'+suffix;lower='keeperFore'+suffix;hand='keeperPalm'+suffix
    shoulder=(side*.20,1.33,0);elbow=(side*.255,1.065,.085);wrist=(side*.205,.93,.38)
    tube([shoulder,elbow],[.080,.066],'keeperCoat',upper,10)
    ell(elbow,(.068,.071,.068),'keeperFold',lower,10,6)
    tube([elbow,wrist],[.064,.046],'keeperCoat',lower,10)
    ell((side*.205,.901,.45),(.048,.019,.080),'keeperSkin',hand,12,6)
    # Thumb separated from palm so even the source silhouette is a hand.
    ell((side*.162,.903,.422),(.022,.018,.038),'keeperSkin',hand,8,5)
# A worktable with a worn board top and a shallow empty work surface.
ACTIVE='keeperBenchCraft'
def keeperBox(p,size,color):
    x,y,z=p;w,h,d=[v/2 for v in size]
    v=[(x+a,y+b,z+c) for a,b,c in [(-w,-h,-d),(w,-h,-d),(w,h,-d),(-w,h,-d),(-w,-h,d),(w,-h,d),(w,h,d),(-w,h,d)]]
    add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],color,None,False)
for z in [.29,.45,.61]:keeperBox((0,.859,z),(.85,.042,.154),'wood')
for x in [-.34,.34]:
    for z in [.31,.59]:keeperBox((x,.421,z),(.043,.842,.045),'edge')
keeperBox((0,.25,.45),(.72,.035,.035),'wood')
keeperBox((0,.783,.45),(.80,.08,.30),'wood')
# Named pivots and bind-pose palms are useful in source inspection and contact tests.
keeperJoints={'keeperRoot':((0,0,0),None),'keeperHead':((0,1.435,0),'keeperRoot')}
for side in [-1,1]:
    suffix='L' if side<0 else 'R'
    keeperJoints['keeperUpper'+suffix]=((side*.20,1.33,0),'keeperRoot')
    keeperJoints['keeperFore'+suffix]=((side*.255,1.065,.085),'keeperUpper'+suffix)
    keeperJoints['keeperPalm'+suffix]=((side*.205,.93,.38),'keeperFore'+suffix)
ka=bpy.data.armatures.new('Lower keeper skeleton');keeperRig=bpy.data.objects.new('KeeperRig',ka);scene.collection.objects.link(keeperRig)
bpy.ops.object.select_all(action='DESELECT');keeperRig.select_set(True);bpy.context.view_layer.objects.active=keeperRig;bpy.ops.object.mode_set(mode='EDIT')
for name,(p,parent) in keeperJoints.items():
    b=ka.edit_bones.new(name);b.head=coord(p);b.tail=coord((p[0],p[1]+.075,p[2]))
    if parent:b.parent=ka.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

mat=bpy.data.materials.new('Coastal life vertex palette');mat.use_nodes=True
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Roughness'].default_value=.8
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
objects=[];stats={}
for name,d in DATA.items():
    me=bpy.data.meshes.new(name);me.from_pydata(d['v'],[],d['f']);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);me.materials.append(mat)
    attr=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for a,c in zip(attr.data,d['c']):a.color=c
    for p,s in zip(me.polygons,d['s']):p.use_smooth=s
    uv=me.uv_layers.new(name='Grain')
    for p in me.polygons:
        for li in p.loop_indices:
            pt=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(pt.x*.7,pt.y*.7+pt.z*.1)
    if name in ['gull','crow','songbird','keeperCraft']:
        skinRig,skinJoints=(keeperRig,keeperJoints) if name=='keeperCraft' else (rig,joints)
        o.parent=skinRig
        for bone in skinJoints:o.vertex_groups.new(name=bone)
        for i,weights in enumerate(d['b']):
            weights={weights:1} if isinstance(weights,str) else weights
            for bone,w in weights.items():
                if w>0:o.vertex_groups[bone].add([i],w,'REPLACE')
        mod=o.modifiers.new('Anatomical rig','ARMATURE');mod.object=skinRig
    o['authoring']='Blender island_life.py';me.calc_loop_triangles();stats[name]={'triangles':len(me.loop_triangles),'vertices':len(me.vertices),'skinned':name in ['gull','crow','songbird','keeperCraft']};objects.append(o)
# Keep close anatomy, but do not spend it on a bird only a few pixels wide.
for name in ['gull','crow','songbird']:
    original=bpy.data.objects[name];low=original.copy();low.data=original.data.copy();low.name=name+'Far';scene.collection.objects.link(low)
    low.modifiers.clear();bpy.context.view_layer.objects.active=low
    for o in bpy.context.selected_objects:o.select_set(False)
    low.select_set(True);dec=low.modifiers.new('Distant silhouette','DECIMATE');dec.ratio=.18
    bpy.ops.object.modifier_apply(modifier=dec.name)
    skin=low.modifiers.new('Anatomical rig','ARMATURE');skin.object=rig
    low.data.calc_loop_triangles();stats[low.name]={'triangles':len(low.data.loop_triangles),'vertices':len(low.data.vertices),'skinned':True}
    objects.append(low)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);keeperRig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/island-life.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_skins=True,export_animations=False,export_extras=True)
# Reusable authored poses remain editable in the source file.
rig.animation_data_create()
poses={'Watch':{},'Glide':{'wingL':(0,0,-.1),'wingR':(0,0,.1)},'Rest':{'wingL':(0,-1.33,-.55),'wingR':(0,1.33,.55),'handL':(0,-.18,0),'handR':(0,.18,0)},'Preen':{'head':(.22,-2.0,.16),'wingL':(0,-1.33,-.55),'wingR':(0,1.33,.55)},'Peck':{'head':(1.12,0,0),'wingL':(0,-1.33,-.55),'wingR':(0,1.33,.55)}}
for name,pose in poses.items():
    act=bpy.data.actions.new('Bird '+name);rig.animation_data.action=act
    for b in rig.pose.bones:
        b.rotation_mode='XYZ';b.rotation_euler=pose.get(b.name,(0,0,0));b.keyframe_insert(data_path='rotation_euler',frame=1)
rig.animation_data.action=bpy.data.actions.get('Bird Rest');scene.frame_set(1)
for name in ['wingL','wingR']:rig.pose.bones[name].scale=(.68,1,.63)
# Render the gull alone at a real, useful profile angle.
for name in ['gullFar','crowFar','songbirdFar']:bpy.data.objects[name].hide_render=True
bpy.data.objects['crow'].hide_render=True;bpy.data.objects['songbird'].hide_render=True
for name in ['doryCraft','doryOarCraft','watcherCraft','tideFigureCraft','keeperCraft','keeperBenchCraft']:bpy.data.objects[name].hide_render=True
world=bpy.data.worlds.new('Bird inspection');scene.world=world;world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.16,.21,.24,1);bg.inputs[1].default_value=.6
for i,(p,power,size) in enumerate([((-2,-3,4),280,3),((3,2,3),240,2)]):
    ld=bpy.data.lights.new('Softbox '+str(i),'AREA');ob=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(ob);ob.location=p;ld.energy=power;ld.size=size;ob.rotation_euler=(Vector((0,0,.3))-ob.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('Inspection');cam=bpy.data.objects.new('Inspection',camd);scene.collection.objects.link(cam);cam.location=(1.35,-1.25,.82);cam.rotation_euler=(Vector((0,0,.28))-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=1.2;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SRC/'gull-inspection.png')
stat={'blender':bpy.app.version_string,'bones':list(joints),'keeperBones':list(keeperJoints),'parts':stats,'bytes':(ROOT/'assets/island-life.glb').stat().st_size}
(SRC/'island-life-geometry.json').write_text(json.dumps(stat,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'island-life.blend'));bpy.ops.render.render(write_still=True);print(json.dumps(stat))
# Inspect the open hull from above, with the game-oriented oar beside it.
bpy.data.objects['gull'].hide_render=True;bpy.data.objects['doryCraft'].hide_render=False
cam.location=(2.7,-3.4,3.1);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=4.2
scene.render.filepath=str(SRC/'dory-inspection.png');bpy.ops.render.render(write_still=True)

# An inspection of the same exported human geometry, distinct from game staging.
bpy.data.objects['doryCraft'].hide_render=True
for name,x in [('watcherCraft',-.55),('tideFigureCraft',.55)]:
    bpy.data.objects[name].hide_render=False;bpy.data.objects[name].location.x=x
cam.location=(2.8,-5,2.4);cam.rotation_euler=(Vector((0,0,.90))-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=2.8
scene.render.filepath=str(SRC/'coastal-figures.png');bpy.ops.render.render(write_still=True)

for name in ['watcherCraft','tideFigureCraft']:bpy.data.objects[name].hide_render=True
for name in ['keeperCraft','keeperBenchCraft']:bpy.data.objects[name].hide_render=False
cam.location=(2.3,-3.2,2.1);cam.rotation_euler=(Vector((0,-.2,.85))-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=2.1
scene.render.filepath=str(SRC/'lower-keeper.png');bpy.ops.render.render(write_still=True)
