import numpy as np
from scipy.io import wavfile
from scipy.signal import stft, fftconvolve

SR=11025; HOP=256
def env(path):
    sr,x=wavfile.read(path); x=x.astype(np.float32)
    if x.ndim>1: x=x.mean(1)
    f,t,Z=stft(x,fs=sr,nperseg=1024,noverlap=1024-HOP,boundary=None)
    S=np.log1p(1000*np.abs(Z))
    # 16 log-spaced bands between 60 Hz and 5 kHz
    edges=np.geomspace(60,5000,17); bands=[]
    for a,b in zip(edges[:-1],edges[1:]):
        m=(f>=a)&(f<b)
        e=S[m].mean(0)
        d=np.maximum(0,np.diff(e,prepend=e[0]))   # onset flux per band
        d=(d-d.mean())/(d.std()+1e-9)
        bands.append(d)
    return np.array(bands)
R=env("room.wav"); fps=SR/HOP
print("room frames",R.shape[1], "=", R.shape[1]/fps/60, "min")
titles="Welcome,1984,Hallucinogen,The No End Theory,In The Court,News Peak,Every Generation,Rap,Makunahea,The Other Side,The Mind Pt 1,Midnight Marauders,The Mind Pt 2,Ghost World".split(",")
out=[]
for n in range(1,15):
    M=env(f"m{n:02d}.wav"); L=M.shape[1]
    c=np.zeros(R.shape[1]+L-1)
    for b in range(16):
        c+=fftconvolve(R[b],M[b][::-1],mode="full")
    c/= (16*L)
    lag=np.argmax(c)-(L-1)           # frame where the master starts in the room
    z=(c.max()-c.mean())/c.std()
    out.append((n,titles[n-1],lag/fps,L/fps,z))
    print(f"{n:2d} {titles[n-1]:20s} start {lag/fps/60:6.2f} min ({lag/fps:7.1f}s)  len {L/fps:5.0f}s  z={z:5.1f}")
