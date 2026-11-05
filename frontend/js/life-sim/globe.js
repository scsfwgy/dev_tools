/* Local Natural Earth geometry, projected onto a rotating orthographic globe. */
(function(root){
  'use strict';
  const rad=Math.PI/180;
  function project(lon,lat,centerLon,centerLat){
    const a=(lon-centerLon)*rad,b=lat*rad,c=centerLat*rad;
    return {x:Math.cos(b)*Math.sin(a),y:Math.sin(b)*Math.cos(c)-Math.cos(b)*Math.cos(a)*Math.sin(c),z:Math.sin(b)*Math.sin(c)+Math.cos(b)*Math.cos(a)*Math.cos(c)};
  }
  let dots;
  function landDots(){
    if(dots)return dots;
    const flat=document.createElement('canvas');flat.width=960;flat.height=480;
    const ctx=flat.getContext('2d');
    ctx.fillStyle='#fff';
    for(const path of root.LifeSimGeography.land)ctx.fill(new Path2D(path));
    const pixels=ctx.getImageData(0,0,960,480).data;dots=[];
    for(let y=6;y<478;y+=5)for(let x=2;x<960;x+=5)if(pixels[(y*960+x)*4+3]>100)dots.push([x/960*360-180,90-y/480*180]);
    return dots;
  }
  function mount(canvas){
    const ctx=canvas.getContext('2d');
    if(!ctx)return {land:()=>Promise.resolve(),destroy(){}};
    const points=landDots(),motion=matchMedia('(prefers-reduced-motion: reduce)');
    const css=getComputedStyle(canvas),color=k=>css.getPropertyValue('--life-globe-'+k).trim();
    const palette={ocean:color('ocean'),edge:color('edge'),land:color('land'),grid:color('grid'),pin:color('pin')};
    let frame,stopped=false,settle=null,resolveLand=null,last=0,longitude=100,latitude=14;
    const started=performance.now();
    function line(coords,r,cx,cy){
      ctx.beginPath();let visible=false;
      for(const [lon,lat] of coords){const p=project(lon,lat,longitude,latitude);if(p.z<0){visible=false;continue;}if(visible)ctx.lineTo(cx+p.x*r,cy-p.y*r);else ctx.moveTo(cx+p.x*r,cy-p.y*r);visible=true;}
      ctx.stroke();
    }
    const grid=[];
    for(let lat=-60;lat<=60;lat+=30)grid.push(Array.from({length:121},(_,i)=>[-180+i*3,lat]));
    for(let lon=-180;lon<180;lon+=30)grid.push(Array.from({length:61},(_,i)=>[lon,-90+i*3]));
    function draw(now){
      if(stopped)return;
      const dt=Math.min(now-last,80);last=now;
      if(settle){
        const p=motion.matches?1:Math.min(1,Math.max(0,(now-settle.at)/1450)),ease=1-Math.pow(1-p,3);
        longitude=settle.fromLon+(settle.lon-settle.fromLon)*ease;latitude=settle.fromLat+(settle.lat-settle.fromLat)*ease;
        if(p===1&&now>=settle.at+(motion.matches?0:2050)){const done=resolveLand;resolveLand=null;settle.done=true;done?.();}
      }else if(!motion.matches)longitude+=dt*.018;
      const size=Math.max(1,canvas.clientWidth),dpr=Math.min(devicePixelRatio||1,2);
      if(canvas.width!==Math.round(size*dpr)){canvas.width=canvas.height=Math.round(size*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
      const cx=size/2,cy=size/2,r=size*.405;
      const gradient=ctx.createRadialGradient(cx-r*.3,cy-r*.35,r*.05,cx,cy,r);
      gradient.addColorStop(0,palette.ocean);gradient.addColorStop(1,palette.edge);
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=palette.grid;ctx.lineWidth=.65;ctx.globalAlpha=.55;grid.forEach(path=>line(path,r,cx,cy));
      ctx.fillStyle=palette.land;
      for(const [lon,lat] of points){const p=project(lon,lat,longitude,latitude);if(p.z<=0)continue;ctx.globalAlpha=.25+p.z*.75;const radius=(.65+p.z*.55)*size/420;ctx.beginPath();ctx.arc(cx+p.x*r,cy-p.y*r,radius,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;ctx.strokeStyle=palette.grid;ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
      if(settle?.point){
        const p=project(settle.point.lon,settle.point.lat,longitude,latitude);
        if(p.z>0){const x=cx+p.x*r,y=cy-p.y*r,pulse=motion.matches?12:8+(now%1500)/1500*20;
          ctx.strokeStyle=palette.pin;ctx.fillStyle=palette.pin;ctx.globalAlpha=1-pulse/34;ctx.beginPath();ctx.arc(x,y,pulse,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
      }
      if(!settle?.done&&(!motion.matches||settle))frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    return {
      land(point){
        const valid=Number.isFinite(point?.lon)&&Number.isFinite(point?.lat);
        const target=valid?point.lon:longitude,turn=((target-longitude+540)%360+360)%360-180;
        return new Promise(resolve=>{resolveLand=resolve;settle={at:performance.now()+(motion.matches?0:Math.max(0,1100-(performance.now()-started))),fromLon:longitude,fromLat:latitude,lon:longitude+turn,lat:valid?point.lat:latitude,point:valid?point:null};cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});
      },
      destroy(){stopped=true;cancelAnimationFrame(frame);resolveLand?.();resolveLand=null;}
    };
  }
  const api={mount,project};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LifeSimGlobe=api;
})(typeof globalThis!=='undefined'?globalThis:this);
