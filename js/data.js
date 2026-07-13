const STORAGE_KEY = "dvs_rebuild_data_v2";

export const DEFAULT_DATA = {
  rooms: Array.from({length: 15}, (_, i) => ({
    id: i + 1,
    computerId: i === 0 ? "MAC 4" : "",
    hardwareId: "",
    licenseId: "",
    otherLicenses: "",
    plugins: [],
    notes: ""
  })),
  computers: [
    {id:"MAC 3",model:"Mac Pro (Late 2013)",processor:"Intel Xeon E5 6-core",ram:"28 GB 1866 MHz ECC",gpu:"AMD FirePro D700 6 GB",serial:"F5KP70ADF694",os:"",formatDate:"2025-07-17",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"},
    {id:"MAC 4",model:"iMac Retina 5K 27-inch (2019)",processor:"Intel Core i9 3,6 GHz 8-core",ram:"32 GB 2667 MHz DDR4",gpu:"Radeon Pro 575X 4 GB",serial:"DGKYKHEZJV3Y",os:"Monterey",formatDate:"2026-03-09",warehouse:false,warehouseLocation:"",notes:"Nel file risultava in Sala 1"},
    {id:"MAC 5",model:"iMac Retina 5K 27-inch (2020)",processor:"Intel Core i7 3,8 GHz 8-core",ram:"40 GB 2133 MHz DDR4",gpu:"Radeon Pro 5500 XT 8 GB",serial:"C02DQ1MQPN5W",os:"Monterey",formatDate:"2026-02-18",warehouse:true,warehouseLocation:"Da definire",notes:"Da verificare"},
    {id:"MAC 10",model:"iMac Retina 5K 27-inch (2019)",processor:"Intel Core i5 3,7 GHz 6-core",ram:"24 GB 2400 MHz DDR4",gpu:"Radeon Pro 580X 8 GB",serial:"C02YW05HJV3Q",os:"Monterey",formatDate:"",warehouse:true,warehouseLocation:"Da definire",notes:""},
    {id:"MAC 11",model:"iMac Retina 5K 27-inch (Late 2015)",processor:"Intel Core i5 3,2 GHz Quad-Core",ram:"24 GB 1867 MHz",gpu:"Radeon R9 M390 2 GB",serial:"C02S65TMGG7L",os:"Mojave",formatDate:"",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"},
    {id:"MAC 13",model:"Mac Pro (Mid 2010)",processor:"2x Intel Xeon 2,4 GHz Quad-Core",ram:"12 GB 1066 MHz",gpu:"",serial:"CK10200WHF8",os:"",formatDate:"",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"},
    {id:"MAC 22",model:"Mac Studio (2023)",processor:"Apple M1 Max",ram:"32 GB",gpu:"",serial:"QF9V9M6V37",os:"Ventura",formatDate:"2026-04-28",warehouse:true,warehouseLocation:"Da definire",notes:"Importato dal Numbers"}
  ],
  hardware: [
    {id:"HW 1",model:"Avid Artist DNxIO",serial:"3197864",driver:"12.8.1",notes:""},
    {id:"HW 3",model:"Avid Artist DNxID",serial:"9077367",driver:"12.4.1",notes:""},
    {id:"HW 8",model:"UltraStudio Monitor 3G",serial:"7106243",driver:"12.8.1",notes:""},
    {id:"HW 9",model:"8HD Mini",serial:"5829797",driver:"4.1",notes:"Da verificare"},
    {id:"HW 10",model:"UltraStudio Monitor 3G",serial:"11868651",driver:"",notes:""},
    {id:"HW 16",model:"Teranex 2D Processor",serial:"2419046",driver:"",notes:"Storico"},
    {id:"HW NITRIS 1",model:"Nitris DX",serial:"BFE23400193G",driver:"",notes:"Storico"},
    {id:"HW EXPRESS 1",model:"Avid Express",serial:"3155387",driver:"",notes:"Storico"}
  ],
  licenses: [
    {id:"AVID 02",type:"Ultimate",systemId:"3496914",code:"MUHA-YNSD-RQ8V-DU6F",version:"2022.12.6",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"1 anno – disattivazione richiesta"},
    {id:"AVID 05",type:"Ultimate",systemId:"",code:"",version:"",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"Completare codici"},
    {id:"AVID 06",type:"Ultimate",systemId:"10769244273",code:"MUHA-G39S-5P8D-TYCH",version:"2022.12.5",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"Da verificare"},
    {id:"AVID 09",type:"Ultimate",systemId:"633901897",code:"MUHA-QHXN-RFMP-ZSPF",version:"",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:false,notes:"Da verificare"},
    {id:"AVID 21",type:"Singolo",systemId:"10620086202",code:"MTHA-VGF5-WEZJ-VKRF",version:"2023.8.2",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"1 anno – disattivazione richiesta"}
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(data) {
  const result = data && typeof data === "object" ? data : {};
  result.computers = Array.isArray(result.computers) ? result.computers.filter(Boolean) : [];
  result.hardware = Array.isArray(result.hardware) ? result.hardware.filter(Boolean) : [];
  result.licenses = Array.isArray(result.licenses) ? result.licenses.filter(Boolean) : [];

  const rooms = Array.isArray(result.rooms) ? result.rooms : [];
  const byId = new Map(rooms.map(room => [Number(room.id), room]));
  result.rooms = Array.from({length: 15}, (_, i) => {
    const id = i + 1;
    return {
      id,
      computerId: "",
      hardwareId: "",
      licenseId: "",
      otherLicenses: "",
      plugins: [],
      notes: "",
      ...(byId.get(id) || {})
    };
  });

  result.rooms.forEach(room => {
    room.plugins = Array.isArray(room.plugins) ? room.plugins.filter(Boolean) : [];
    room.plugins = room.plugins.map(plugin => ({
      type: plugin.type === "Sapphire" ? "Sapphire" : "Continuum",
      serial: plugin.serial || "",
      billingCycle: plugin.billingCycle === "monthly" ? "monthly" : "annual",
      activation: plugin.activation || "",
      expiry: plugin.expiry || "",
      deactivationRequested: Boolean(plugin.deactivationRequested)
    }));
  });

  result.computers.forEach(item => {
    item.warehouse = Boolean(item.warehouse);
    item.warehouseLocation ||= "";
    item.os ||= "";
    item.formatDate ||= "";
    item.notes ||= "";
  });

  result.hardware.forEach(item => {
    item.driver ||= "";
    item.notes ||= "";
  });

  result.licenses.forEach(item => {
    item.type = item.type === "Singolo" ? "Singolo" : "Ultimate";
    item.billingCycle = item.billingCycle === "monthly" ? "monthly" : "annual";
    item.activation ||= "";
    item.expiry ||= "";
    item.deactivationRequested = Boolean(item.deactivationRequested);
    item.notes ||= "";
  });

  return result;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : clone(DEFAULT_DATA));
  } catch {
    return normalize(clone(DEFAULT_DATA));
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(data)));
}

export function resetData() {
  const data = normalize(clone(DEFAULT_DATA));
  saveData(data);
  return data;
}

export function importDataObject(input) {
  const data = normalize(input);
  saveData(data);
  return data;
}