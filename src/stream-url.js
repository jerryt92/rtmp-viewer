const formats = { flv: '.flv', hls: '.m3u8' }

export function readPlayerParams(search) {
  const params = new URLSearchParams(search)
  const playback = params.get('playback')?.trim()
  const source = playback || params.get('srs')?.trim() || ''
  const streamPath = playback ? '' : params.get('stream')?.trim() || ''
  const format = params.get('format')?.trim().toLowerCase()

  return {
    source,
    streamPath,
    format: format || 'auto',
    autoplay: Boolean(source) && ['1', 'true'].includes(params.get('autoplay')),
    muted: !['0', 'false'].includes(params.get('muted')),
  }
}

export function writePlayerParams(search, { source, streamPath, format }) {
  const params = new URLSearchParams(search)
  const address = source.trim()
  const path = streamPath.trim()

  for (const name of ['playback', 'srs', 'stream', 'format']) {
    params.delete(name)
  }
  if (address) params.set(path ? 'srs' : 'playback', address)
  if (path) params.set('stream', path)
  if (format && format !== 'auto') params.set('format', format)

  return params.toString()
}

function parseUrl(value, message) {
  try {
    return new URL(value.trim())
  } catch {
    throw new Error(message)
  }
}

export function resolveStream({ source, streamPath = '', format, secure }) {
  const playback = parseUrl(source, '请输入完整的 HTTP 或 HTTPS 地址。')
  if (!['http:', 'https:'].includes(playback.protocol) || !playback.hostname) {
    throw new Error('只支持 HTTP 或 HTTPS 播放地址。')
  }
  const automatic = !format || format === 'auto'
  if (!automatic && !Object.hasOwn(formats, format)) {
    throw new Error('请选择 HTTP-FLV 或 HLS 播放协议。')
  }
  let playbackFormat = format

  if (streamPath.trim()) {
    const segments = streamPath.trim().replace(/^\//, '').split('/')
    if (segments.length < 2 || segments.some((part) => !part || part === '.' || part === '..')) {
      throw new Error('流路径须包含应用名和流名，例如 live/test。')
    }
    if (playback.search || playback.hash) {
      throw new Error('SRS 服务地址请去掉查询参数和片段。')
    }
    playbackFormat = automatic ? 'hls' : format
    const path = segments.map(encodeURIComponent).join('/')
    playback.pathname = playback.pathname.replace(/\/+$/, '') + '/' + path + formats[playbackFormat]
  } else if (automatic) {
    playbackFormat = Object.keys(formats).find(
      (key) => playback.pathname.toLowerCase().endsWith(formats[key]),
    )
    if (!playbackFormat) throw new Error('无法从地址识别协议，请选择 HTTP-FLV 或 HLS。')
  }

  if (playback.username || playback.password) {
    throw new Error('请使用不含用户名和密码的播放地址。')
  }
  if (secure && playback.protocol === 'http:') {
    throw new Error('HTTPS 页面请填写 HTTPS 播放地址。')
  }

  return { url: playback.href, format: playbackFormat }
}
