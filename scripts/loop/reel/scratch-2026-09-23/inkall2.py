import numpy as np, subprocess, os
CONV="/Users/maniodubo/Documents/Apps/odubo/.claude/worktrees/loop-press/scripts/loop/video-convert.mjs"
pick=np.load("pick2.npy"); rep=np.load("repl0.npy")
pick=[(rep[0],rep[4])]+[(r[0],r[3]) for r in pick[1:]]
np.save("pick3.npy",np.array(pick))
for i,(t,c) in enumerate(pick):
    out=f"ink2/seg{i:02d}.mp4"
    if os.path.exists(out): continue
    X=int(min(max(c-304,0),1920-608)); ss=max(0,t-45)
    subprocess.run(["python3","tvclean.py",str(ss),str(X),f"ink2/ctx{i:02d}.mp4"],check=True)
    subprocess.run(["node","--max-old-space-size=8192",CONV,f"--in=ink2/ctx{i:02d}.mp4",f"--start={t+0.5-ss}","--preview=7","--height=1920","--bgFloor=2","--maskMinRegion=0.004",f"--out={out}"],check=True,capture_output=True)
    print(i,"done",flush=True)
