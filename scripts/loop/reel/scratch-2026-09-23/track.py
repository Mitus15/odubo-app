import numpy as np
from scipy import ndimage as ndi
W,H,FPS=192,108,5
f=np.fromfile("low.gray",np.uint8); n=len(f)//(W*H); F=f[:n*W*H].reshape(n,H,W)
TV=(slice(4,48),slice(68,140))
# rolling background: median of frames sampled every 5 s within +/-60 s
samp=np.arange(0,n,25); bgs={}
def bg_at(i):
    k=int(i//150)
    if k not in bgs:
        c=k*150+75; idx=samp[(samp>c-300)&(samp<c+300)]
        bgs[k]=np.median(F[idx].astype(np.float32),axis=0)
    return bgs[k]
cx=np.full(n,np.nan); top=np.zeros(n); bot=np.zeros(n); hgt=np.zeros(n); mot=np.zeros(n)
prev=None
for i in range(n):
    fr=F[i].astype(np.float32); d=np.abs(fr-bg_at(i))
    m=ndi.binary_opening(d>30,iterations=1)
    lab,k=ndi.label(m)
    if k:
        sizes=ndi.sum(m,lab,range(1,k+1)); j=np.argmax(sizes)+1
        if sizes[j-1]>120:
            ys0,xs0=np.nonzero(lab==j); a,b=xs0.min()-6,xs0.max()+6
            keep=[q+1 for q in range(k) if sizes[q]>25]
            pm=np.zeros_like(m)
            for q in keep:
                yq,xq=np.nonzero(lab==q)
                if xq.max()>=a and xq.min()<=b: pm|=lab==q
            ys,xs=np.nonzero(pm)
            top[i],bot[i]=ys.min()/H,ys.max()/H; hgt[i]=bot[i]-top[i]; cx[i]=xs.mean()*1920/W
            if prev is not None:
                x0,x1=max(xs.min()-3,0),xs.max()+3; mot[i]=np.abs(fr[:,x0:x1]-prev[:,x0:x1]).mean()
    prev=fr
np.savez("track.npz",cx=cx,top=top,bot=bot,hgt=hgt,mot=mot)
win=8*FPS; rows=[]
for s in range(0,n-win,FPS):
    c=cx[s:s+win]
    if np.isnan(c).any(): continue
    h=hgt[s:s+win]; t=top[s:s+win]
    if h.min()<0.6 or t.min()<0.01: continue   # whole body, normal distance
    span=np.percentile(c,97)-np.percentile(c,3)
    if span>430: continue
    rows.append((s/FPS, mot[s:s+win].mean(), span, (np.percentile(c,3)+np.percentile(c,97))/2))
rows=np.array(rows); print("usable windows",len(rows))
order=rows[np.argsort(-rows[:,1])]; pick=[]
for r in order:
    if all(abs(r[0]-p[0])>120 for p in pick): pick.append(r)
    if len(pick)==12: break
pick.sort(key=lambda r:r[0])
for r in pick: print(f"{r[0]/60:6.2f} min  t={r[0]:7.1f}  motion {r[1]:5.2f}  span {r[2]:4.0f}  center {r[3]:5.0f}")
np.save("pick2.npy",np.array(pick))
