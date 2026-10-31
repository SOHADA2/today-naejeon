import json,sys,re,collections,glob,os,datetime
RECENT=(datetime.date.today()-datetime.timedelta(days=60)).isoformat()   # 60일 안 자료 = 최근(먼저 보임)
# 🧭 arammayhem 자료 → tools/aug-draft.json(증강 가이드 초안) · 사용: python3 tools/combo-parse.py <web-out/combos> 후
#    python3 tools/combo-build.py <web-out/combos> <web-out(summary.json·pages)> tools/aug-draft.json
# 플랜 = 사이트 콤보(증강 구성·등급·원문 링크·등록일) · top = 챔피언 페이지 이번 패치 S- 이상 증강 · avoid = 「함정」·C등급 콤보의 증강
C,WEB,OUT=sys.argv[1],sys.argv[2],sys.argv[3]
summ=json.load(open(f'{WEB}/summary.json'))
augs=json.load(open(f'{C}/augments.json'))
byname=collections.defaultdict(list)
for a in augs:
    if a['name']: byname[a['name'].strip()].append(a['id'])
def aid(n):
    c=byname.get(n) or byname.get(re.sub(r'^퀘스트:\s*','',n)) or []
    c=sorted(c,key=lambda x:(x<1000,x)); return c[0] if c else None
RK={'S+':0,'S':1,'S-':2,'A+':3,'A':4,'A-':5,'B+':6,'B':7,'B-':8,'C':9,'D':10}
name2id={v['name']:k for k,v in summ.items()}
parsed=json.load(open(f'{C}/parsed.json'))
champs={}
stat=collections.Counter()
for k,v in summ.items():
    pg=f"{WEB}/pages/am-{v['alias'].lower()}.txt"
    patch=None
    if os.path.exists(pg):
        m=re.search(r'패치: (\d+\.\d+)',open(pg,encoding='utf-8').read()); patch=m and m.group(1)
    top=[]
    for a in sorted(v['augs'],key=lambda a:(RK.get(a['tier'],99),-(a['pick'] or 0))):
        i=aid(a['n'])
        if i and RK.get(a['tier'],99)<=RK['S-'] and i not in [x['id'] for x in top]: top.append({'id':i,'tier':a['tier']})
        if len(top)>=6: break
    e={'plans':[]}
    if top and patch: e['top']={'patch':patch,'augs':top}; stat['top']+=1
    champs[k]=e
for x in parsed:
    k=name2id.get(x['champ'])
    if not k: stat['nochamp']+=1; continue
    if not x['ids'] or not x['tier']: stat['noaug']+=1; continue
    if x['src']=='함정' or x['tier'] in ('C','D'):
        stat['trap']+=1; av=champs[k].setdefault('avoid',[])
        for i in x['ids']:
            if i not in av and len(av)<6: av.append(i)
        continue
    p={'title':'','augs':x['ids'][:6],'why':'','tier':x['tier'],'link':x['url']}
    pm=re.match(r'^(\d+\.\d+)',x['patch'] or '')
    if pm: p['patch']=pm.group(1)
    elif x['pub']: p['date']=x['pub'][:10]
    else:
        m2=re.search(r'(\d{4})년 (\d+)월 (\d+)일',x['upd'] or '')
        if m2: p['date']=f'{m2.group(1)}-{int(m2.group(2)):02d}-{int(m2.group(3)):02d}'
    champs[k]['plans'].append(p)
for k,e in champs.items():
    e['plans'].sort(key=lambda p:(p.get('date','')<RECENT,RK.get(p['tier'],99),-len(p['augs'])))   # 최근 자료 먼저 → 등급 → 증강 많은 순
    e['plans']=e['plans'][:6]
    stat['plans']+=len(e['plans']); stat['withplans']+=bool(e['plans'])
champs={k:e for k,e in champs.items() if e['plans'] or e.get('top') or e.get('avoid')}
json.dump({'src':'arammayhem.com — 콤보(사이트 편집 평가)·이번 패치 증강 등급','champs':champs},open(OUT,'w'),ensure_ascii=False,indent=0)
stat['avoidChamps']=sum(1 for e in champs.values() if e.get('avoid'));print(dict(stat),'챔피언',len(champs))
