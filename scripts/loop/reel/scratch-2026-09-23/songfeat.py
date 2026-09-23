import numpy as np
exec(open("align.py").read().split("R=env")[0])
from scipy.io import wavfile
fps=SR/HOP
titles="Welcome,1984,Hallucinogen,The No End Theory,In The Court,News Peak,Every Generation,Rap,Makunahea,The Other Side,The Mind Pt 1,Midnight Marauders,The Mind Pt 2,Ghost World".split(",")
rows=[]
for n in range(1,15):
    E=env(f"m{n:02d}.wav"); o=E.sum(0)
    sr,x=wavfile.read(f"m{n:02d}.wav"); x=x.astype(np.float32); rms=np.sqrt((x**2).mean())
    best=(0,0)
    for s in range(0,max(1,len(o)-int(30*fps)),int(15*fps)):
        w=o[s:s+int(30*fps)]; w=w-w.mean(); ac=np.correlate(w,w,"full")[len(w)-1:]; ac/=ac[0]+1e-9
        lo,hi=int(fps*60/170),int(fps*60/65); k=lo+np.argmax(ac[lo:hi])
        if ac[k]>best[0]: best=(ac[k],60*fps/k)
    dens=(o>np.percentile(o,85)).mean()
    rows.append((n,titles[n-1],best[1],best[0],20*np.log10(rms+1e-9),np.mean(np.maximum(o,0))))
    print(f"{n:2d} {titles[n-1]:20s} tempo {best[1]:6.1f}  beat {best[0]:.2f}  loud {20*np.log10(rms+1e-9):6.1f} dB  drive {np.mean(np.maximum(o,0)):.3f}")
np.save("songs.npy",np.array([(r[0],r[2],r[3],r[4],r[5]) for r in rows]))
