"use strict";
window.SMC = window.SMC || {};
SMC.share = (function () {
    var api = SMC.api;
    var CSS_RECORD = ".pr-header{text-align:center;padding-bottom:8pt;margin-bottom:12pt;border-bottom:2pt solid #002B6B}.pr-header h1{font-size:15pt;font-weight:700;color:#002B6B;margin:0 0 2pt}.pr-header p{font-size:9pt;color:#555;margin:0}.pr-section{margin-bottom:12pt}.pr-section-title{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:#002B6B;color:#fff;padding:4pt 7pt;margin-bottom:8pt}.pr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6pt 12pt;margin-bottom:6pt}.pr-label{font-size:7pt;text-transform:uppercase;color:#555;font-weight:700;margin-bottom:1pt}.pr-value{font-size:9.5pt;color:#000;word-break:break-word}.pr-long{grid-column:1/-1;background:#f5f5f5;border-left:2pt solid #002B6B;padding:5pt 8pt;margin-top:3pt}.pr-long .pr-value{white-space:pre-wrap;line-height:1.5}.pr-sig{margin-top:28pt;display:grid;grid-template-columns:1fr 1fr;gap:20pt}.pr-sig-block{border-top:1pt solid #000;padding-top:4pt;font-size:9pt;color:#444;text-align:center}";
    var CSS_INCIDENT = ".ipr{font-family:'Georgia','Times New Roman',serif;color:#111;line-height:1.5}.ipr-head{display:flex;align-items:center;justify-content:center;gap:16px;text-align:center;border-bottom:3px double #002B6B;padding-bottom:14px;margin-bottom:6px}.ipr-head img{height:70px;width:auto}.ipr-ht h1{margin:0;font-size:21px;letter-spacing:2px;color:#002B6B;font-weight:700}.ipr-ht h2{margin:2px 0 0;font-size:13px;font-weight:normal;letter-spacing:3px;text-transform:uppercase;color:#333}.ipr-doc{margin-top:6px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#7a1f1f}.ipr-conf{text-align:center;font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:#7a1f1f;border:1px solid #7a1f1f;border-radius:3px;padding:3px 0;margin:0 0 16px}.ipr-meta{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:11.5px}.ipr-meta td{border:1px solid #444;padding:7px 9px}.ipr-meta .k{background:#eef2f8;font-weight:bold;width:110px;text-transform:uppercase;font-size:10px;letter-spacing:.5px}.ipr h3{font-size:12px;color:#002B6B;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1.5px solid #002B6B;padding-bottom:4px;margin:20px 0 8px}.ipr-inv{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:6px}.ipr-inv th,.ipr-inv td{border:1px solid #444;padding:6px 8px;text-align:left}.ipr-inv th{background:#eef2f8;text-transform:uppercase;font-size:10px;letter-spacing:.5px}.ipr-txt{font-size:12px;line-height:1.6;min-height:54px;border:1px solid #bbb;padding:10px 12px;border-radius:3px;background:#fcfcfc}.ipr-foot{display:flex;justify-content:space-between;gap:40px;margin-top:52px}.ipr-sign{flex:1;text-align:center}.ipr-sign .ipr-line{border-top:1px solid #000;margin:0 10px 5px}.ipr-sign span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#555}.ipr-sign strong{display:block;font-size:12.5px;margin-top:3px}.ipr-sign small{color:#666;font-size:10px}.ipr-note{margin-top:26px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;color:#666;text-align:center;letter-spacing:.3px}";
    var CSS_CLASSLIST = ".cpr{font-family:'Georgia','Times New Roman',serif;color:#000}.cpr-head{text-align:center;margin-bottom:14px}.cpr-ht{font-size:18px;font-weight:700;letter-spacing:.05em}.cpr-hs{font-size:12px}.cpr-doc{font-size:14px;font-weight:700;margin-top:6px;text-decoration:underline}.cpr-meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;font-size:12px;margin:10px 0 14px;border:1px solid #000;padding:8px 12px}.cpr-k{font-weight:700}.cpr-grp{font-size:13px;font-weight:700;margin:12px 0 4px;background:#000;color:#fff;padding:2px 10px;display:inline-block}.cpr-tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:8px}.cpr-tbl th,.cpr-tbl td{border:1px solid #000;padding:3px 6px;text-align:left;color:#000}.cpr-tbl thead th{background:#eee;font-weight:700}.cpn{width:28px;text-align:center}.cpr-foot{margin-top:16px;font-size:10px;color:#333;border-top:1px solid #000;padding-top:6px}";
    function cssFor(type){if(type==='record')return CSS_RECORD;if(type==='incident')return CSS_INCIDENT;if(type==='classlist')return CSS_CLASSLIST;return '';}
    function escAttr(s){return String(s==null?'':s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');}
    function buildDoc(d){
        if(d.full)return d.html;
        var base="*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff;margin:0;padding:28px;color:#111;font-family:Arial,Helvetica,sans-serif}@media print{body{padding:0}}";
        return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escAttr(d.title||'Document')+'</title><style>'+base+cssFor(d.type)+'</style></head><body class="'+escAttr(d.bodyClass||'')+'">'+(d.html||'')+'</body></html>';
    }
    function qparam(k){
        var s=location.search||'';
        if(s.charAt(0)==='?')s=s.slice(1);
        if(!s)return '';
        var parts=s.split('&');
        for(var i=0;i<parts.length;i++){var kv=parts[i].split('=');if(decodeURIComponent(kv[0])===k)return decodeURIComponent((kv[1]||'').split('+').join(' '));}
        return '';
    }
    function check(){
        var t=qparam('d');
        if(!t)return false;
        document.documentElement.classList.add('share-mode');
        renderView(t);
        return true;
    }
    function renderView(token){
        var scr=document.getElementById('shareScreen');
        if(!scr)return;
        scr.classList.add('on');
        var body=document.getElementById('shareBody');
        var titleEl=document.getElementById('shareDocTitle');
        var printBtn=document.getElementById('sharePrintBtn');
        var note=document.getElementById('shareExpiry');
        if(printBtn)printBtn.style.display='none';
        if(note)note.textContent='';
        body.innerHTML='<div class="share-loading">Loading document…</div>';
        api.getShared(token).then(function(d){
            if(titleEl)titleEl.textContent=d.title||'Shared document';
            var frame=document.createElement('iframe');
            frame.id='shareFrame';
            frame.setAttribute('title',d.title||'Shared document');
            body.innerHTML='';
            body.appendChild(frame);
            frame.srcdoc=buildDoc(d);
            if(printBtn){printBtn.style.display='';printBtn.onclick=function(){try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){window.print();}};}
            if(note&&d.expiresAt){var ex=new Date(d.expiresAt);if(!isNaN(ex.getTime()))note.textContent='View-only link · expires '+ex.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});}
        }).catch(function(e){
            if(titleEl)titleEl.textContent='Link unavailable';
            body.innerHTML='<div class="share-error"><div class="share-error-ic">🔗</div><h2>'+escAttr((e&&e.message)||'This link is no longer available.')+'</h2><p>Please ask the Guidance Office for a new view-only link.</p></div>';
        });
    }
    function open(type,title,html,opts){
        opts=opts||{};
        showCreate('Creating view-only link…',null,null,null);
        api.createShare({type:type,title:title||'',html:html,bodyClass:opts.bodyClass||'',full:!!opts.full}).then(function(r){
            var base=location.href.split('#')[0].split('?')[0];
            showCreate(null,base+'?d='+encodeURIComponent(r.token),r.expiresAt,null);
        }).catch(function(e){showCreate(null,null,null,(e&&e.message)||'Could not create link.');});
    }
    function showCreate(loadingMsg,url,expiresAt,errMsg){
        var ov=document.getElementById('shareCreateOv');
        if(!ov)return;
        ov.classList.add('on');
        var b=document.getElementById('shareCreateBody');
        if(loadingMsg){b.innerHTML='<div class="share-loading">'+escAttr(loadingMsg)+'</div>';return;}
        if(errMsg){b.innerHTML='<div class="sc-err">'+escAttr(errMsg)+'</div>';return;}
        var expTxt=expiresAt?('Expires '+new Date(expiresAt).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})):'';
        b.innerHTML='<p class="sc-lead">Anyone with this link can view and print this document. No sign-in needed.</p><div class="sc-row"><input type="text" id="shareUrlInput" readonly value="'+escAttr(url)+'"><button class="abtn" id="shareCopyBtn">Copy</button></div><p class="sc-exp">'+escAttr(expTxt)+' · Revoke anytime from the Command Center (type shares).</p>';
        var inp=document.getElementById('shareUrlInput');
        inp.addEventListener('click',function(){this.select();});
        setTimeout(function(){inp.select();},30);
        document.getElementById('shareCopyBtn').addEventListener('click',function(){
            inp.select();
            var done=function(){if(SMC.ui&&SMC.ui.toast)SMC.ui.toast('Link copied.','ok');};
            if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done,function(){try{document.execCommand('copy');done();}catch(e){}});
            else{try{document.execCommand('copy');done();}catch(e){}}
        });
    }
    function closeCreate(){var ov=document.getElementById('shareCreateOv');if(ov)ov.classList.remove('on');}
    function bind(){
        var x=document.getElementById('shareCreateClose');
        if(x)x.addEventListener('click',closeCreate);
        var ov=document.getElementById('shareCreateOv');
        if(ov)ov.addEventListener('click',function(e){if(e.target===ov)closeCreate();});
    }
    return {check:check,open:open,bind:bind};
})();
