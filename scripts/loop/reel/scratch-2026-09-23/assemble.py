import subprocess, os, sys
FONT="/Users/maniodubo/Documents/Apps/odubo/.claude/worktrees/loop-press/public/loop/fonts/Jost-700.ttf"
ENC=["-c:v","libx264","-preset","slow","-crf","19","-profile:v","high","-pix_fmt","yuv420p"]
def card(out,text,dur,size):
    open("card.txt","w").write(text)
    subprocess.run(["ffmpeg","-v","error","-y","-f","lavfi","-i",f"color=c=0x2a0f0a:s=1080x1920:r=30:d={dur}",
      "-vf",f"drawtext=fontfile={FONT}:textfile=card.txt:fontcolor=0xd9aa7a:fontsize={size}:x=(w-text_w)/2:y=(h-text_h)/2,format=yuv420p",*ENC,out],check=True)
def norm(src,out,hold=0):
    vf="fps=30,format=yuv420p"+(f",tpad=stop_mode=clone:stop_duration={hold}" if hold else "")
    subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-an","-vf",vf,*ENC,out],check=True)
def join(parts,out,audio=None,astart=0):
    with open("join.txt","w") as f:
        for p in parts: f.write(f"file '{p}'\n")
    a=["-ss",str(astart),"-i",audio] if audio else ["-f","lavfi","-i","anullsrc=r=44100:cl=stereo"]
    dur=sum(float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout) for p in parts)
    af=["-af",f"afade=t=out:st={dur-1.0}:d=1.0"] if audio else []
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i","join.txt",*a,"-map","0:v","-map","1:a","-t",str(dur),"-c:v","copy",*af,"-c:a","aac","-b:a","192k","-movflags","+faststart",out],check=True)
what=sys.argv[1]
if what=="film":
    card("a_open.mp4","You can’t hear this yet.",1.8,72); card("a_close.mp4","October 10.",2.2,110)
    parts=["a_open.mp4"]+[f"a_seg{i:02d}.mp4" for i in range(11)]
    for i in range(11):
        if not os.path.exists(f"a_seg{i:02d}.mp4"): norm(f"ink2/seg{i:02d}.mp4",f"a_seg{i:02d}.mp4",hold=2.2 if i==10 else 0)
    parts.append("a_close.mp4"); join(parts,"out/loop-soul-film.mp4")
if what=="days":
    import numpy as np
    s84=np.load("sync1984.npy")
    names={1:"welcome",2:"1984",3:"hallucinogen",5:"in-the-court",6:"news-peak",8:"rap",9:"makunahea",10:"the-other-side",11:"the-mind-pt-1",14:"ghost-world"}
    for n,slug in names.items():
        norm(f"ink3/day{n:02d}.mp4",f"b_day{n:02d}.mp4")
        out=f"out/{n:02d}-{slug}.mp4"
        if n==2: join([f"b_day{n:02d}.mp4"],out,audio="m02.m4a",astart=float(s84[2]))
        else: join([f"b_day{n:02d}.mp4"],out)
    for i,num in enumerate(["3","2","1"]):
        norm(f"ink3/still{i}.mp4",f"b_still{i}.mp4",hold=7.5)
        card(f"b_card{i}.mp4",num,1.5,520)
        join([f"b_still{i}.mp4",f"b_card{i}.mp4"],f"out/freeze-{num}.mp4")
