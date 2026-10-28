# Pulls customer reviews from Apple's official public RSS feed (within its terms). Verbatim text, with link.
import json, csv, urllib.request, sys
APPS = {6746098224:'Car Design AI - Tuning',6751798844:'Car AI - AI Car Design & Style',6746153393:'AI Car Tune and Modify',6753362163:'Car Tuning AI',6754164821:'Car AI - Car Modifier & Tuner',6752488950:'Car Mod & Tuning AI',6755485822:'Mods: AI Car Designer & Tuning',6754633994:'RevvUp Car Customizer AI',6757122835:'AI Car Tuning & Modify Design',6745174474:'Car AI: Modification Editor',6749776488:'AI Car Designer',6744177818:'Car Designer - MuxoCar',6748773500:'AI Car Design - Modify',1515523302:'Cartomizer',898369939:'3DTuning',1577822781:'Holo Wheels',1337646714:'CarRim',1141295175:'WheelsVision',1439737490:'Car Rim Photo Editor',6476076430:'Carman Wheel',6504971468:'AutoStyle.AI Wrap Visualizer',6745814896:'Car Wheels AI'}
rows=[]; stats={}
for aid,name in APPS.items():
    n=0
    for cc in ['us','gb','ca','au','ru','de','fr','it','es','br','mx','nl','pl','tr','ae','in']:
        for page in (1,2):
            u=f'https://itunes.apple.com/{cc}/rss/customerreviews/page={page}/id={aid}/sortBy=mostRecent/json'
            try: d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=20))
            except Exception as e: break
            ents=d.get('feed',{}).get('entry',[])
            if isinstance(ents,dict): ents=[ents]
            got=0
            for e in ents:
                if 'im:rating' not in e: continue
                txt=(e['title']['label']+' — '+e['content']['label']).replace('\n',' ').strip()
                link=e.get('link',{}).get('attributes',{}).get('href','') if isinstance(e.get('link'),dict) else ''
                if not link: link=f'https://apps.apple.com/{cc}/app/id{aid}'
                rows.append([f'App Store ({name}, {cc})',link,e['updated']['label'][:10],e['im:rating']['label'],txt]); n+=1; got+=1
            if got<50: break
    stats[name]=n
w=csv.writer(open('reviews_apple.csv','w',newline='',encoding='utf-8')); w.writerow(['source','url','date','rating','text']); w.writerows(rows)
print(len(rows)); [print(k,v) for k,v in stats.items()]
