export interface FaerunLocation {
  region_mayor: string;
  subregiones: {
    nombre_subregion: string;
    localizaciones: string[];
  }[];
}

export const faerunLocations: FaerunLocation[] = [
  {
    region_mayor: "Costa de la Espada",
    subregiones: [
      {
        nombre_subregion: "Costa de la Espada Central",
        localizaciones: [
          "Aguasprofundas",
          "Puerta de Baldur",
          "Daggerford",
          "Beregost",
          "Nashkel",
          "Candlekeep",
          "Ulgoth's Beard",
          "Colina Roja",
          "Fuerte Elturel",
          "Scornubel",
          "Triel",
          "Boareskyr Bridge",
          "Dragonspear Castle"
        ]
      },
      {
        nombre_subregion: "Campos de los Muertos",
        localizaciones: [
          "Campos de los Muertos",
          "Colinas de los Huesos",
          "Ruinas de Dragonspear",
          "Fuerte de Shields"
        ]
      },
      {
        nombre_subregion: "Isla de Mintarn",
        localizaciones: [
          "Mintarn"
        ]
      },
      {
        nombre_subregion: "Islas Moonshae",
        localizaciones: [
          "Caer Callidyrr",
          "Caer Corwell",
          "Caer Westphal",
          "Isla Alaron",
          "Isla Gwynneth",
          "Isla Moray",
          "Isla Norland",
          "Isla Oman",
          "Isla Snowdown"
        ]
      }
    ]
  },
  {
    region_mayor: "Costa de la Espada Norte",
    subregiones: [
      {
        nombre_subregion: "Ciudad de Nunca Invierno",
        localizaciones: [
          "Nunca Invierno",
          "Bosque de Nunca Invierno",
          "Ruinas del Castillo Nunca Invierno",
          "Torre del Crepúsculo",
          "Cragmaw Castle",
          "Phandalin",
          "Onda del Trueno",
          "Mina de la Ola del Eco"
        ]
      },
      {
        nombre_subregion: "Luskan y Alrededores",
        localizaciones: [
          "Luskan",
          "Torre de los Arcanos",
          "Isla de los Rehenes",
          "Puerto Llast",
          "Mirabar"
        ]
      },
      {
        nombre_subregion: "Waterdeep y Cercanías",
        localizaciones: [
          "Montaña de Aguasprofundas",
          "Undermountain",
          "Skullport",
          "Amphail",
          "Rassalantar",
          "Leilon"
        ]
      },
      {
        nombre_subregion: "Camino Largo",
        localizaciones: [
          "Triboar",
          "Longsaddle",
          "Llamarada Roja",
          "Westbridge",
          "Conyberry"
        ]
      }
    ]
  },
  {
    region_mayor: "Norte",
    subregiones: [
      {
        nombre_subregion: "Marca de Plata",
        localizaciones: [
          "Silverymoon",
          "Sundabar",
          "Everlund",
          "Citadel Adbar",
          "Citadel Felbarr",
          "Quaervarr",
          "Jalanthar",
          "Deadsnows"
        ]
      },
      {
        nombre_subregion: "Espina Dorsal del Mundo",
        localizaciones: [
          "Valle del Viento Helado",
          "Diez Ciudades",
          "Bryn Shander",
          "Kelvin's Cairn",
          "Mar de Hielo Móvil",
          "Reghed Glacier",
          "Easthaven",
          "Caer-Dineval",
          "Caer-Konig",
          "Lonelywood",
          "Termalaine",
          "Bremen",
          "Targos",
          "Good Mead",
          "Dougan's Hole"
        ]
      },
      {
        nombre_subregion: "Tierras Salvajes del Norte",
        localizaciones: [
          "Llorkh",
          "Loudwater",
          "Secomber",
          "Piedra de la Estrella",
          "Colinas de las Estrellas",
          "Alto Bosque",
          "Bosque de los Muertos",
          "Kryptgarden",
          "Bosque Perdido"
        ]
      },
      {
        nombre_subregion: "Paso del Viento Helado",
        localizaciones: [
          "Hundelstone",
          "Fireshear",
          "Ironmaster"
        ]
      },
      {
        nombre_subregion: "Ciudadela Oscura",
        localizaciones: [
          "Menzoberranzan",
          "Gauntlgrym",
          "Gracklstugh",
          "Blingdenstone",
          "Mantol-Derith",
          "Neverlight Grove",
          "Velkynvelve"
        ]
      }
    ]
  },
  {
    region_mayor: "Valles",
    subregiones: [
      {
        nombre_subregion: "Valles Centrales",
        localizaciones: [
          "Valle de la Sombra",
          "Manto de la Sombra",
          "Valle del Arco Iris",
          "Mistrival",
          "Valle de la Cicatriz"
        ]
      },
      {
        nombre_subregion: "Valles del Norte",
        localizaciones: [
          "Valle del Viento",
          "Valle de la Daga",
          "Daggerdale",
          "Valle de las Sombras",
          "Zhentil Keep"
        ]
      },
      {
        nombre_subregion: "Valles del Sur",
        localizaciones: [
          "Valle de la Batalla",
          "Valle Profundo",
          "Valle del Arpa",
          "Ashabenford",
          "Essembra"
        ]
      },
      {
        nombre_subregion: "Bosque Cormanthor",
        localizaciones: [
          "Myth Drannor",
          "Elventree",
          "Tangled Trees",
          "Corte Élfica",
          "Río Ashaba"
        ]
      }
    ]
  },
  {
    region_mayor: "Cormyr",
    subregiones: [
      {
        nombre_subregion: "Corazón de Cormyr",
        localizaciones: [
          "Suzail",
          "Marsember",
          "Arabel",
          "Tilverton",
          "Inmersea",
          "Espar",
          "Eveningstar",
          "Waymoot",
          "Hilp",
          "Wheloon",
          "Thunderstone"
        ]
      },
      {
        nombre_subregion: "Fronteras de Cormyr",
        localizaciones: [
          "Castillo Crag",
          "Paso del Gnoll",
          "Paso de Alta Cuerno",
          "Bosque del Rey",
          "Bosque de Hullack",
          "Pantano de los Trolls",
          "Pantano Farsea"
        ]
      }
    ]
  },
  {
    region_mayor: "Sembia",
    subregiones: [
      {
        nombre_subregion: "Ciudades Principales",
        localizaciones: [
          "Ordulin",
          "Selgaunt",
          "Daerlun",
          "Urmlaspyr",
          "Saerloon",
          "Yhaunn"
        ]
      },
      {
        nombre_subregion: "Zonas Rurales",
        localizaciones: [
          "Featherdale",
          "Archendale",
          "Tasseldale"
        ]
      }
    ]
  },
  {
    region_mayor: "Mar de la Luna",
    subregiones: [
      {
        nombre_subregion: "Costas del Mar de la Luna",
        localizaciones: [
          "Mulmaster",
          "Melvaunt",
          "Phlan",
          "Thentia",
          "Elminster's Tower",
          "Hillsfar",
          "Yûlash",
          "Voonlar"
        ]
      },
      {
        nombre_subregion: "Islas del Mar de la Luna",
        localizaciones: [
          "Isla de las Sombras"
        ]
      },
      {
        nombre_subregion: "Ruinas Circundantes",
        localizaciones: [
          "Ruinas de Yûlash",
          "Castillo Zhentil",
          "Paso de Thar"
        ]
      }
    ]
  },
  {
    region_mayor: "Corazón Occidental",
    subregiones: [
      {
        nombre_subregion: "Tierras del Corazón Occidental",
        localizaciones: [
          "Iriaebor",
          "Berdusk",
          "Elturel",
          "Scornubel",
          "Asbravn",
          "Colinas del Atardecer",
          "Colinas Lejanas",
          "Bosque Saliente",
          "Bosque Estelar"
        ]
      },
      {
        nombre_subregion: "Valle de Chionthar",
        localizaciones: [
          "Río Chionthar",
          "Darkhold",
          "Colinas de las Serpientes"
        ]
      }
    ]
  },
  {
    region_mayor: "Amn",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Amn",
        localizaciones: [
          "Athkatla",
          "Crimmor",
          "Eshpurta",
          "Keczulla",
          "Murann",
          "Purskul",
          "Riatavin"
        ]
      },
      {
        nombre_subregion: "Zonas Salvajes de Amn",
        localizaciones: [
          "Montañas de la Nube",
          "Bosque de Snakewood",
          "Paso de Amnwater",
          "Lago Esmel"
        ]
      }
    ]
  },
  {
    region_mayor: "Tethyr",
    subregiones: [
      {
        nombre_subregion: "Corona de Tethyr",
        localizaciones: [
          "Darromar",
          "Zazesspurr",
          "Myratma",
          "Saradush",
          "Ithal Pass",
          "Bosque de Tethir",
          "Montañas Starspire"
        ]
      },
      {
        nombre_subregion: "Costa de Tethyr",
        localizaciones: [
          "Velen",
          "Ithmong",
          "Mosstone"
        ]
      }
    ]
  },
  {
    region_mayor: "Calimshan",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Calimshan",
        localizaciones: [
          "Calimport",
          "Memnon",
          "Keltar",
          "Almraiven",
          "Volothamp",
          "Teshburl",
          "Suldolphor"
        ]
      },
      {
        nombre_subregion: "Desierto de Calim",
        localizaciones: [
          "Desierto de Calim",
          "Ruinas de Memnonnar",
          "Oasis de las Hadas"
        ]
      },
      {
        nombre_subregion: "Tierras Brillantes",
        localizaciones: [
          "Montañas Marching",
          "Río Calim"
        ]
      }
    ]
  },
  {
    region_mayor: "Chult",
    subregiones: [
      {
        nombre_subregion: "Costa de Chult",
        localizaciones: [
          "Puerto Nyanzaru",
          "Fuerte Beluarian",
          "Bahía de Chult",
          "Bahía de los Piratas"
        ]
      },
      {
        nombre_subregion: "Interior de Chult",
        localizaciones: [
          "Omu",
          "Nangalore",
          "Orolunga",
          "Mbala",
          "Kir Sabal",
          "Aldea Yellyark",
          "Valle de la Perdición",
          "Tumba de la Aniquilación",
          "Pico Colmillo de Fuego",
          "Corazón de Ubtao"
        ]
      },
      {
        nombre_subregion: "Islas Cercanas",
        localizaciones: [
          "Isla Lantan",
          "Isla de los Naufragios"
        ]
      }
    ]
  },
  {
    region_mayor: "Thay",
    subregiones: [
      {
        nombre_subregion: "Meseta de Thay",
        localizaciones: [
          "Eltabbar",
          "Bezantur",
          "Amruthar",
          "Pyarados",
          "Surthay",
          "Tyraturos",
          "Thaymount",
          "Ciudadela de los Magos Rojos"
        ]
      },
      {
        nombre_subregion: "Enclaves de Thay",
        localizaciones: [
          "Enclave de Thay en Mulmaster",
          "Enclave de Thay en Priadon"
        ]
      },
      {
        nombre_subregion: "Fronteras de Thay",
        localizaciones: [
          "Lago Thaylambar",
          "Río Umber",
          "Cadenas Montañosas de Thaymount"
        ]
      }
    ]
  },
  {
    region_mayor: "Rashemen",
    subregiones: [
      {
        nombre_subregion: "Tierras de Rashemen",
        localizaciones: [
          "Immilmar",
          "Mulsantir",
          "Urling",
          "Lago Ashane",
          "Lago Mulsantir",
          "Bosque de Erech",
          "Corredores de las Brujas Antiguas",
          "Ciudadela de las Brujas"
        ]
      }
    ]
  },
  {
    region_mayor: "Aglarond",
    subregiones: [
      {
        nombre_subregion: "Tierras de Aglarond",
        localizaciones: [
          "Velprintalar",
          "Furthinghome",
          "Glarondar",
          "Ingdal's Arm",
          "Emmech",
          "Bosque de Yuir",
          "Altumbel"
        ]
      }
    ]
  },
  {
    region_mayor: "Este Inaccesible",
    subregiones: [
      {
        nombre_subregion: "Ciudades del Este",
        localizaciones: [
          "Uthmere",
          "Velprintalar",
          "Citadel Rashemar",
          "Emmech"
        ]
      },
      {
        nombre_subregion: "Bosques y Salvajes",
        localizaciones: [
          "Bosque de Lethyr",
          "Bosque de Rawlinswood",
          "Montañas del Pico de Hielo"
        ]
      }
    ]
  },
  {
    region_mayor: "Turmish",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Turmish",
        localizaciones: [
          "Alaghôn",
          "Nonthal",
          "Xorhun",
          "Gildenglade",
          "Ironfang Keep",
          "Morningstar Hollows"
        ]
      },
      {
        nombre_subregion: "Costas de Turmish",
        localizaciones: [
          "Costa del Alcance de Vilhon",
          "Bahía de Turmish"
        ]
      }
    ]
  },
  {
    region_mayor: "Alcance de Vilhon",
    subregiones: [
      {
        nombre_subregion: "Ciudades del Alcance",
        localizaciones: [
          "Hlondeth",
          "Arrabar",
          "Ormpetarr",
          "Lheshayl",
          "Nimpeth",
          "Sespech",
          "Surkh"
        ]
      },
      {
        nombre_subregion: "Zonas Naturales",
        localizaciones: [
          "Bosque de Chondalwood",
          "Llanuras de Turmish",
          "Pantanos del Alcance"
        ]
      }
    ]
  },
  {
    region_mayor: "Costa del Dragón",
    subregiones: [
      {
        nombre_subregion: "Ciudades de la Costa del Dragón",
        localizaciones: [
          "Proskur",
          "Elversult",
          "Westgate",
          "Teziir",
          "Ilipur",
          "Starmantle",
          "Nathlekh"
        ]
      },
      {
        nombre_subregion: "Zonas Cercanas",
        localizaciones: [
          "Pirate Isles",
          "Montañas de la Garra del Dragón",
          "Bosque de Gulthmere"
        ]
      }
    ]
  },
  {
    region_mayor: "Costa del Mar de las Estrellas Caídas",
    subregiones: [
      {
        nombre_subregion: "Costas del Mar Interior",
        localizaciones: [
          "Procampur",
          "Tsurlagol",
          "Tantras",
          "Calaunt",
          "Ravens Bluff",
          "Scardale"
        ]
      }
    ]
  },
  {
    region_mayor: "Impiltur",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Impiltur",
        localizaciones: [
          "Lyrabar",
          "Hlammach",
          "Dilpur",
          "Sarshel",
          "Filur",
          "Laviguer"
        ]
      },
      {
        nombre_subregion: "Fronteras de Impiltur",
        localizaciones: [
          "Puerta del Demonio",
          "Montañas Earthspur",
          "Bosque de Gray Forest"
        ]
      }
    ]
  },
  {
    region_mayor: "Damara",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Damara",
        localizaciones: [
          "Heliogabalus",
          "Bloodstone Village",
          "Trailsend",
          "Valls",
          "Kinbrace"
        ]
      },
      {
        nombre_subregion: "Regiones de Damara",
        localizaciones: [
          "Paso de Bloodstone",
          "Minas de Bloodstone",
          "Montañas Galena",
          "Bosque de Rawlinswood"
        ]
      }
    ]
  },
  {
    region_mayor: "Vaasa",
    subregiones: [
      {
        nombre_subregion: "Tierras de Vaasa",
        localizaciones: [
          "Castillo Perilous",
          "Darmshall",
          "Palischuk",
          "Pantano de Vaasa",
          "Lago Lagunas Heladas",
          "Montañas Galena"
        ]
      }
    ]
  },
  {
    region_mayor: "Gran Valle",
    subregiones: [
      {
        nombre_subregion: "Ciudades del Gran Valle",
        localizaciones: [
          "Semberholme",
          "Deepingdale",
          "Archendale",
          "Battledale",
          "Featherdale",
          "Harrowdale",
          "Mistledale",
          "Scardale",
          "Shadowdale",
          "Tasseldale"
        ]
      }
    ]
  },
  {
    region_mayor: "Thesk",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Thesk",
        localizaciones: [
          "Phsant",
          "Milvarune",
          "Telflamm",
          "Nyth",
          "Tammar",
          "Two Stars"
        ]
      },
      {
        nombre_subregion: "Ruta Dorada",
        localizaciones: [
          "Ruta Dorada de Thesk",
          "Gnoll Pass"
        ]
      }
    ]
  },
  {
    region_mayor: "Mulhorand",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Mulhorand",
        localizaciones: [
          "Skuld",
          "Gheldaneth",
          "Mishtan",
          "Murghôm",
          "Sultim",
          "Neldorild"
        ]
      },
      {
        nombre_subregion: "Monumentos y Ruinas",
        localizaciones: [
          "Pirámides de los Dioses-Rey",
          "Templo de Horus-Re",
          "Ruinas de Sekras"
        ]
      }
    ]
  },
  {
    region_mayor: "Unther",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Unther",
        localizaciones: [
          "Messemprar",
          "Unthalass",
          "Shussel",
          "Firetrees",
          "Dalath"
        ]
      },
      {
        nombre_subregion: "Regiones de Unther",
        localizaciones: [
          "Llanuras del Polvo Negro",
          "Colinas del Viento",
          "Río Alamber"
        ]
      }
    ]
  },
  {
    region_mayor: "Chessenta",
    subregiones: [
      {
        nombre_subregion: "Ciudades-Estado de Chessenta",
        localizaciones: [
          "Cimbar",
          "Akanax",
          "Soorenar",
          "Luthcheq",
          "Mordulkin",
          "Airspur",
          "Erebos"
        ]
      },
      {
        nombre_subregion: "Regiones Salvajes",
        localizaciones: [
          "Montañas de los Jinetes del Cielo",
          "Pantanos del Adder",
          "Bahía de Chessenta"
        ]
      }
    ]
  },
  {
    region_mayor: "Halruaa",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Halruaa",
        localizaciones: [
          "Halarahh",
          "Halagard",
          "Zalathorm's Palace",
          "Khaerbaal",
          "Mithral Mine",
          "Talathgard"
        ]
      },
      {
        nombre_subregion: "Fronteras de Halruaa",
        localizaciones: [
          "Montañas del Muro del Norte",
          "Montañas de las Paredes del Este",
          "Lago Halruaa"
        ]
      }
    ]
  },
  {
    region_mayor: "Luiren",
    subregiones: [
      {
        nombre_subregion: "Tierras Halfling",
        localizaciones: [
          "Beluir",
          "Chethel",
          "Crimel",
          "Shoun",
          "Thantilvon",
          "Bosque de Lluirwood"
        ]
      }
    ]
  },
  {
    region_mayor: "Shaar",
    subregiones: [
      {
        nombre_subregion: "Llanuras del Shaar",
        localizaciones: [
          "Shaarmid",
          "Lheshayl",
          "Consejo de los Centauros",
          "Gran Grieta",
          "Landrise",
          "Llanuras del Shaar Oriental"
        ]
      },
      {
        nombre_subregion: "Shaar Meridional",
        localizaciones: [
          "Colinas de los Trolls del Shaar",
          "Bosque de Channathwood",
          "Lago de Vapor"
        ]
      }
    ]
  },
  {
    region_mayor: "Reinos Fronterizos",
    subregiones: [
      {
        nombre_subregion: "Reinos Fronterizos del Este",
        localizaciones: [
          "Dambrath",
          "Gran Grieta",
          "Colinas de los Muertos Vivientes",
          "T'lindhet"
        ]
      },
      {
        nombre_subregion: "Reinos Fronterizos Salvajes",
        localizaciones: [
          "Elfharrow",
          "Channathwood",
          "Colinas del Ojo del Dragón"
        ]
      }
    ]
  },
  {
    region_mayor: "Lapaliiya",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Lapaliiya",
        localizaciones: [
          "Sheirtalar",
          "Ormpur",
          "Lheshayl",
          "Samargol"
        ]
      },
      {
        nombre_subregion: "Zonas Costeras",
        localizaciones: [
          "Costa de Lapaliiya",
          "Bahía de la Serpiente"
        ]
      }
    ]
  },
  {
    region_mayor: "Samarach",
    subregiones: [
      {
        nombre_subregion: "Tierras de Samarach",
        localizaciones: [
          "Samargol",
          "Puerto Nyranzaru Meridional",
          "Selvas de Samarach",
          "Ruinas Yuan-ti"
        ]
      }
    ]
  },
  {
    region_mayor: "Var el Dorado",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Var",
        localizaciones: [
          "Vaelen",
          "Pyratar",
          "Ilstar"
        ]
      },
      {
        nombre_subregion: "Zonas de Var",
        localizaciones: [
          "Llanuras Doradas",
          "Costa Dorada"
        ]
      }
    ]
  },
  {
    region_mayor: "Estagund",
    subregiones: [
      {
        nombre_subregion: "Tierras de Estagund",
        localizaciones: [
          "Chavyondat",
          "Aegis",
          "Klidarr",
          "Puerto de Estagund"
        ]
      }
    ]
  },
  {
    region_mayor: "Durpar",
    subregiones: [
      {
        nombre_subregion: "Ciudades de Durpar",
        localizaciones: [
          "Vaelan",
          "Assur",
          "Heldapan",
          "Flyndagol"
        ]
      },
      {
        nombre_subregion: "Ruta Dorada del Sur",
        localizaciones: [
          "Ruta Dorada Meridional",
          "Costa del Mar Dorado"
        ]
      }
    ]
  },
  {
    region_mayor: "Ulgarth",
    subregiones: [
      {
        nombre_subregion: "Tierras de Ulgarth",
        localizaciones: [
          "Opar",
          "Kelazzan",
          "Suormpar",
          "Dralpur",
          "Kaspar"
        ]
      }
    ]
  },
  {
    region_mayor: "Anauroch",
    subregiones: [
      {
        nombre_subregion: "Gran Desierto de Anauroch",
        localizaciones: [
          "Desierto de la Espada",
          "Llanura de Arena Pedregosa",
          "Mar de Arena",
          "Oasis del Escudo Blanco"
        ]
      },
      {
        nombre_subregion: "Ruinas Netheril",
        localizaciones: [
          "Ruinas de Netheril",
          "Shade Enclave",
          "Ciudades Flotantes Caídas",
          "Ascore",
          "Hlaungadath",
          "Rasilith"
        ]
      },
      {
        nombre_subregion: "Pueblos del Desierto",
        localizaciones: [
          "Bedinistas",
          "D'tarig Settlements",
          "Zhentarim Outposts"
        ]
      }
    ]
  }
];

export const getRegions = (): string[] => {
  return faerunLocations.map(r => r.region_mayor);
};

export const getSubregions = (region: string): string[] => {
  const found = faerunLocations.find(r => r.region_mayor === region);
  return found ? found.subregiones.map(s => s.nombre_subregion) : [];
};

export const getLocations = (region: string, subregion: string): string[] => {
  const foundRegion = faerunLocations.find(r => r.region_mayor === region);
  if (!foundRegion) return [];
  const foundSub = foundRegion.subregiones.find(s => s.nombre_subregion === subregion);
  return foundSub ? foundSub.localizaciones : [];
};

export const getAllLocationsForRegion = (region: string): string[] => {
  const found = faerunLocations.find(r => r.region_mayor === region);
  if (!found) return [];
  return found.subregiones.flatMap(s => s.localizaciones);
};
