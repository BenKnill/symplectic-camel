// Plain action data can also be driven through a native Windows browser's CDP.
// The controllers remain responsible for the simulation; these are operator inputs.
const click=(selector,ifVisible=false)=>({type:'click',selector,ifVisible});
const range=(selector,value)=>({type:'range',selector,value});
const wait=ms=>({type:'wait',ms});
export function canonicalActions(name,scene){
  if(name==='camel')return scene===3?[click('#play')]:[];
  if(name==='lattice')return scene===3?Array.from({length:4},()=>[click('#half-next'),wait(1000)]).flat():[];
  if(name==='rhine')return [
    [click('#illustrationToggle',true),click('#showSpins',true),wait(800),click('#waterView',true)],
    [range('#dipG',40),wait(1200),range('#dipG',80)],
    [click('#loopPair'),range('#loopX',0),range('#loopRadius',3)],
    [click('[data-line="arch"]')],
    [range('#light',5),wait(1200),range('#light',95)],
    [],
  ][scene].concat(click('#reveal-result'));
  if(name==='soap')return [
    [click('#soap-reveal')],
    [click('#soap-compare'),wait(4000),click('#soap-dip')],
    [{type:'drag',selector:'#film',from:[.60,.55],to:[.30,.45],steps:36,durationMs:2200},click('#soap-highlight')],
    [click('#soap-frame')],
  ][scene];
  throw new Error(`Unknown presentation: ${name}`);
}
export function actionDescription(name,scene){
  if(name==='camel')return scene===3?'animate nonlinear map':null;
  if(name==='lattice')return scene===3?'kick, drift, undo drift, undo kick; every identity home':null;
  if(name==='rhine')return ['compare labelled model, reveal spins, view from above','double circulation 40 to 80','opposite pair, centre loop x=0, radius=3','surface arch','move reflection 5 to 95','compare evidence'][scene];
  if(name==='soap')return ['reveal settled seeded Steiner network','show explicit five-side competitor, then second fixed dip','rotate the relaxed tetrahedron, then highlight its triple junctions','change wire frame and distinguish theorem from numerical illustration'][scene];
  throw new Error(`Unknown presentation: ${name}`);
}
export async function performActions(page,actions){
  for(const action of actions){
    if(action.type==='wait')await page.waitForTimeout(action.ms);
    else if(action.type==='click'){
      const target=page.locator(action.selector);
      if(!action.ifVisible||await target.isVisible())await target.click();
    }else if(action.type==='range')await page.locator(action.selector).evaluate((element,value)=>{element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},action.value);
    else if(action.type==='drag'){
      const target=page.locator(action.selector);await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
      if(!box)throw new Error(`Drag target has no visible rectangle: ${action.selector}`);
      const point=fraction=>({x:box.x+box.width*fraction[0],y:box.y+box.height*fraction[1]});
      const from=point(action.from),to=point(action.to);
      await page.mouse.move(from.x,from.y);await page.mouse.down();
      for(let step=1;step<=action.steps;step++){await page.mouse.move(from.x+(to.x-from.x)*step/action.steps,from.y+(to.y-from.y)*step/action.steps);await page.waitForTimeout(action.durationMs/action.steps);}
      await page.mouse.up();
    }
    else throw new Error(`Unknown operator action: ${action.type}`);
  }
}
