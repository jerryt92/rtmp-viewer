const formats = { flv: '.flv', hls: '.m3u8' }

export function readPlayerParams(search) {
  const params = new URLSearchParams(search)
  const playback = params.get('playback')?.trim()
  const direct = Boolean(playback)
  const source = playback || params.get('rtmp')?.trim() || ''
  const format = params.get('format')?.trim().toLowerCase()

  return {
    source,
    direct,
    origin: params.get('origin')?.trim() || '',
    format: format || (direct ? 'auto' : 'flv'),
    autoplay: Boolean(source) && ['1', 'true'].includes(params.get('autoplay')),
    muted: !['0', 'false'].includes(params.get('muted')),
  }
}

function parseUrl(value, message) {
  try {
    return new URL(value.trim())
  } catch {
    throw new Error(message)
  }
}

export function resolveStream({ source, origin, format, direct, secure }) {
  const url = parseUrl(source, '请输入完整的流地址。')
  const automatic = direct && (!format || format === 'auto')
  if (!automatic && !Object.hasOwn(formats, format)) {
    throw new Error('请选择 HTTP-FLV 或 HLS 播放协议。')
  }
  let playback = url
  let playbackFormat = format

  if (automatic) {
    playbackFormat = Object.keys(formats).find(
      (key) => url.pathname.toLowerCase().endsWith(formats[key]),
    )
    if (!playbackFormat) throw new Error('无法从地址识别协议，请选择 HTTP-FLV 或 HLS。')
  } else if (!direct) {
    if (!['rtmp:', 'rtmps:'].includes(url.protocol) || !url.hostname) {
      throw new Error('请输入以 rtmp:// 或 rtmps:// 开头的推流地址。')
    }

    const path = url.pathname.slice(1).split('/')
    if (path.length < 2 || path.some((segment) => !segment)) {
      throw new Error('推流地址须包含应用名和流名，例如 /live/camera1。')
    }

    const defaultOrigin = secure
      ? `https://${url.hostname}`
      : `http://${url.hostname}:8080`
    playback = parseUrl(origin || defaultOrigin, '请输入完整的 SRS HTTP 播放服务地址。')
    if (playback.search || playback.hash) {
      throw new Error('SRS 播放服务地址不能包含查询参数或片段。')
    }
    playback.pathname = playback.pathname.replace(/\/+$/, '') + url.pathname + formats[format]
  }

  if (!['http:', 'https:'].includes(playback.protocol) || !playback.hostname) {
    throw new Error('播放服务须使用 HTTP 或 HTTPS。')
  }
  if (playback.username || playback.password) {
    throw new Error('请使用不含用户名和密码的播放地址。')
  }
  if (secure && playback.protocol === 'http:') {
    throw new Error('HTTPS 页面请填写 HTTPS 播放地址。')
  }

  return { url: playback.href, format: playbackFormat }
}
