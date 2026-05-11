export interface ColorEntry {
  name: string
  dmc: string
  hex: string
  r: number
  g: number
  b: number
}

export const COLOR_TABLE: ColorEntry[] = [
  { name: "白", dmc: "A1", hex: "#FFFFFF", r: 255, g: 255, b: 255 },
  { name: "米白", dmc: "A2", hex: "#F5F5DC", r: 245, g: 245, b: 220 },
  { name: "灰白", dmc: "A3", hex: "#F0F0F0", r: 240, g: 240, b: 240 },
  { name: "米", dmc: "A4", hex: "#F5DEB3", r: 245, g: 222, b: 179 },
  { name: "肤色", dmc: "A5", hex: "#FFDAB9", r: 255, g: 218, b: 185 },
  { name: "杏", dmc: "A6", hex: "#FBCEB1", r: 251, g: 206, b: 177 },
  { name: "薰衣草", dmc: "A7", hex: "#E6E6FA", r: 230, g: 230, b: 250 },
  { name: "浅灰", dmc: "B1", hex: "#C0C0C0", r: 192, g: 192, b: 192 },
  { name: "灰", dmc: "B2", hex: "#808080", r: 128, g: 128, b: 128 },
  { name: "深灰", dmc: "B3", hex: "#404040", r: 64, g: 64, b: 64 },
  { name: "黑", dmc: "B4", hex: "#000000", r: 0, g: 0, b: 0 },
  { name: "浅红", dmc: "C1", hex: "#FFB6C1", r: 255, g: 182, b: 193 },
  { name: "粉红", dmc: "C2", hex: "#FF69B4", r: 255, g: 105, b: 180 },
  { name: "红", dmc: "C3", hex: "#FF0000", r: 255, g: 0, b: 0 },
  { name: "深红", dmc: "C4", hex: "#8B0000", r: 139, g: 0, b: 0 },
  { name: "玫红", dmc: "C5", hex: "#FF00FF", r: 255, g: 0, b: 255 },
  { name: "橙红", dmc: "D1", hex: "#FF4500", r: 255, g: 69, b: 0 },
  { name: "橙", dmc: "D2", hex: "#FF8C00", r: 255, g: 140, b: 0 },
  { name: "珊瑚", dmc: "D3", hex: "#FF7F50", r: 255, g: 127, b: 80 },
  { name: "桃", dmc: "D4", hex: "#FFCBA4", r: 255, g: 203, b: 164 },
  { name: "浅黄", dmc: "E1", hex: "#FFFFAA", r: 255, g: 255, b: 170 },
  { name: "黄", dmc: "E2", hex: "#FFD700", r: 255, g: 215, b: 0 },
  { name: "金", dmc: "E3", hex: "#DAA520", r: 218, g: 165, b: 32 },
  { name: "薄荷", dmc: "F1", hex: "#98FF98", r: 152, g: 255, b: 152 },
  { name: "浅绿", dmc: "F2", hex: "#90EE90", r: 144, g: 238, b: 144 },
  { name: "草绿", dmc: "F3", hex: "#7CFC00", r: 124, g: 252, b: 0 },
  { name: "绿", dmc: "F4", hex: "#00AA00", r: 0, g: 170, b: 0 },
  { name: "深绿", dmc: "F5", hex: "#006400", r: 0, g: 100, b: 0 },
  { name: "橄榄", dmc: "F6", hex: "#808000", r: 128, g: 128, b: 0 },
  { name: "军绿", dmc: "F7", hex: "#4B5320", r: 75, g: 83, b: 32 },
  { name: "浅蓝", dmc: "G1", hex: "#ADD8E6", r: 173, g: 216, b: 230 },
  { name: "天蓝", dmc: "G2", hex: "#00AAEE", r: 0, g: 170, b: 238 },
  { name: "蓝", dmc: "G3", hex: "#0000FF", r: 0, g: 0, b: 255 },
  { name: "深蓝", dmc: "G4", hex: "#00008B", r: 0, g: 0, b: 139 },
  { name: "青", dmc: "G5", hex: "#00FFFF", r: 0, g: 255, b: 255 },
  { name: "深青", dmc: "G6", hex: "#008B8B", r: 0, g: 139, b: 139 },
  { name: "浅紫", dmc: "H1", hex: "#DDA0DD", r: 221, g: 160, b: 221 },
  { name: "紫", dmc: "H2", hex: "#800080", r: 128, g: 0, b: 128 },
  { name: "宝蓝", dmc: "H3", hex: "#4F69C6", r: 79, g: 105, b: 198 },
  { name: "浅棕", dmc: "J1", hex: "#D2B48C", r: 210, g: 180, b: 140 },
  { name: "棕", dmc: "J2", hex: "#8B4513", r: 139, g: 69, b: 19 },
  { name: "咖啡", dmc: "J3", hex: "#6F4E37", r: 111, g: 78, b: 55 },
]

export const BRAND_PALETTES: Record<string, string[]> = {
  "全部": COLOR_TABLE.map((c) => c.dmc),
  "Perler": [
    "A1","A3","A4","A5","B1","B2","B3","B4","C1","C2","C3","C4","C5",
    "D1","D2","D3","D4","E1","E2","E3","F2","F3","F4","F5","F6","F7",
    "G1","G2","G3","G4","H1","H2","H3","J1","J2","J3",
  ],
  "Hama": [
    "A1","A2","A3","A4","A5","A7","B1","B2","B3","B4","C1","C2","C3","C4",
    "D1","D2","D3","E1","E2","E3","F1","F2","F4","F5","F6",
    "G1","G2","G3","G4","G5","H1","H2","H3","J1","J2","J3",
  ],
  "Artkal": [
    "A1","A2","A3","A4","A5","A6","A7","B1","B2","B3","B4",
    "C1","C2","C3","C4","C5","D1","D2","D3","D4","E1","E2","E3",
    "F1","F2","F3","F4","F5","F6","F7","G1","G2","G3","G4","G5","G6",
    "H1","H2","H3","J1","J2","J3",
  ],
}

interface LUTEntry {
  dmc: string
  name: string
  hex: string
  r: number
  g: number
  b: number
  textColor: string
}

export type ColorLUT = LUTEntry[][][]

function getContrastTextColor(r: number, g: number, b: number): string {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#000000" : "#FFFFFF"
}

export function buildColorLUT(
  palette: ColorEntry[] = COLOR_TABLE,
  steps = 6
): ColorLUT {
  const levels = Array.from({ length: steps }, (_, i) =>
    Math.round((i * 255) / (steps - 1))
  )

  const lut: ColorLUT = Array.from({ length: steps }, () =>
    Array.from({ length: steps }, () => Array(steps).fill(null))
  )

  for (let ri = 0; ri < steps; ri++) {
    for (let gi = 0; gi < steps; gi++) {
      for (let bi = 0; bi < steps; bi++) {
        const r = levels[ri]
        const g = levels[gi]
        const b = levels[bi]
        let minDist = Infinity
        let nearest = palette[0]
        for (const c of palette) {
          const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2
          if (dist < minDist) {
            minDist = dist
            nearest = c
          }
        }
        lut[ri][gi][bi] = {
          dmc: nearest.dmc,
          name: nearest.name,
          hex: nearest.hex,
          r: nearest.r,
          g: nearest.g,
          b: nearest.b,
          textColor: getContrastTextColor(nearest.r, nearest.g, nearest.b),
        }
      }
    }
  }
  return lut
}

export function lookupColor(
  lut: ColorLUT,
  r: number,
  g: number,
  b: number
): LUTEntry {
  const steps = lut.length
  const ri = Math.round((r * (steps - 1)) / 255)
  const gi = Math.round((g * (steps - 1)) / 255)
  const bi = Math.round((b * (steps - 1)) / 255)
  return lut[ri][gi][bi]
}
