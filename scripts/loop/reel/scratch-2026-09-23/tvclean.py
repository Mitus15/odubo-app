import sys, subprocess, numpy as np
from scipy import ndimage as ndi
SRC="/Users/maniodubo/Downloads/IMG_0129.MOV"
ss,X,out=float(sys.argv[1]),int(sys.argv[2]),sys.argv[3]
W,H=608,1080; TVL,TVR,TVT,TVB=741,1345,91,435
L,R=max(TVL-X,0),min(TVR-X,W)
def bodymask(tv):
    r,g,b=tv[...,0],tv[...,1],tv[...,2]; lum=(r+g+b)/3; sat=np.maximum(np.maximum(r,g),b)-np.minimum(np.minimum(r,g),b)
    keep=((g>b)|(r>b+8))&(lum>30)&~((lum>170)&(sat<45))
    keep=ndi.binary_opening(keep,iterations=1); keep=ndi.binary_closing(keep,iterations=6)
    lab,k=ndi.label(keep)
    if not k: return keep
    s=ndi.sum(keep,lab,range(1,k+1)); big=np.argmax(s)+1
    bottom=set(np.unique(lab[-3:]))-{0}
    ok=[big]+[i+1 for i in range(k) if i+1!=big and i+1 in bottom and s[i]>400 and not (lab[:,:3]==i+1).any() and not (lab[:,-3:]==i+1).any()]
    if s[big-1]<1500: ok=[i for i in ok if i!=big]   # nobody in front of the screen
    keep=ndi.binary_fill_holes(np.isin(lab,ok))
    return ndi.binary_dilation(keep,iterations=4)
dec=subprocess.Popen(["ffmpeg","-v","error","-ss",str(ss),"-t","97","-i",SRC,"-an","-vf",f"crop={W}:{H}:{X}:0","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
enc=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r","30","-i","-","-c:v","libx264","-preset","fast","-crf","12","-pix_fmt","yuv420p",out],stdin=subprocess.PIPE)
while True:
    buf=dec.stdout.read(W*H*3)
    if len(buf)<W*H*3: break
    f=np.frombuffer(buf,np.uint8).reshape(H,W,3).copy()
    if L<R:
        tv=f[TVT:TVB,L:R].astype(np.int16); m=bodymask(tv)
        f[TVT:TVB,L:R][~m]=(12,12,16)
    enc.stdin.write(f.tobytes())
enc.stdin.close(); enc.wait()
