# 🎨 PixelBead — 拼豆像素画生成器

将任意图片转换为拼豆/十字绣像素图案，每个像素块标注 DMC 色号或中文色名，方便照图配豆、配线制作。

**[🚀 在线体验](https://pixelbead.pages.dev)** · **[📦 GitHub](https://github.com/Timskt/PixelBead)**

---

## 功能一览

| 功能 | 说明 |
|------|------|
| 📷 图片上传 | 点击、拖拽、移动端相册/拍照 |
| 🧩 像素化 | Canvas 浏览器端处理，超 2000px 自动压缩 |
| 🏷️ DMC 色号 | 40+ 预置色，最近邻匹配，支持色名/DMC色号切换 |
| 🔍 像素大小 | 8–200px 滑块实时调节 |
| 🖐️ 手势预览 | 双指缩放、拖动平移、滚轮缩放 |
| 📥 导出 PNG | 一键下载含色号标注的像素画 |
| 📋 复制数据 | JSON 格式像素矩阵（色号+色名+Hex） |
| 🎲 随机示例 | 内置随机图片快速体验 |

## 一键部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Timskt/PixelBead)

1. 点击上方按钮
2. 登录 Vercel，选择仓库
3. 保持默认设置，点击 Deploy
4. 完成后自动分配域名

### Cloudflare Pages

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Timskt/PixelBead)

1. 点击上方按钮
2. 授权 GitHub 并选择仓库
3. 构建设置：
   - **构建命令：** `npm run build`
   - **输出目录：** `dist`
4. 点击保存并部署

## 本地开发

```bash
# 克隆仓库
git clone git@github.com:Timskt/PixelBead.git
cd PixelBead

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

## 项目结构

```
PixelBead/
├── src/
│   ├── components/
│   │   ├── ActionBar.tsx        # 操作按钮（导出/复制/随机示例）
│   │   ├── ImageUploader.tsx    # 图片上传区（拖拽/点击/移动端）
│   │   ├── Loading.tsx          # 像素跳动加载动画
│   │   ├── PixelCanvas.tsx      # 像素画预览（缩放/拖动手势）
│   │   ├── PixelSlider.tsx      # 像素大小滑块
│   │   └── Toast.tsx            # Toast 提示组件
│   ├── utils/
│   │   ├── colorMap.ts          # DMC 色号表 + 最近邻颜色匹配
│   │   ├── pixelate.ts          # Canvas 像素化核心算法
│   │   └── export.ts            # PNG 导出 + JSON 数据复制
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 入口文件
│   └── index.css                # Tailwind v4 主题 + 全局样式
├── index.html                   # HTML 模板
├── vite.config.ts               # Vite 配置
├── vercel.json                  # Vercel 部署配置
└── package.json
```

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

## 技术栈

- **框架：** React 19 + TypeScript 6
- **构建：** Vite 8
- **样式：** Tailwind CSS 4
- **图像处理：** Canvas API（浏览器端，无后端依赖）
- **颜色匹配：** RGB 欧氏距离最近邻算法

## 浏览器支持

| 浏览器 | 版本 |
|--------|------|
| Chrome / Edge | 最近 2 个版本 |
| Firefox | 最近 2 个版本 |
| Safari | 15.4+ |
| 移动端 iOS Safari | 15.4+ |
| 移动端 Chrome | 最近 2 个版本 |

## License

MIT
