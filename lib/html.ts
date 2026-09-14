import type {Screen} from './types';
const candidates=['[role="tab"]','[data-bs-toggle="tab"], [data-toggle="tab"]','button[data-tab], a[data-tab], [data-tab-target]', '.tabs .tab, .tab-bar .tab, .tab-nav button, .tab-buttons button, .tabs button, .tab-btn, .tab-button, .tab','button[onclick*="Tab"], button[onclick*="tab"], a[onclick*="Tab"], a[onclick*="tab"]'];
export function detectScreens(html:string):Screen[]{
 const doc=new DOMParser().parseFromString(html,'text/html');
 for(const selector of candidates){
  const tabs=[...doc.querySelectorAll(selector)];
  if(tabs.length>1)return tabs.slice(0,12).map((tab,index)=>({name:tab.textContent?.trim().slice(0,60)||`화면 ${index+1}`,selector,index,panelId:tab.getAttribute('aria-controls')||tab.getAttribute('data-bs-target')?.replace(/^#/,'')||tab.getAttribute('data-target')?.replace(/^#/,'')||undefined}));
 }
 return [{name:doc.title||'기본 화면'}];
}
export function screenHtml(html:string,screen:Screen):string{
 const config=JSON.stringify(screen).replaceAll('<','\\u003c');
 const script=`<script>(function(){var s=${config};function activate(){try{var b=s.selector?document.querySelectorAll(s.selector)[s.index||0]:null;if(b){b.click();if(!s.panelId){var href=b.getAttribute('href');if(href&&href[0]==='#')s.panelId=href.slice(1);}}if(s.panelId){var p=document.getElementById(s.panelId);if(p){var group=p.parentElement;Array.from(group.children).forEach(function(x){if(x===p||x.getAttribute('role')==='tabpanel'||x.classList.contains('tab-pane')||x.classList.contains('tab-content')||x.classList.contains('tab-panel')){x.hidden=x!==p;if(x===p){x.style.removeProperty('display');if(getComputedStyle(x).display==='none')x.style.setProperty('display','block','important');x.classList.add('active','show');}else{x.style.setProperty('display','none','important');x.classList.remove('active','show');}}});}}}catch(e){}}if(document.readyState==='complete')activate();else window.addEventListener('load',activate);setTimeout(activate,250);setTimeout(activate,900);})();<\/script>`;
 const csp='<meta http-equiv="Content-Security-Policy" content="base-uri \'none\'; form-action \'none\'; object-src \'none\'">';
 // No same-origin, popups, forms, or top navigation are granted to these frames.
 return html.replace(/<head([^>]*)>/i,`<head$1>${csp}`)+script;
}
