from PIL import Image, ImageDraw, ImageFont
F="/Users/maniodubo/Documents/Apps/odubo/.claude/worktrees/loop-press/public/loop/fonts/"
SAND=(217,170,122); INK=(42,15,10)
W,H=1080,1920; SAFE_T,SAFE_B=(H-1350)//2,(H+1350)//2   # the 4:5 the grid shows
def card(name,big,title,inv=False,bigsize=560):
    bg,fg=(INK,SAND) if inv else (SAND,INK)
    im=Image.new("RGB",(W,H),bg); d=ImageDraw.Draw(im)
    fb=ImageFont.truetype(F+"Jost-700.ttf",bigsize); ft=ImageFont.truetype(F+"Jost-500.ttf",46); fs=ImageFont.truetype(F+"Jost-500.ttf",30)
    # the number, left-aligned on a margin, like a sleeve's track index
    x0=96
    bb=d.textbbox((0,0),big,font=fb); d.text((x0-bb[0],SAFE_T+120-bb[1]),big,font=fb,fill=fg)
    def tracked(y,text,font,sp):
        x=x0
        for ch in text:
            d.text((x,y),ch,font=font,fill=fg); x+=d.textlength(ch,font=font)+sp
    tracked(SAFE_B-230,title.upper(),ft,9)
    tracked(SAFE_B-140,"LOOP SOUL · SAT OCT 10 · SCOTT'S",fs,7)
    im.save(f"covers/{name}.png")
cards=[("00-film","film","You can't hear this yet",False,300),("01","01","Welcome",False,560),("03","03","Hallucinogen",False,560),("05","05","In The Court",False,560),
("06","06","News Peak",False,560),("08","08","Rap",False,560),("09","09","Makunahea",False,560),("02-1984","1984","With sound",True,330),
("cover","cover","$" + "50 to whoever shoots it",False,340),("street","street","The silent performance",False,300),("10","10","The Other Side",False,560),
("11","11","The Mind Pt 1",False,560),("f3","3","October 10",True,700),("f2","2","October 10",True,700),("f1","1","October 10",True,700),("14","14","Ghost World",False,560)]
for c in cards: card(*c)
# contact sheet, in grid order (newest first)
order=["14","f1","f2","f3","11","10","street","cover","02-1984","09","08","06","05","03","01","00-film"]
th=[Image.open(f"covers/{o}.png").crop((0,SAFE_T,W,SAFE_B)).resize((216,270)) for o in order]
sheet=Image.new("RGB",(3*216+4,6*270+10),(20,20,20))
for i,t in enumerate(th): sheet.paste(t,((i%3)*218,(i//3)*272))
sheet.save("covers/_grid.jpg")
