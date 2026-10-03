import { inflateSync } from 'node:zlib';
// Chromium screenshots are non-interlaced 8-bit RGB/RGBA PNGs. Decode only
// those formats and fail explicitly for others; no image-processing dependency.
export function pngRegion(buffer,rect,excluded=[]){
 const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),depth=buffer[24],type=buffer[25],channels=type===2?3:type===6?4:0;
 if(depth!==8||!channels||buffer[28]!==0)throw new Error('Expected non-interlaced 8-bit RGB/RGBA PNG');
 const chunks=[];for(let offset=8;offset<buffer.length;){const length=buffer.readUInt32BE(offset),name=buffer.toString('ascii',offset+4,offset+8);if(name==='IDAT')chunks.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(height*stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const source=y*(stride+1),filter=raw[source];for(let x=0;x<stride;x++){const left=x>=channels?pixels[y*stride+x-channels]:0,up=y?pixels[(y-1)*stride+x]:0,corner=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0;let prediction;if(filter===0)prediction=0;else if(filter===1)prediction=left;else if(filter===2)prediction=up;else if(filter===3)prediction=Math.floor((left+up)/2);else if(filter===4)prediction=paeth(left,up,corner);else throw new Error('Unknown PNG filter');pixels[y*stride+x]=(raw[source+1+x]+prediction)&255;}}
 const colors=new Set();let count=0,excludedPixels=0,nonBlack=0,bright=0,min=255,max=0;
 const box=rect||{x:0,y:0,width,height};for(let y=Math.max(0,Math.ceil(box.y+2));y<Math.min(height,Math.floor(box.y+box.height-2));y++)for(let x=Math.max(0,Math.ceil(box.x+2));x<Math.min(width,Math.floor(box.x+box.width-2));x++){if(excluded.some(mask=>x>=Math.floor(mask.x)&&x<=Math.ceil(mask.x+mask.width)&&y>=Math.floor(mask.y)&&y<=Math.ceil(mask.y+mask.height))){excludedPixels++;continue;}const i=y*stride+x*channels,r=pixels[i],g=pixels[i+1],b=pixels[i+2];colors.add((r<<16)|(g<<8)|b);count++;const light=Math.max(r,g,b);if(light>0)nonBlack++;if(light>32)bright++;min=Math.min(min,light);max=Math.max(max,light);}
 return {width,height,region:box,excluded,pixels:count,excludedPixels,colors:colors.size,nonBlack,bright,min,max};
}

export async function captureCamel(page,target){
 await page.locator('#gl').scrollIntoViewIfNeeded();
 // Camel renders in its existing animation-frame callback. Read in the next
 // callback before buffer discard, after a real draw, rather than sleeping.
 const live=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector('#gl'),type=window.__webgl.find(entry=>entry.canvas==='gl').type,gl=canvas.getContext(type);
  const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const colors=new Set();let bright=0;
  for(let i=0;i<pixels.length;i+=4){colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>32)bright++;}
  const rect=canvas.getBoundingClientRect();
  // DOM captions, legend gradients and labels can look colorful while the
  // underlying WebGL layer is blank. Exclude their actual visible rectangles,
  // expanded by 12 CSS pixels to cover borders, shadows and backdrop blur.
  const overlayPadding=12,overlays=[...document.querySelectorAll('.stage .caption,.stage .legend,.stage .axis-label')].flatMap(element=>{const box=element.getBoundingClientRect(),style=getComputedStyle(element);if(!box.width||!box.height||style.visibility==='hidden'||style.display==='none'||+style.opacity===0||box.right<=rect.left||box.left>=rect.right||box.bottom<=rect.top||box.top>=rect.bottom)return [];const bounds={x:box.x+scrollX,y:box.y+scrollY,width:box.width,height:box.height};return [{selector:element.id?'#'+element.id:'.'+element.className,rect:bounds,excluded:{x:bounds.x-overlayPadding,y:bounds.y-overlayPadding,width:bounds.width+2*overlayPadding,height:bounds.height+2*overlayPadding}}];});
  resolve({contextLost:gl.isContextLost(),glError:gl.getError(),pixels:pixels.length/4,colors:colors.size,bright,buffer:[canvas.width,canvas.height],rect:{x:rect.x+scrollX,y:rect.y+scrollY,width:rect.width,height:rect.height},overlays,overlayPadding,scroll:{x:scrollX,y:scrollY},viewport:{width:innerWidth,height:innerHeight},canvasFullyInView:rect.top>=-1&&rect.bottom<=innerHeight+1&&rect.left>=-1&&rect.right<=innerWidth+1});
 })));
 if(live.contextLost||live.glError||live.colors<100||live.bright<100||!live.canvasFullyInView){await page.screenshot({path:target,fullPage:true});throw new Error(`Camel canvas is not ready for capture: ${JSON.stringify(live)}`);}
 const buffer=await page.screenshot({path:target,fullPage:true});
 const scale=buffer.readUInt32BE(16)/live.viewport.width;
 const scaled=rect=>Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,value*scale]));
 const saved=pngRegion(buffer,scaled(live.rect),(live.overlays||[]).map(overlay=>scaled(overlay.excluded)));
 if(saved.colors<100||saved.bright<100)throw new Error(`Saved Camel canvas is blank: ${JSON.stringify({target,live,saved})}`);
 return {live,saved};
}
