import numpy as np, subprocess, re, os, glob, functools
SR=48000
V=os.environ.get('VSCO', '/home/user/sgossner/vsco-2-ce/')   # VSCO-2-CE 클론 위치(git clone --filter=blob:none --sparse 후 필요한 폴더만)
@functools.lru_cache(None)
def load(p):
    raw=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.float32).reshape(-1,2).copy()
NOTE={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def midi(n):
    m=re.match(r'([A-G]#?)(-?\d)',n); return 12*(int(m.group(2))+1)+NOTE[m.group(1)]
def f0(x):
    x=x[:,0]+x[:,1]; i=int(np.argmax(np.abs(x))); seg=x[i+int(0.05*SR):i+int(0.05*SR)+16384]
    if len(seg)<4096: seg=x[i:i+16384]
    seg=seg*np.hanning(len(seg)); sp=np.abs(np.fft.rfft(seg,1<<17)); fr=np.fft.rfftfreq(1<<17,1/SR)
    lo=(fr>25)&(fr<2500); hps=sp.copy()
    for h in (2,3): d=sp[::h]; hps[:len(d)]*=d
    hps[~lo]=0; return fr[np.argmax(hps)]
def bank(folder, pat, vel=None):
    """{name_midi: path} for files in folder matching pattern; group(1)=note"""
    out={}
    for p in sorted(glob.glob(V+folder+'/*.wav')):
        m=re.search(pat,os.path.basename(p))
        if not m: continue
        if vel and vel not in os.path.basename(p): continue
        out.setdefault(midi(m.group(1)),p)
    return out
@functools.lru_cache(None)
def offset_measured(folder,pat,vel=None):
    b=bank(folder,pat,vel); ks=sorted(b); errs=[]
    for k in ks[len(ks)//3:len(ks)//3+3]:
        f=f0(load(b[k])); m=69+12*np.log2(f/440); errs.append(round(m-k))
    return int(np.median(errs))  # real = name + off
def note(folder,pat,target,vel=None,dur=None,rel=0.15):
    b=bank(folder,pat,vel); off=offset(folder,pat,vel)
    real={k+off:p for k,p in b.items()}
    k=min(real,key=lambda r:abs(r-target)); x=load(real[k])
    ratio=2**((target-k)/12)
    if abs(ratio-1)>1e-4:
        n=int(len(x)/ratio); idx=np.arange(n)*ratio
        x=np.stack([np.interp(idx,np.arange(len(x)),x[:,c]) for c in (0,1)],1).astype(np.float32)
    # trim leading silence
    a=np.abs(x).max(1); th=a.max()*0.02; s=int(np.argmax(a>th)); x=x[max(0,s-int(0.005*SR)):]
    if dur:
        n=int(dur*SR); x=x[:n+int(rel*SR)].copy()
        if len(x)>n:
            fl=len(x)-n; x[n:]*=np.linspace(1,0,fl)[:,None]
    return x
def add(buf,x,t,g=1.0):
    s=int(t*SR); e=min(len(buf),s+len(x))
    if e>s: buf[s:e]+=x[:e-s]*g
def nm(n): return midi(n)
def offset(folder,pat,vel=None): return 12   # VSCO-2 파일 이름 = 실제 음 - 1옥타브(자기상관으로 잼, 악기 전부 같음)
