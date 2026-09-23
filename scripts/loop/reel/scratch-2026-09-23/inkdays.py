import numpy as np, subprocess, os, time
CONV="/Users/maniodubo/Documents/Apps/odubo/.claude/worktrees/loop-press/scripts/loop/video-convert.mjs"
while subprocess.run(["pgrep","-f","inkall2.py"],capture_output=True).stdout: time.sleep(10)
days=np.load("dayclips.npy"); s84=np.load("sync1984.npy"); stills=np.load("stills.npy")
jobs=[]
for d in days:
    n=int(d[0]); t,c=(s84[1],s84[3]) if n==2 else (d[1],d[2])
    jobs.append((f"day{n:02d}",t,c,12))
for i,r in enumerate(stills): jobs.append((f"still{i}",r[0],r[4],2.5))
for name,t,c,dur in jobs:
    out=f"ink3/{name}.mp4"
    if os.path.exists(out): continue
    X=int(min(max(c-304,0),1920-608)); ss=max(0,t-45)
    subprocess.run(["python3","tvclean.py",str(ss),str(X),f"ink3/{name}-ctx.mp4"],check=True)
    subprocess.run(["node","--max-old-space-size=8192",CONV,f"--in=ink3/{name}-ctx.mp4",f"--start={t-ss}",f"--preview={dur}","--height=1920","--bgFloor=2","--maskMinRegion=0.004",f"--out={out}"],check=True,capture_output=True)
    print(name,"done",flush=True)
