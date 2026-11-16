# RTMP 直播播放器

Vue 3 静态网页。页面根据 RTMP 推流地址和 SRS 的路径规则生成 HTTP-FLV 或 HLS 播放地址。

## 启动

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

打开终端显示的开发地址。运行 `npm run build` 生成可部署的 `dist/`，运行 `npm run preview` 可本地预览构建结果。

## 使用现有 SRS

1. 确保 SRS 开启 HTTP 播放及所选的 HTTP-FLV 封装或 HLS 输出。通过 Docker 运行时，将容器 TCP 8080 映射到浏览器可访问的端口，例如 `8080:8080`。
2. OBS 可使用服务器 `rtmp://localhost:1935/live` 和流密钥 `camera1`。OBS 与 SRS 分开运行时，用真实的 SRS 主机名或 IP 替换 `localhost`。
3. 在页面输入 `rtmp://localhost:1935/live/camera1`，选择协议并点击开始播放。默认生成 `http://localhost:8080/live/camera1.flv` 或 `http://localhost:8080/live/camera1.m3u8`。
4. 如果 SRS 的播放端口、主机名或反代路径不同，填写「SRS 播放服务」。对于第三方服务，使用「播放地址」输入服务提供的完整 HTTP 或 HTTPS 地址。地址没有 `.flv` 或 `.m3u8` 后缀时，手动选择播放协议。

跨域播放时，流媒体服务需要允许播放器所在的 Origin。HTTPS 页面使用 HTTPS 播放地址。推流地址里的查询参数不会转发给播放服务。需要播放鉴权时，直接填写服务提供的带签名播放地址。

## 用页面 URL 配置播放

| 参数 | 用途 |
| --- | --- |
| `rtmp` | 完整 RTMP 或 RTMPS 推流地址，包含应用名和流名。 |
| `origin` | RTMP 模式下的 HTTP(S) 播放服务地址，可自定义主机、端口和路径前缀。 |
| `playback` | 完整 HTTP(S) 播放地址，支持自定义路径和签名参数。与 `rtmp` 同时传入时优先使用。 |
| `format` | `flv` 或 `hls`。RTMP 模式默认 `flv`。直接播放模式默认按后缀识别，也可显式传 `auto`。 |
| `autoplay` | 传 `1` 或 `true` 时打开页面立即尝试播放，默认只预填参数。 |
| `muted` | 默认静音。传 `0` 或 `false` 时尝试有声播放，若被浏览器拦截，可点击视频的播放按钮。 |

用 `URLSearchParams` 编码参数值，尤其是带 `?`、`&` 或 `#` 的流地址。

```js
const params = new URLSearchParams({
  rtmp: 'rtmp://server.jerryt92.top:1935/live/test',
  origin: 'http://server.jerryt92.top:8080',
  format: 'hls',
  autoplay: '1',
})
const playerUrl = `http://localhost:5173/?${params}`
```

自定义播放端点可用 `?playback=https%3A%2F%2Fmedia.example.com%2Fwatch%3Fid%3Dtest&format=hls&autoplay=1`。
