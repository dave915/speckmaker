'use client';
import {memo, useEffect, useId, useMemo, useRef} from 'react';
import {FRAME_BASE_HEIGHT, FRAME_MAX_HEIGHT, FRAME_WIDTH, screenHtml} from '@/lib/html';
import type {Screen} from '@/lib/types';

export type FrameEvent = {type:string; x?:number; y?:number; deltaX?:number; deltaY?:number; key?:string};

type Props = {
  html:string; screen:Screen; height:number; interactive:boolean;
  onHeight:(height:number)=>void; onEvent:(event:FrameEvent)=>void;
};

export const MockupFrame = memo(function MockupFrame({html,screen,height,interactive,onHeight,onEvent}:Props) {
  const iframe=useRef<HTMLIFrameElement>(null);
  const channel=useId();
  const handlers=useRef({onHeight,onEvent});
  handlers.current={onHeight,onEvent};
  const src=useMemo(()=>screenHtml(html,screen,channel),[html,screen,channel]);
  useEffect(()=>{
    function receive(event:MessageEvent) {
      if(event.source!==iframe.current?.contentWindow || !event.data || event.data.speck!==channel) return;
      const data=event.data;
      if(data.type==='height' && Number.isFinite(data.height)) {
        handlers.current.onHeight(Math.max(FRAME_BASE_HEIGHT,Math.min(FRAME_MAX_HEIGHT,Math.ceil(data.height))));
      } else if(['focus','pointer','pan-start','pan-move','pan-end','zoom','pan-wheel','shortcut'].includes(data.type)) {
        if(['x','y','deltaX','deltaY'].some(key=>data[key]!==undefined&&!Number.isFinite(data[key])))return;
        handlers.current.onEvent(data);
      }
    }
    window.addEventListener('message',receive);
    return()=>window.removeEventListener('message',receive);
  },[channel]);
  return <iframe ref={iframe} title={`${screen.name} 목업`} srcDoc={src} sandbox="allow-scripts" referrerPolicy="no-referrer" tabIndex={interactive?0:-1} style={{width:FRAME_WIDTH,height,pointerEvents:interactive?'auto':'none'}}/>;
});
