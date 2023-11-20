import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { polyline } from "leaflet";
import "./leafletWorkaround";
import { Board, Cache, Cell, Coins } from "./board";
import murmur32 from "murmur-32";

function luck(situation: string): number {
  const LARGE_INTEGER = 1 << 30;
  return (
    (new DataView(murmur32(situation)).getUint32(0) % LARGE_INTEGER) /
    LARGE_INTEGER
  );
}

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 10;

class CoordinateConverter {
  static convertToGameCell(lat: number, lng: number): { i: number; j: number } {
    const i = Math.floor((lat - MERRILL_CLASSROOM.lat) / TILE_DEGREES);
    const j = Math.floor((lng - MERRILL_CLASSROOM.lng) / TILE_DEGREES);
    return { i, j };
  }
}

const mapContainer = document.querySelector<HTMLElement>("#map")!;
const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM, // Set Merrill College as the initial center
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
  })
  .addTo(map);

const clearedLocations = new Set();
let playerCoins: Coins[] = [];
const currentMap: Board = new Board();
const cacheList: Map<string, Cache> = new Map<string, Cache>();
const cacheMap: Map<Cell, [leaflet.Layer, boolean]> = new Map<
  Cell,
  [leaflet.Layer, boolean]
>();
let movements: leaflet.LatLng[] = [];
let polylineArray: leaflet.Polyline[] = [];
const south = document.getElementById("south");
const north = document.getElementById("north");
const east = document.getElementById("east");
const west = document.getElementById("west");
const liveSensor = document.getElementById("sensor");
const reset = document.getElementById("reset");

currentMap.getGridCell(MERRILL_CLASSROOM.lat, MERRILL_CLASSROOM.lng);
const playerMarker = leaflet.marker(MERRILL_CLASSROOM);

movements.push(playerMarker.getLatLng());
let playerPath = polyline(movements, { color: `blue` });
polylineArray.push(playerPath);

playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
if (playerCoins.length > 0) {
  statusPanel.innerHTML = `${playerCoins.length} points accumulated`;
} else {
  statusPanel.innerHTML = "Not enough points accumulated";
}

function makePit(lat: number, lng: number) {
  const { i, j } = CoordinateConverter.convertToGameCell(lat, lng);
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  const point = currentMap.getGridCell(lat, lng);

  const key: string = `${point.x}_${point.y}`;
  cacheList.set(key, new Cache(point));
  const pit = leaflet.rectangle(bounds) as leaflet.Layer;
  cacheMap.set(point, [pit, true]);

  if (localStorage.getItem(JSON.stringify(point)) == null) {
    const value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    for (let iter = 0; iter < value; iter++) {
      cacheList.get(key)?.addCoin();
    }
    localStorage.setItem(
      JSON.stringify(point),
      cacheList.get(key)!.toMomento()
    );
  } else {
    const value = localStorage.getItem(JSON.stringify(point));
    cacheList.get(key)?.fromMomento(value!);
  }

  pit.bindPopup(() => {
    const cachePoint = JSON.stringify(point);
    const stringAdd: string[] | undefined = cacheList.get(key)?.format();
    let content = `<div>There is a pit here at "${lat.toFixed(4)}:${lng.toFixed(
      4
    )}". It has value <span id="value">${
      localStorage.getItem(cachePoint)!.split(",").length
    }</span>.</div>
                  <p>Available Cache:</p>
                  <div id="scrollableContainer" style="max-height: 150px; overflow-y: auto;">`;
    for (
      let i = 0;
      i < localStorage.getItem(cachePoint)!.split(",").length;
      i++
    ) {
      if (stringAdd) {
        content += `<p>${stringAdd[i]}   <button id="collect">Grab</button></p>`;
      }
    }
    content += `</div><button id="deposit">Put</button>`;

    const container = document.createElement("div");
    container.innerHTML = content;

    const collects = container.querySelectorAll<HTMLButtonElement>("#collect")!;
    collects.forEach((collect, index) => {
      collect.addEventListener("click", () => {
        const curValue = localStorage.getItem(cachePoint)?.split(",");

        if (curValue && curValue.length > index) {
          const [x, y, serial] = curValue[index].split("#").map(Number);

          playerCoins.push({ coord: { x, y }, serial });
          localStorage.setItem(
            `player`,
            (localStorage.getItem(`player`) ?? "") + curValue[index] + ","
          );

          curValue.splice(index, 1);
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            curValue.length.toString();
          statusPanel.innerHTML = `${playerCoins.length} points accumulated`;

          localStorage.setItem(JSON.stringify(point), curValue.join(","));
          cacheList.get(key)?.fromMomento(curValue.join(","));
          messageChange(curValue.length, curValue);
        }
      });
    });

    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      const curValue = localStorage.getItem(cachePoint)?.split(",");
      const chosenCoin = playerCoins[playerCoins.length - 1];
      const temp = `${chosenCoin.coord.x}#${chosenCoin.coord.y}#${chosenCoin.serial}`;
      curValue?.push(temp);
      playerCoins.splice(playerCoins.length - 1, 1);

      container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
        curValue!.length.toString();
      if (playerCoins.length == 0) {
        statusPanel.innerHTML = `No points accumulated`;
      } else {
        statusPanel.innerHTML = `${playerCoins.length} points accumulated`;
      }
      //momentos.set(point, curValue.toString());
      localStorage.setItem(JSON.stringify(point), curValue!.join(","));
      cacheList.get(key)?.fromMomento(curValue!.join(","));
      messageChange(
        localStorage.getItem(cachePoint)!.split(",").length,
        curValue!
      );
    });
    return container;
  });

  pit.addTo(map);
}

function messageChange(value: number, list: string[]) {
  const temp = document.getElementById(`scrollableContainer`);
  let content = ``;
  for (let iter = 0; iter < value; iter++) {
    if (list) {
      content += `<p>${list[iter]}   <button id="collect">collect</button></p>`;
    }
  }
  if (temp) {
    temp.innerHTML = content;
  }
}

function pitSpawn() {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const lat = playerMarker.getLatLng().lat + i * TILE_DEGREES;
      const lng = playerMarker.getLatLng().lng + j * TILE_DEGREES;
      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      //clearedLocations.add(key);

      if (
        Math.random() * 100 <= PIT_SPAWN_PROBABILITY &&
        !clearedLocations.has(key)
      ) {
        makePit(lat, lng);
      }

      clearedLocations.add(key);
    }
  }
}

pitSpawn();

function updateMap() {
  //console.log("Updating map...");

  const playerCell: Cell = currentMap.getGridCell(
    playerMarker.getLatLng().lat,
    playerMarker.getLatLng().lng
  );

  //console.log("Player Cell:", playerCell);

  cacheMap.forEach((cache, cell) => {
    //console.log("Cache Cell:", cell);

    const distanceX = Math.abs(cell.x - playerCell.x);
    const distanceY = Math.abs(cell.y - playerCell.y);

    //console.log("Distance X:", distanceX);
    //console.log("Distance Y:", distanceY);

    const inRangeX = distanceX <= NEIGHBORHOOD_SIZE;
    const inRangeY = distanceY <= NEIGHBORHOOD_SIZE;

    //console.log("In Range X:", inRangeX);
    //console.log("In Range Y:", inRangeY);

    if (!inRangeX || !inRangeY) {
      // If outside the NEIGHBORHOOD_SIZE in either X or Y direction, remove it
      if (cache[1]) {
        cache[0].remove();
        cache[1] = false;
      }
    } else {
      // If inside the NEIGHBORHOOD_SIZE, add it if it's not already added
      if (!cache[1]) {
        cache[0].addTo(map);
        cache[1] = true;
      }
    }
  });

  //console.log("Map updated!");
}

liveSensor?.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());

    pitSpawn();
    updateMap();
  }),
    function error() {
      alert(`Please enable your GPS position feature.`);
    },
    { maximumAge: 10000, timeout: 5000, enableHighAccuracy: true };
});
south?.addEventListener("click", () => {
  playerMarker.setLatLng({
    lat: playerMarker.getLatLng().lat - 0.0001,
    lng: playerMarker.getLatLng().lng,
  });
  map.setView(playerMarker.getLatLng());
  movements.push(playerMarker.getLatLng());
  playerPath = polyline(movements, { color: `blue` }).addTo(map);
  polylineArray.push(playerPath);
  pitSpawn();
  updateMap();
});

north?.addEventListener("click", () => {
  playerMarker.setLatLng({
    lat: playerMarker.getLatLng().lat + 0.0001,
    lng: playerMarker.getLatLng().lng,
  });
  map.setView(playerMarker.getLatLng());
  movements.push(playerMarker.getLatLng());
  playerPath = polyline(movements, { color: `blue` }).addTo(map);
  polylineArray.push(playerPath);
  pitSpawn();
  updateMap();
});

east?.addEventListener("click", () => {
  playerMarker.setLatLng({
    lat: playerMarker.getLatLng().lat,
    lng: playerMarker.getLatLng().lng + 0.0001,
  });
  map.setView(playerMarker.getLatLng());
  movements.push(playerMarker.getLatLng());
  playerPath = polyline(movements, { color: `blue` }).addTo(map);
  polylineArray.push(playerPath);
  pitSpawn();
  updateMap();
});

west?.addEventListener("click", () => {
  playerMarker.setLatLng({
    lat: playerMarker.getLatLng().lat,
    lng: playerMarker.getLatLng().lng - 0.0001,
  });
  map.setView(playerMarker.getLatLng());
  movements.push(playerMarker.getLatLng());
  playerPath = polyline(movements, { color: `blue` }).addTo(map);
  polylineArray.push(playerPath);
  pitSpawn();
  updateMap();
});

liveSensor?.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
    movements.push(playerMarker.getLatLng());
    playerPath = polyline(movements, { color: `red` }).addTo(map);
    polylineArray.push(playerPath);

    pitSpawn();
    updateMap();
  }),
    function error() {
      alert(`Please enable your GPS position feature.`);
    },
    { maximumAge: 10000, timeout: 5000, enableHighAccuracy: true };
});

reset?.addEventListener("click", () => {
  movements = [];
  polylineArray.forEach((line) => {
    line.remove();
  });
  polylineArray = [];
  playerMarker.setLatLng(MERRILL_CLASSROOM);
  map.setView(playerMarker.getLatLng());
  currentMap.clearBoard();
  cacheList.clear();
  cacheMap.forEach((cache) => {
    cache[0].remove();
  });
  cacheMap.clear();
  localStorage.clear();
  clearedLocations.clear();
  pitSpawn();
  localStorage.setItem("player", ``);
  playerCoins = [];
  statusPanel.innerHTML = "No points yet...";
});
reset?.addEventListener("click", () => {
  //return back to spawn
  movements = [];
  polylineArray.forEach((line) => {
    line.remove();
  });
  polylineArray = [];
  playerMarker.setLatLng(MERRILL_CLASSROOM);
  map.setView(playerMarker.getLatLng());
  currentMap.clearBoard(); //clear the board
  cacheList.clear(); //clear all cache in the list
  cacheMap.forEach((cache) => {
    cache[0].remove();
  });
  cacheMap.clear();
  localStorage.clear();
  clearedLocations.clear();
  pitSpawn();
  localStorage.setItem("player", ``);
  playerCoins = [];
});
