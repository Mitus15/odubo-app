import numpy as np
exec(open("align.py").read().split("R=env")[0])
FPS=15
W,H=96,54
f=np.fromfile("low15.gray",np.uint8); n=len(f)//(W*H); F=f[:n*W*H].reshape(n,H,W).astype(np.float32); F[:,2:23,37:68]=0
mot=np.r_[0,np.abs(np.diff(F,axis=0)).mean((1,2))]
mon=np.maximum(0,np.diff(mot,prepend=mot[0]))          # movement onsets
E=env("m02.wav").sum(0); efps=SR/HOP
t_e=np.arange(len(E))/efps; t15=np.arange(0,t_e[-1],1/FPS); song=np.interp(t15,t_e,E)
song=np.maximum(0,song-np.convolve(song,np.ones(15)/15,"same"))
Wd=np.load("windows.npy"); film=np.load("pick3.npy")[:,0]; days=np.load("dayclips.npy")
ts=set(Wd[:,0].astype(int))
cands=[r for r in Wd if int(r[0])+4 in ts and all(abs(r[0]-x)>20 for x in film) and all(abs(r[0]-d[1])>14 for d in days if d[0]!=2)]
L=12*FPS; best=[]
for r in cands:
    s=int(r[0]*FPS); m=mon[s:s+L]; m=(m-m.mean())/(m.std()+1e-9)
    for k in range(0,len(song)-L,FPS//3):
        a=song[k:k+L]; a=(a-a.mean())/(a.std()+1e-9)
        c=(m*a).mean()
        best.append((c,r[0],k/FPS,r[4]))
best.sort(reverse=True)
seen=[]
for c,t,st,cx in best:
    if all(abs(t-q[1])>10 for q in seen): seen.append((c,t,st,cx))
    if len(seen)==5: break
for c,t,st,cx in seen: print(f"dance {t/60:5.2f} min  with 1984 from {st:5.1f}s  sync {c:.2f}")
np.save("sync1984.npy",np.array(seen[0]))
# null: same score against shuffled song positions, to know what "chance" looks like
rng=np.random.default_rng(1); null=[]
for _ in range(2000):
    r=cands[rng.integers(len(cands))]; s=int(r[0]*FPS); m=mon[s:s+L]; m=(m-m.mean())/(m.std()+1e-9)
    k=rng.integers(0,len(song)-L); a=song[k:k+L]; a=(a-a.mean())/(a.std()+1e-9); null.append((m*a).mean())
print("chance level 50/99/99.9 pct:", np.percentile(null,[50,99,99.9]).round(2))
