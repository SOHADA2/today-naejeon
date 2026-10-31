# 🧭 combo-fetch.cjs가 받은 콤보 상세 페이지 → <combos>/parsed.json (증강 이름·등급·출처·패치·등록일) · 사용: python3 tools/combo-parse.py <web-out/combos>
import re,json,sys,os,glob,collections
W=sys.argv[1]  # combos dir
augs=json.load(open(f'{W}/augments.json'))
byname=collections.defaultdict(list)
for a in augs:
    n=(a['name'] or '').strip()
    if n: byname[n].append(a['id'])
def aid(n):
    n=n.strip()
    c=byname.get(n) or byname.get(re.sub(r'^퀘스트:\s*','',n)) or []
    c=sorted(c,key=lambda x:(x<1000,x))
    if not c and n.startswith('퀘스트'):
        c=sorted(byname.get(re.sub(r'^퀘스트:\s*','',n),[]),key=lambda x:(x<1000,x))
    return c[0] if c else None
def txt(h):
    t=re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->','',h); t=re.sub(r'<[^>]+>','\n',t)
    return [x.strip() for x in t.split('\n') if x.strip()]
out=[];miss=collections.Counter()
for f in sorted(glob.glob(f'{W}/detail/*.html')):
    h=open(f,encoding='utf-8').read(); L=txt(h)
    ld=[json.loads(m) for m in re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>',h)]
    art=next((x for x in ld if x.get('@type')=='Article'),{})
    url=art.get('url','')
    head=art.get('headline','')
    m=re.match(r'(.+?) (\S.*?) 콤보 \(([SABCD][+-]?) 티어\)',head)
    try: i=L.index('콤보 평가 · '+(m.group(3) if m else ''))
    except: i=-1
    srcl=L[i+1] if i>=0 else ''
    core=next((x for x in L if x.startswith('이 ') and '핵심 증강:' in x),'')
    names=[]
    if core:
        s=core.split('핵심 증강:',1)[1].strip().rstrip('.')
        s=s.replace(' 및 ',', ')
        names=[x.strip() for x in s.split(', ') if x.strip()]
    try: k=L.index('← 콤보 목록으로'); champ=L[k+2]
    except: champ=''
    tl=next((x for x in L if x.startswith('콤보 평가 · ')),'')
    tier=(re.search(r'([SABCD][+-]?) 티어',tl) or [None,None])[1]
    src=L[L.index(tl)+1] if tl else ''
    desc=''
    if tl:
        j=L.index(tl)+1
        while j<len(L) and not L[j].endswith('빌드 →'): j+=1
        desc=L[j+1] if j+1<len(L) and not L[j+1].startswith('콤보 평가') else ''
    if not names:
        t0=re.sub(r'\s*\|.*$','',head); t0=re.sub(r'\s*콤보.*$','',t0)
        if champ and t0.endswith(' '+champ): t0=t0[:-len(champ)-1]
        names=[x.strip() for x in t0.split(' + ') if x.strip()]
    ids=[];bad=[]
    for n in names:
        a=aid(n)
        if a and a not in ids: ids.append(a)
        elif not a: bad.append(n); miss[n]+=1
    def after(lbl):
        try: return L[L.index(lbl)+1]
        except: return ''
    out.append({'file':os.path.basename(f),'url':url,'title':head.split(' 콤보 (')[0] if head else '','tier':tier,'champ':champ,'desc':desc,
      'src':src,'guideSrc':after('가이드 출처'),'patch':after('콤보 패치'),'upd':after('가이드 최신 정보'),
      'pub':art.get('datePublished'),'mod':art.get('dateModified'),'names':names,'ids':ids,'bad':bad})
json.dump(out,open(f'{W}/parsed.json','w'),ensure_ascii=False,indent=0)
print(len(out),'콤보')
print('출처',collections.Counter(x['src'] for x in out).most_common(6))
print('가이드출처',collections.Counter(x['guideSrc'] for x in out).most_common(6))
print('패치',collections.Counter(x['patch'] for x in out).most_common(12))
print('등록 달',collections.Counter((x['pub'] or '')[:7] for x in out).most_common(14))
print('증강 수',collections.Counter(len(x['ids']) for x in out))
print('못 찾은 이름',miss.most_common(15))
print('설명 있음',sum(1 for x in out if x['desc']));print('티어',collections.Counter(x['tier'] for x in out));print('업데이트',collections.Counter(x['upd'] for x in out).most_common(5))
