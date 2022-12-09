import 'sweetalert2/src/sweetalert2.scss'
import Swal from 'sweetalert2'

import { downloadNebula, getTilesSWPoint, parseNebulaData } from "./map-utils";
import { loadAmap, AMap } from "./amap-loader";
import { clearMarkers, drawMarkers, handleHomeClick, recalc } from './preview';

const DOWNLOAD_ZOOM = 22;

window.onunhandledrejection = e => {
  Swal.fire({
    title: '错误',
    text: e.reason,
    icon: 'error',
    confirmButtonText: 'OK'
  });
}

async function init(key: string) {
  document.getElementById('welcome')!.style.display = 'none';
  
  console.debug('AMap: ', await loadAmap(key));

  const mainLayer = new AMap.createDefaultLayer();
  const buildingLayer = new AMap.Buildings({
    zooms: [2, 30],
    zIndex: 10,
    heightFactor: 1
  });

  const map = new AMap.Map('container', {
    center: [113.262844, 35.187409],
    viewMode: '3D',
    features: ['bg', 'road', 'point'],
    pitchEnable: false,
    rotateEnable: false,
    layers: [mainLayer, buildingLayer],
    zoom: 14
  });

  
  async function caculate(pointEN: Point, pointSW: Point) {
    const realZoom = mainLayer.getSource().ra(DOWNLOAD_ZOOM);
    const tiles = mainLayer.getSource().ha([...pointSW, ...pointEN], realZoom)

    if (tiles.length > 16 || tiles.length === 0) {
      throw `选择范围过大（${tiles.length} 个瓦片），请缩小至 16 个瓦片以内`;
    }

    const data = await downloadNebula(map, tiles, DOWNLOAD_ZOOM)
    console.log('data: ', data);

    let elements = recalc(await parseNebulaData(data));

    // 获取西南方向的基准点
    const swPoint = getTilesSWPoint(tiles);
    
    // 画预览
    drawMarkers({map, elements, swPoint});

    // 打开基准面板
    handleHomeClick(swPoint);
  }


  // 画选择预览框
  let pos1: any = null;
  const polygon = new AMap.Polygon({
    map,
    fillOpacity: 0.4,
    path: []
  });

  map.on('mousemove', (e: any) => {
    if (!pos1) return;
    if ((e.originEvent.buttons & 2) === 0) {
      // 确保第一个点是东北方向，第二个点是西南方向
      caculate(
        [Math.max(pos1.lng, e.lnglat.lng), Math.max(pos1.lat, e.lnglat.lat)],
        [Math.min(pos1.lng, e.lnglat.lng), Math.min(pos1.lat, e.lnglat.lat)]);
      pos1 = null;
      polygon.setPath([]);
      return;
    }
    polygon.setPath([pos1, new AMap.LngLat(e.lnglat.lng, pos1.lat), e.lnglat, new AMap.LngLat(pos1.lng, e.lnglat.lat)]);
    e.originEvent.stopPropagation();
  });

  map.on('mousedown', (e: any) => {
    if (e.originEvent.button !== 2) return;
    pos1 = e.lnglat;
    clearMarkers(map);
    e.originEvent.stopPropagation();
  });
}

async function verifyKey(key: string): Promise<string> {
  const params = new URLSearchParams();
  params.append('flds', 'region');
  params.append('t', '12,3000,1000,2');
  params.append('p', '3');
  params.append('key', key);
  const resp = await fetch('https://vdata.amap.com/nebula/v2' + '?' + params.toString());
  
  let json;
  try {
    json = await resp.json();
  } catch (e) {
    return ''
  }
  
  return json.status === '1' ? '': json.info;
}

window.addEventListener("DOMContentLoaded", async () => {
  const key = localStorage.getItem('amapkey');
  if(key) {
    if(await verifyKey(key) !== '') {
      localStorage.removeItem('amapkey');
    } else {
      init(localStorage.getItem('amapkey')!);
      return;
    }
  }

  document.getElementById('secret-button')!.addEventListener('click', async () => {
    const key = (document.getElementById('secret-input') as HTMLInputElement).value;
    let msg;
    if(key) msg = await verifyKey(key);
    else msg = '请输入正确的高德地图 Key';

    if(msg) {
      Swal.fire({
        title: '验证失败',
        text: msg,
        icon: 'warning',
        showConfirmButton: false,
        timer: 800
      });
      return
    }

    localStorage.setItem('amapkey', key);
    init(key);
  });
});
