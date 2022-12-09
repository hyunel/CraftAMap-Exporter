import HomeIcon from "./assets/home.svg";
import { Elements, exportMap, MapContext, ParsedElements, parseElements, Region, RegionTypeMap, Road, RoadWeightMap, setStyleMap } from "./map-utils";

let markers: Array<any> = [];
let lastContext: Partial<MapContext> = {};
let regionTypeOverride: RegionTypeMap = [];
let roadWeightOverride: RoadWeightMap = [];

let infoWindow: any = null;
async function openInfoWindow(e: any, className: string, callback?: (el: HTMLDivElement)=>void) {
  if(infoWindow) infoWindow.close();
  
  infoWindow = new AMap.InfoWindow({
    isCustom: true,
    content: document.querySelector(`#infowindowDOM .${className}`)!.cloneNode(true),
    offset: new AMap.Pixel(24, -8)
  });
  infoWindow.open(lastContext!.map, e.lnglat);
  const el = infoWindow.getContent() as HTMLDivElement;
  
  const closeBtn = el.querySelector(".close") as HTMLButtonElement | null;
  if(closeBtn) closeBtn.addEventListener("click", () => infoWindow.close());
  callback && callback(el);
}

async function handleRegionClick(region: Region, e: any) {
  console.debug("region: ", region, e);
  openInfoWindow(e, "region", el => {
    el.querySelector('.region-size')!.textContent = region.path.map(i=>i.length).reduce((a, b) => a + b, 0).toString();
    el.querySelector('.region-mainkey')!.textContent = region.mainkey.toString();
    el.querySelector('.region-subkey')!.textContent = region.subkey.toString();
    const regionColor = el.querySelector('.region-color')! as HTMLInputElement;
    regionColor.value = region.previewColor;
    regionColor.onfocus = () => {
      const picker = el.querySelector('.region-color-picker') as HTMLInputElement;
      picker.oninput = () => regionColor.value = picker.value;
      picker.click();
    }
    regionColor.onblur = () => {
      if(region.previewColor === regionColor.value) return;
      setStyleMap(region.mainkey, region.subkey, regionTypeOverride, {
        blockState: region.blockState,
        previewColor: regionColor.value
      });
      redraw();
    }

    const regionBlockState = el.querySelector('.region-blockstate')! as HTMLInputElement;
    regionBlockState.value = region.blockState;
    regionBlockState.onblur = () => {
      if(region.blockState === regionBlockState.value) return;
      setStyleMap(region.mainkey, region.subkey, regionTypeOverride, {
        blockState: regionBlockState.value,
        previewColor: region.previewColor
      });
      redraw();
    }
  });
}

async function handleRoadClick(road: Road, e: any) {
  console.debug("road: ", road, e);
  openInfoWindow(e, "road", el => {
    el.querySelector('.road-size')!.textContent = road.path.length.toString();
    el.querySelector('.road-mainkey')!.textContent = road.mainkey.toString();
    el.querySelector('.road-subkey')!.textContent = road.subkey.toString();
    const roadWeight = el.querySelector('.road-weight')! as HTMLInputElement;
    roadWeight.placeholder = road.weight.toString();
    roadWeight.onblur = () => {
      if(!roadWeight.value) roadWeight.value = '3';
      if(road.weight === parseInt(roadWeight.value)) return;

      setStyleMap(road.mainkey, road.subkey, roadWeightOverride, {
        weight: parseInt(roadWeight.value)
      });
      redraw();
    }
  });
}

export async function handleHomeClick(swPoint: Point) {
  console.debug("swPoint: ", swPoint);
  openInfoWindow({ lnglat: new AMap.LngLat(...swPoint) }, "home", el => {
    el.querySelector('.home-pos')!.textContent = `${swPoint[0].toFixed(2)},${swPoint[1].toFixed(2)}`;
    el.querySelector('.home-regions')!.textContent = lastContext.elements!.regions.length.toString();
    el.querySelector('.home-roads')!.textContent = lastContext.elements!.roads.length.toString();
    el.querySelector('.home-buildings')!.textContent = lastContext.elements!.buildings.length.toString();
    el.querySelector('.home-roadnames')!.textContent = lastContext.elements!.roadnames.length.toString();
    el.querySelector('.home-pois')!.textContent = lastContext.elements!.pois.length.toString();

    el.querySelector('.clear')!.addEventListener('click', () => {
      infoWindow.close();
      clearMarkers(lastContext!.map);
    });

    el.querySelector('.export')!.addEventListener('click', () => {
      infoWindow.close();
      exportMap({map: lastContext.map!, elements: lastContext.elements!, swPoint: lastContext.swPoint!});
    });
  });
}

export function recalc(elements?: Elements): ParsedElements {
  return lastContext!.elements = parseElements(elements??lastContext.elements!, roadWeightOverride, regionTypeOverride);
}

function redraw() {
  recalc();
  clearMarkers(lastContext.map);
  drawMarkers({map: lastContext.map!, elements: lastContext.elements!, swPoint: lastContext.swPoint!});
}

export function clearMarkers(map: any) {
  infoWindow && infoWindow.close();
  markers.forEach((i) => map.remove(i));
  markers = [];
}

export function drawMarkers(context: MapContext) {
  lastContext = context;
  const {map, elements, swPoint} = context;

  markers.push(
    new AMap.Marker({
      position: swPoint,
      anchor: "center",
      icon: HomeIcon,
    })
  );
  markers[0].on("click", handleHomeClick.bind(map, swPoint));

  for (const region of elements.regions) {
    for (const path of region.path) {
      const fillColor = region.previewColor || "#333333";
      const polygon = new AMap.Polygon({
        path: path.map((i) => new AMap.LngLat(...i)),
        fillColor: fillColor,
        fillOpacity: region.previewColor ? 1 : 0.2,
        strokeWeight: 0,
      });
      polygon.on("click", handleRegionClick.bind(map, region));
      markers.push(polygon);
    }
  }

  for (const building of elements.buildings) {
    for (const path of building.path) {
      const polygon = new AMap.Polygon({
        path: path.map((i) => new AMap.LngLat(...i)),
        fillColor: "#0084ff",
        fillOpacity: 0.3,
        strokeWeight: 0,
      });
      markers.push(polygon);
    }
  }

  for (const road of elements.roads) {
    const polyline = new AMap.Polyline({
      path: road.path.map((i) => new AMap.LngLat(...i)),
      borderWeight: 2,
      strokeColor: "#b300ff",
      strokeOpacity: 0.3,
      lineJoin: "round",
    });
    polyline.on("click", handleRoadClick.bind(map, road));
    markers.push(polyline);
  }

  markers.forEach((i) => map.add(i));
}
