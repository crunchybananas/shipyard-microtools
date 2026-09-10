"""Package rendered cells into a compact animated eight-view review proof."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/sprites/founder'
atlas=Image.open(OUT/'walk-128.png').convert('RGBA')
names=['South','Southeast','East','Northeast','North','Northwest','West','Southwest']
order=[4,3,2,1,0,7,6,5]
try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',14)
except OSError:font=ImageFont.load_default()
frames=[]
for frame in range(24):
    canvas=Image.new('RGBA',(576,392),'#293c40')
    draw=ImageDraw.Draw(canvas)
    for slot,row in enumerate(order):
        x=(slot%4)*144+8;y=(slot//4)*196
        draw.ellipse((x+40,y+143,x+88,y+157),fill='#203438')
        cell=atlas.crop((frame*128,row*168,(frame+1)*128,(row+1)*168))
        canvas.alpha_composite(cell,(x,y))
        label=names[row]
        draw.text((x+64,y+177),label,font=font,fill='#dce5d9',anchor='mm')
    frames.append(canvas.convert('RGB'))
palette=frames[0].quantize(colors=256)
quantized=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
durations=[(round((i+1)*106.666672/24)-round(i*106.666672/24))*10 for i in range(24)]
quantized[0].save(OUT/'eight-directions.gif',save_all=True,append_images=quantized[1:],duration=durations,loop=0,optimize=False,disposal=2)
print(OUT/'eight-directions.gif')

# The two command gestures share a 3.2-second loop, so the GIF closes cleanly.
import json
manifest=json.loads((OUT/'manifest.json').read_text())
actions=manifest['actions']
ids=['point','beckon']
labels=['Work over there','Come with me']
atlases={id:Image.open(OUT/f'{id}-192.png').convert('RGBA') for id in ids}
frames=[]
for tick in range(48):
    canvas=Image.new('RGBA',(416,328),'#293c40');draw=ImageDraw.Draw(canvas)
    for col,(id,label) in enumerate(zip(ids,labels)):
        action=actions[id];phase=((tick/15)/action['duration'])%1;f=int(phase*action['frames'])
        row=1 # the same southeast view for an honest silhouette comparison
        cell=atlases[id].crop((f*192,row*252,(f+1)*192,(row+1)*252))
        x=col*208+8;y=18
        draw.ellipse((x+60,y+211,x+132,y+229),fill='#203438')
        canvas.alpha_composite(cell,(x,y))
        draw.text((x+96,286),label,font=font,fill='#ead8a8',anchor='mm')
        beat=next((name for frame,name in reversed(action['beats']) if f>=frame),action['beats'][0][1])
        draw.text((x+96,308),beat,font=font,fill='#bdccc1',anchor='mm')
    frames.append(canvas.convert('RGB'))
palette=frames[18].quantize(colors=256)
quantized=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
quantized[0].save(OUT/'founder-actions.gif',save_all=True,append_images=quantized[1:],duration=[(round((i+1)*100/15)-round(i*100/15))*10 for i in range(48)],loop=0,optimize=False,disposal=2)
print(OUT/'founder-actions.gif')
