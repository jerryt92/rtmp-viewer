# RTMP 直播播放器

Vue 3 静态网页。使用完整的 HTTP(S) 地址播放 HTTP-FLV 或 HLS 直播。

## 启动

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

打开终端显示的开发地址。运行 `npm run build` 生成可部署的 `dist/`，运行 `npm run preview` 可本地预览构建结果。

## 使用现有 SRS

1. 确保 SRS 已启用 HTTP-FLV 或 HLS 输出，且浏览器能访问服务端的 HTTP 播放端口。
2. 填入 SRS 服务地址，例如 `https://srs.example.com`，再填不带文件后缀的流路径 `live/test`。默认生成 HLS 地址，也可改选 HTTP-FLV。
3. 如果手上已有完整播放地址，直接填写并将流路径留空。地址没有 `.flv` 或 `.m3u8` 后缀时，手动选择协议。

跨域播放时，流媒体服务需要允许播放器所在的 Origin。HTTPS 页面使用浏览器信任的 HTTPS 播放地址。自签名证书需要在播放设备上设为受信任。若使用 HTTP 打开播放器，也可填 SRS 的 HTTP 服务地址，例如本机部署时的 `http://localhost:11934`。需要鉴权时，填写完整签名播放地址。

## 用页面 URL 配置播放

打开链接时，页面会根据查询参数预填表单。编辑地址、流路径或协议会更新当前 URL，不会刷新页面或自动开始播放。复制前请确认链接中是否包含播放签名。

| 参数 | 用途 |
| --- | --- |
| `playback` | 完整 HTTP(S) 播放地址，支持自定义路径和签名参数。 |
| `srs` | SRS 的 HTTP(S) 服务地址，可包含反向代理路径前缀。 |
| `stream` | SRS 流路径，例如 `live/test`。传入 `playback` 时优先使用完整地址。 |
| `format` | `flv`、`hls` 或 `auto`。SRS 默认使用 HLS，完整地址默认按后缀识别。 |
| `autoplay` | 传 `1` 或 `true` 时打开页面立即尝试播放，默认只预填参数。 |
| `muted` | 默认静音。传 `0` 或 `false` 时尝试有声播放，若被浏览器拦截，可点击视频的播放按钮。 |

用 `URLSearchParams` 编码参数值，尤其是带 `?`、`&` 或 `#` 的流地址。

```js
const params = new URLSearchParams({
  srs: 'https://srs.example.com',
  stream: 'live/test',
  autoplay: '1',
})
const playerUrl = `http://localhost:5173/?${params}`
```

自定义播放端点可用 `?playback=https%3A%2F%2Fmedia.example.com%2Fwatch%3Fid%3Dtest&format=hls&autoplay=1`。
