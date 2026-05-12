# 🎨 PixelBead — 拼豆像素画生成器

将任意图片转换为拼豆/十字绣像素图案，每个像素块标注 DMC 色号或中文色名，方便照图配豆、配线制作。

**[🚀 在线体验](https://pixelbead.pages.dev)** · **[📦 GitHub](https://github.com/Timskt/PixelBead)**

---

## 功能一览

| 功能 | 说明 |
|------|------|
| 📷 图片上传 | 点击、拖拽、粘贴、URL 链接、移动端相机 |
| 🧩 像素化 | 浏览器级 Canvas 重采样 + 最近邻采样保留细节 |
| 🏷️ DMC 色号 | 40+ 预置色 + K-means 自动提取调色板 |
| ✂️ 交互裁剪 | 拖拽选框自由裁剪，支持多级撤销恢复原图 |
| 🔍 缩放控制 | 图片缩放 1-100%，像素大小 1-500 |
| 🖐️ 手势预览 | 双指缩放/滚轮缩放（最高 2000%）、拖动平移 |
| 📥 导出 PNG | 含色号标注的像素画 |
| 🗺️ 导出图纸 | 带行列标号的打印版 |
| 📊 用料清单 | CSV / TXT / 图片格式，含色号+色名+数量 |
| 📋 复制数据 | JSON 格式像素矩阵 |
| 👁 对比原图 | 左右分屏对比 |
| 🔗 URL 分享 | 所有参数编码在 URL 中 |

## 一键部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Timskt/PixelBead)

1. 点击上方按钮
2. 登录 Vercel，选择仓库
3. 保持默认设置，点击 Deploy

### Cloudflare Pages

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Timskt/PixelBead)

1. 点击上方按钮
2. 授权 GitHub 并选择仓库
3. 构建设置：
   - **构建命令：** `npm run build`
   - **输出目录：** `dist`

## 本地开发

```bash
git clone git@github.com:Timskt/PixelBead.git
cd PixelBead
npm install
npm run dev
```

## 项目结构

```
PixelBead/
├── src/
│   ├── components/
│   │   ├── ActionBar.tsx        # 导出按钮组
│   │   ├── BeadSummary.tsx      # 拼豆用量清单
│   │   ├── CropOverlay.tsx      # 交互式裁剪
│   │   ├── ImageUploader.tsx    # 图片上传（拖拽/粘贴/URL）
│   │   ├── Loading.tsx          # 加载动画
│   │   ├── PixelCanvas.tsx      # 像素画预览（缩放/平移）
│   │   ├── PixelSlider.tsx      # 像素大小滑块
│   │   └── Toast.tsx            # 提示组件
│   ├── utils/
│   │   ├── colorMap.ts          # DMC 色号表 + 颜色匹配
│   │   ├── export.ts            # 导出功能（PNG/CSV/TXT/图纸）
│   │   ├── pixelate.ts          # 像素化核心逻辑
│   │   └── pixelate.worker.ts   # Web Worker 处理引擎
│   ├── App.tsx                  # 主应用
│   ├── main.tsx                 # 入口
│   └── index.css                # Tailwind v4 主题
├── index.html
├── vite.config.ts
├── vercel.json
└── package.json
```

## 核心算法

### 像素化管线

```
原图 → 图片缩放（高质量平滑）
    → Canvas 最近邻重采样（保留细线条）
    → 自动调色板提取（K-means，无限制模式）
    → 逐像素精确颜色匹配（加权欧氏距离）
    → 多数投票滤波（细节模式，去噪点）
    → 颜色数量限制
    → 输出矩阵
```

### 颜色匹配

使用亮度自适应加权欧氏距离：
```
dist² = ((512+avgR) × dR² >> 8) + 4 × dG² + ((768-avgR) × dB² >> 8)
```
人眼对绿色最敏感（权重 4），红蓝权重随亮度调整。

### K-means 自动调色板（无限制模式）

1. 去重 + 子采样（最多 4000 种唯一色）
2. 按饱和度降序排列
3. 贪心选择 + 距离阈值筛选
4. K-means 迭代 8 次精炼
5. 提取色映射回最近 DMC 色号（标签）

### 最近邻采样

`imageSmoothingEnabled = false` — 每个输出像素精确对应一个源像素，保留细线条（胡须、轮廓、高光）。

## 操作模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 快速 | 最近邻采样 + 精确匹配 | 大多数图片（推荐） |
| 细节 | 快速 + 多数投票滤波去噪 | 噪点多的图片 |

## DMC 色号对照表

| 前缀 | 色系 | 色号范围 |
|------|------|----------|
| A | 白/米/肤 | A1 白 → A7 薰衣草 |
| B | 灰/黑 | B1 浅灰 → B4 黑 |
| C | 红 | C1 浅红 → C5 玫红 |
| D | 橙 | D1 橙红 → D4 桃 |
| E | 黄 | E1 浅黄 → E3 金 |
| F | 绿 | F1 薄荷 → F7 军绿 |
| G | 蓝 | G1 浅蓝 → G6 深青 |
| H | 紫 | H1 浅紫 → H3 宝蓝 |
| J | 棕 | J1 浅棕 → J3 咖啡 |

## 快捷键

| 按键 | 功能 |
|------|------|
| `V` | 对比原图 |
| `R` 随机示例 |
| 滚轮 | 缩放（最高 2000%） |
| 拖动 | 平移（鼠标 + 触屏） |

## 技术栈

- **框架：** React 19 + TypeScript 6
- **构建：** Vite 8
- **样式：** Tailwind CSS 4
- **图像处理：** Canvas API + Web Worker
- **颜色匹配：** 亮度自适应加权欧氏距离
- **调色板提取：** K-means 聚类

## License

MIT
