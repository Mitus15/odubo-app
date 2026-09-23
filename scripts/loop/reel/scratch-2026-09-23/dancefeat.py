import numpy as np
W,H,FPS=96,54,15
f=np.fromfile("low15.gray",np.uint8); n=len(f)//(W*H); F=f[:n*W*H].reshape(n,H,W).astype(np.float32)
F[:,2:23,37:68]=0          # the TV screen (x 741-1345, y 91-435 at 1920x1080)
d=np.abs(np.diff(F,axis=0)).mean((1,2)); d=np.r_[0,d]
tr=np.load("track.npz"); top,h,cxs=tr["top"],tr["hgt"],tr["cx"]   # 5 fps
rows=[]
win=8*FPS
for s in range(0,n-win,FPS):
    s5=int(s/3); c=cxs[s5:s5+40]
    if np.isnan(c).any() or h[s5:s5+40].min()<0.6 or top[s5:s5+40].min()<0.01: continue
    if np.percentile(c,97)-np.percentile(c,3)>430: continue
    m=d[s:s+win]; e=m.mean(); x=m-m.mean()
    ac=np.correlate(x,x,"full")[win-1:]; ac/=ac[0]+1e-9
    lo,hi=int(FPS*60/150),int(FPS*60/50); k=lo+np.argmax(ac[lo:hi]); bpm=60*FPS/k
    rows.append((s/FPS,e,bpm,ac[k],(np.percentile(c,3)+np.percentile(c,97))/2))
rows=np.array(rows); np.save("windows.npy",rows)
print("windows",len(rows)); print("energy pct 10/50/90", np.percentile(rows[:,1],[10,50,90]).round(2)); print("pulse strength median",np.median(rows[:,3]).round(2))
