import numpy as np
from scipy.optimize import linear_sum_assignment
S=np.load("songs.npy")     # n, tempo, beat, loud, drive
W=np.load("windows.npy")   # t, energy, bpm, pulse, center
film=np.load("pick3.npy")[:,0] if __import__("os").path.exists("pick3.npy") else np.load("pick2.npy")[:,0]
titles="Welcome,1984,Hallucinogen,The No End Theory,In The Court,News Peak,Every Generation,Rap,Makunahea,The Other Side,The Mind Pt 1,Midnight Marauders,The Mind Pt 2,Ghost World".split(",")
days=[1,3,5,6,8,9,2,10,11,14]
def fold(b):
    while b>135: b/=2
    while b<65: b*=2
    return b
# 12 s clips: a window qualifies if it and the next 4 s both qualify, and it stays clear of the film
ok=[]
ts=set(W[:,0].astype(int))
for r in W:
    if int(r[0])+4 in ts and all(abs(r[0]-f)>20 for f in film): ok.append(r)
ok=np.array(ok); print("candidate 12 s windows",len(ok))
# thin to one candidate per 10 s so a clip can't be two neighbours of one moment
thin=[]
for r in ok[np.argsort(-ok[:,3])]:
    if all(abs(r[0]-q[0])>10 for q in thin): thin.append(r)
thin=np.array(thin)
er=thin[:,1].argsort().argsort()/len(thin)          # window energy rank 0..1
drives=np.array([S[n-1][4] for n in days]); dr=drives.argsort().argsort()/(len(days)-1)
C=np.zeros((len(days),len(thin)))
for i,n in enumerate(days):
    tb=fold(S[n-1][1]); strong=S[n-1][2]
    for j,r in enumerate(thin):
        wb=fold(r[2]); tempo=min(abs(np.log2(wb/tb)),abs(np.log2(wb/tb)-1),abs(np.log2(wb/tb)+1))
        C[i,j]= 3*tempo*strong + 1.2*abs(er[j]-dr[i]) - 0.8*r[3]
rows,cols=linear_sum_assignment(C)
out=[]
for i,j in zip(rows,cols):
    n=days[i]; r=thin[j]
    out.append((n,r[0],r[4],r[2],fold(S[n-1][1]),r[1],r[3]))
    print(f"{n:02d} {titles[n-1]:18s} song {fold(S[n-1][1]):5.1f} bpm  →  {r[0]/60:5.2f} min  moves {fold(r[2]):5.1f} bpm  energy {r[1]:.2f}  pulse {r[3]:.2f}")
np.save("dayclips.npy",np.array(out))
# the freeze: longest near-still stretches, standing, full body
still=W[np.argsort(W[:,1])]
fr=[]
for r in still:
    if all(abs(r[0]-q[0])>60 for q in fr) and all(abs(r[0]-f)>20 for f in film): fr.append(r)
    if len(fr)==3: break
for r in fr: print(f"still: {r[0]/60:5.2f} min  energy {r[1]:.2f}")
np.save("stills.npy",np.array(fr))
