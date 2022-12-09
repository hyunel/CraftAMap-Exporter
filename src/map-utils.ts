import { invoke } from "@tauri-apps/api";
import Swal from "sweetalert2";

interface Tile {
    x: number;
    y: number;
    z: number;
}

interface Layer {
    d: any
    t: number
    type: number
    x: number
    y: number
    z: number
}

interface TileData {
    layers: Array<Layer>;
    t: number;
    x: number;
    y: number;
    z: number;
}

interface NebulaData {
    db: string
    status: boolean
    tiles: Array<TileData>
    version: string
}

export function downloadNebula(map: any, tiles: any, zoom: number): Promise<NebulaData> {
    return new Promise((resolve, reject)=>{
        map.gn.Uh.send('loadNebulaSourceTile', {
            "url": "https://vdata.amap.com/nebula/v3",
            "zoom": zoom,
            "optimalZoom": zoom,
            "projectionId": "EPSG:3857",
            "mS": {
                "buildingColor": {}
            },
            "viewMode": "3D",
            "showBuildingBlock": true,
            // z, x, y, type
            // type: 0: lite, 1: left, 2: all/other
            "ya": tiles.map((i: any)=>i.key+',2'),
            // zoom
            "ZL": zoom,
            "hH": "road,building,region,poi,roadname",
            // firstLabelDataAllLoaded
            "kZ": true
        }, (err: any, data: any)=> err? reject(err) : resolve(AMap._YUN.KQ(data.rawData)));
    });
}

export function getTilesSWPoint(tiles: Array<Tile>): Point {
    const lnglat = tiles.map(tile=>AMap._YUN.XY(tile, tile.z, 0, 0))
    return [Math.min(...lnglat.map((i: any)=>i[0])), Math.min(...lnglat.map((i: any)=>i[1]))]
}


type Path = Array<Point>; 
export interface Road {
    mainkey: number
    subkey: number
    weight: number
    path: Path
}
export interface Building {
    mainkey: number
    subkey: number
    height: number
    altitude: number
    path: Array<Path>
}
export interface Region {
    previewColor: string
    blockState: string
    mainkey: number
    subkey: number
    path: Array<Path>
}
export interface POI {
    mainkey: number
    subkey: number
    rank: number
    name: string
    pos: Point
    z: number
}
export interface RoadName {
    mainkey: number
    subkey: number
    shieldType: number
    rank: number
    name: string
    path: Path
}
export interface Elements {
    roads: Array<Omit<Road, 'weight'>>
    buildings: Array<Building>
    regions: Array<Omit<Region, 'previewColor' | 'blockState'>>
    pois: Array<POI>
    roadnames: Array<RoadName>
}

export interface ParsedElements {
    roads: Array<Road>
    buildings: Array<Building>
    regions: Array<Region>
    pois: Array<POI>
    roadnames: Array<RoadName>
}



export async function parseNebulaData(data: NebulaData): Promise<Elements> {
    const elements: Elements = {
        roads: [],
        buildings: [],
        regions: [],
        pois: [],
        roadnames: []
    }

    const layerTypeMap: Record<number, string> = {
        0: "poilabel",
        1: "road",
        2: "region",
        3: "building",
        4: "roadName",
    }

    for (const tile of data.tiles) {
        for (const layer of tile.layers) {
            for (const p of layer.d[layerTypeMap[layer.type]]) {
                
                for (const item of p.items) {
                    if(layerTypeMap[layer.type] === 'building') {
                        elements.buildings.push({
                            mainkey: p.mainkey,
                            subkey: p.subkey,
                            height: item.height,
                            altitude: item.altitude,
                            path: item.path.map((path: any)=>{
                                const temp = [];
                                for (let i = 0; i < path.path.length; i += 2) {
                                    temp.push(AMap._YUN.XY(layer, p.resolution, path.path[i], path.path[i + 1]));
                                }
                                return temp;
                            })
                        });
                    } else if(layerTypeMap[layer.type] === 'region') {
                        elements.regions.push({
                            mainkey: p.mainkey,
                            subkey: p.subkey,
                            path: item.path.map((path: any)=>{
                                const temp = [];
                                for (let i = 0; i < path.path.length; i += 2) {
                                    temp.push(AMap._YUN.XY(layer, p.resolution, path.path[i], path.path[i + 1]));
                                }
                                return temp;
                            })
                        });
                    } else if(layerTypeMap[layer.type] === 'road') {
                        const temp = [];
                        for (let i = 0; i < item.path.length; i += 2) {
                            temp.push(AMap._YUN.XY(layer, p.resolution, item.path[i], item.path[i + 1]));
                        }
                        elements.roads.push({
                            mainkey: p.mainkey,
                            subkey: p.subkey,
                            path: temp
                        });
                    } else if(layerTypeMap[layer.type] === 'poilabel') {
                        elements.pois.push({
                            mainkey: p.mainkey,
                            subkey: p.subkey,
                            rank: item.rank,
                            name: item.name,
                            z: item.pos[2],
                            pos: AMap._YUN.XY(layer, p.resolution, item.pos[0], item.pos[1])
                        });
                    } else if(layerTypeMap[layer.type] === 'roadName') {
                        let path = [];
                        if(item.shield) {
                            path = [AMap._YUN.XY(layer, p.resolution, item.path[0], item.path[1])];
                        } else {
                            for (let i = 0; i < item.path.length; i += 2) {
                                path.push(AMap._YUN.XY(layer, p.resolution, item.path[i], item.path[i + 1]));
                            }
                        }
                        elements.roadnames.push({
                            mainkey: p.mainkey,
                            subkey: p.subkey,
                            rank: item.rank,
                            name: item.shield ? item.shield : item.name,
                            shieldType: item.shieldType,
                            path
                        });
                    }
                }
            }
        }
    }
    elements.regions = elements.regions.reverse();
    return elements;
}

type StyleMap = Array<{mainkey: number, subkey?: Array<number>}>;
const roadWeightMap: Array<{
    weight: number
    styleMap: StyleMap
}> = [
    {
        weight: 1,
        styleMap: [{ mainkey: 20017, subkey: [1] }]
    },
    {
        weight: 3,
        styleMap: [{ mainkey: 20009, subkey: [1] }]
    },
    {
        weight: 4,
        styleMap: [{ mainkey: 20008, subkey: [1] }]
    },
    {
        weight: 5,
        styleMap: [{ mainkey: 20007, subkey: [1] }]
    },
    {
        weight: 6,
        styleMap: [{ mainkey: 20003, subkey: [1] }]
    }
];

const regionTypeMap: Array<{
    previewColor?: string
    blockState: string
    styleMap: StyleMap
}> = [
    // green
    {
        previewColor: '#00ff00',
        blockState: 'minecraft:grass_block',
        styleMap: [{ mainkey: 30001, subkey: [3, 7, 8, 9, 10, 12, 37] }]
    },
    // water
    {
        previewColor: '#0000ff',
        blockState: 'minecraft:water[level=0]',
        styleMap: [
            { mainkey: 30001, subkey: [6] },
            { mainkey: 10002, subkey: [38] },
            { mainkey: 30001, subkey: [2, 11, 13] },
            { mainkey: 20014 },
            { mainkey: 10002, subkey: [13] },
        ]
    },
    // playground
    {
        previewColor: '#f58d60',
        blockState: 'minecraft:orange_concrete',
        styleMap: [
            {
                mainkey: 30002,
                subkey: [9, 10, 13],
            }
        ]
    },
    // playground-inner
    {
        previewColor: '#46a629',
        blockState: 'minecraft:green_concrete',
        styleMap: [
            {
                mainkey: 30002,
                subkey: [19, 20, 21, 34, 37, 39],
            }
        ]
    },
    // school
    {
        blockState: 'minecraft:stone',
        styleMap: [
            {
                mainkey: 30002,
                subkey: [ 3 ],
            }
        ]
    }
];

export type RegionTypeMap = typeof regionTypeMap;
export type RoadWeightMap = typeof roadWeightMap;

export function setStyleMap(mainkey: number, subkey: number, styleMaps: any, newData: any) {
    for (const item of styleMaps) {
        for (const style of item.styleMap) {
            if(style.mainkey === mainkey && style.subkey.includes(subkey)) {
                style.subkey = style.subkey.filter((key: number) => key !== subkey);
            }
        }
    }

    if(newData) {
        let styleMap: StyleMap = [{
            mainkey,
            subkey: [subkey]
        }];
    
        styleMaps.push({
            styleMap,
            ...newData
        })
    }
}

function getStyleMap(mainkey: number, subkey: number, styleMaps: any) {
    for (const item of styleMaps) {
        for (const style of item.styleMap) {
            if(style.mainkey === mainkey && (!style.subkey || style.subkey.includes(subkey))) {
                return item;
            }
        }
    }
    return undefined;
}

function getRegionType(mainkey: number, subkey: number, regionTypeOverride: RegionTypeMap = []) {
    let type = getStyleMap(mainkey, subkey, regionTypeOverride);
    if(type) return type;

    type = getStyleMap(mainkey, subkey, regionTypeMap);
    if(type && !type.previewColor) type.previewColor = '';

    return type || {
        previewColor: '',
        blockState: ''
    };
}

function getRoadWeight(mainkey: number, subkey: number, roadWeightOverride: RoadWeightMap=[]): number {
    let type = getStyleMap(mainkey, subkey, roadWeightOverride);
    if(type) return type.weight;

    type = getStyleMap(mainkey, subkey, roadWeightMap);
    return type ? type.weight : 3;
}

export function parseElements(elements: Elements, roadWeightOverride: RoadWeightMap=[], regionTypeOverride: RegionTypeMap=[]): ParsedElements {
    const result = elements as ParsedElements;

    for (const region of result.regions) {
        const regionType = getRegionType(region.mainkey, region.subkey, regionTypeOverride);
        region.previewColor = regionType.previewColor;
        region.blockState = regionType.blockState;
    }

    for (const road of result.roads) {
        road.weight = getRoadWeight(road.mainkey, road.subkey, roadWeightOverride);
    }
    return result;
}

export function remapCoordinates(map: any, elements: ParsedElements, basePoint: Point): ParsedElements {
    const projection = map.getProjection();
    const basePointCoord = projection.project(...basePoint);

    function remapPoint(point: Point): Point {
        const pointCoord = projection.project(...point);
        return [pointCoord[0] - basePointCoord[0], pointCoord[1] - basePointCoord[1]];
    }
    for (const building of elements.buildings) {
        building.path = building.path.map(path=>path.map(point=>remapPoint(point)));
    }
    for (const region of elements.regions) {
        region.path = region.path.map(path=>path.map(point=>remapPoint(point)));
    }
    for (const road of elements.roads) {
        road.path = road.path.map(point=>remapPoint(point));
    }
    for (const poi of elements.pois) {
        poi.pos = remapPoint(poi.pos);
    }
    for (const roadname of elements.roadnames) {
        roadname.path = roadname.path.map(point=>remapPoint(point));
    }
    return elements;
}

export interface MapContext {
    map: any;
    swPoint: Point;
    elements: ParsedElements;
}

export async function exportMap(context: MapContext) {
    let {map, elements, swPoint} = context;
    
    // 复制一份避免修改原始对象
    elements = JSON.parse(JSON.stringify(elements));

    // 投影，并以基准点为原点（0, 0）重映射坐标
    elements = remapCoordinates(map, elements, swPoint);

    const fileName: string = await invoke('export', { elements: JSON.stringify(elements) });

    console.debug('-----------------------------------');
    console.debug('Exported data to', fileName, ':');
    console.debug('buildings: ', elements.buildings);
    console.debug('roads: ', elements.roads);
    console.debug('roadnames: ', elements.roadnames);
    console.debug('pois: ', elements.pois);
    console.debug('regions: ', elements.regions);
    console.debug('-----------------------------------');

    Swal.fire({
        title: '导出成功',
        text: '已导出到 ' + fileName,
        icon: 'success',
        showConfirmButton: false,
        timer: 1500
    });
}