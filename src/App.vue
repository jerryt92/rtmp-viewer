<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { readPlayerParams, resolveStream, writePlayerParams } from './stream-url.js'

const initial = readPlayerParams(location.search)
const source = ref(initial.source)
const streamPath = ref(initial.streamPath)
const format = ref(initial.format)
const video = ref(null)
const active = ref(false)
const hasVideo = ref(false)
const status = ref('等待播放')
const error = ref('')
const playbackUrl = ref('')

let disposePlayer
let session = 0
let connectionTimer

let restoringFromUrl = false
let muted = initial.muted

watch([source, streamPath, format], ([address, path, protocol]) => {
  if (restoringFromUrl) return
  const url = new URL(location.href)
  url.search = writePlayerParams(url.search, { source: address, streamPath: path, format: protocol })
  if (url.href !== location.href) history.replaceState(history.state, '', url.href)
}, { flush: 'sync' })

function restoreFromUrl() {
  const params = readPlayerParams(location.search)
  const sourceChanged = source.value !== params.source ||
    streamPath.value !== params.streamPath || format.value !== params.format

  restoringFromUrl = true
  source.value = params.source
  streamPath.value = params.streamPath
  format.value = params.format
  restoringFromUrl = false
  muted = params.muted

  if (params.autoplay) play()
  else if (sourceChanged) stop()
}

function clearConnectionTimer() {
  clearTimeout(connectionTimer)
}

function release() {
  session += 1
  clearConnectionTimer()
  active.value = false
  hasVideo.value = false
  disposePlayer?.()
  disposePlayer = undefined

  const element = video.value
  element.pause()
  element.removeAttribute('src')
  element.load()
}

function stop() {
  release()
  status.value = '已停止'
  error.value = ''
  playbackUrl.value = ''
}

function failed(message) {
  release()
  status.value = '播放失败'
  error.value = message
}

function mediaFailed() {
  if (active.value && video.value.error) {
    failed('浏览器无法解码或读取此视频，请检查播放地址及推流编码。')
  }
}

function playing() {
  if (!active.value) return
  clearConnectionTimer()
  hasVideo.value = true
  status.value = '正在播放'
}

async function play() {
  release()
  error.value = ''
  playbackUrl.value = ''

  let stream
  try {
    stream = resolveStream({
      source: source.value,
      streamPath: streamPath.value,
      format: format.value,
      secure: location.protocol === 'https:',
    })
  } catch (reason) {
    failed(reason.message)
    return
  }

  const element = video.value
  const current = session
  active.value = true
  status.value = '正在连接'
  playbackUrl.value = stream.url
  element.muted = muted

  const connectionError = stream.url.startsWith('https:')
    ? '无法读取直播流，请检查推流状态、跨域设置和浏览器是否信任服务证书。'
    : '无法读取直播流，请确认已开始推流、播放服务可访问且允许跨域请求。'
  connectionTimer = setTimeout(() => {
    if (current === session) failed('连接超时。' + connectionError)
  }, 25000)

  const reportError = () => {
    if (current === session) failed(connectionError)
  }

  const startMedia = async () => {
    if (current !== session) return
    try {
      await element.play()
    } catch (reason) {
      if (current !== session || reason.name === 'AbortError') return
      if (reason.name === 'NotAllowedError') {
        clearConnectionTimer()
        hasVideo.value = true
        status.value = '请点击视频中的播放按钮'
        return
      }
      reportError()
    }
  }

  try {
    if (stream.format === 'flv') {
      const { default: mpegts } = await import('mpegts.js')
      if (current !== session) return
      if (!mpegts.getFeatureList().mseLivePlayback) {
        throw new Error('此浏览器不支持 HTTP-FLV 直播，请切换 HLS。')
      }

      const player = mpegts.createPlayer(
        { type: 'flv', isLive: true, url: stream.url },
        { enableStashBuffer: false, liveBufferLatencyChasing: true },
      )
      disposePlayer = () => player.destroy()
      player.on(mpegts.Events.ERROR, reportError)
      player.attachMediaElement(element)
      player.load()
      await startMedia()
      return
    }

    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = stream.url
      await startMedia()
      return
    }

    const { default: Hls } = await import('hls.js/light')
    if (current !== session) return
    if (!Hls.isSupported()) throw new Error('此浏览器不支持 HLS 播放。')

    const player = new Hls()
    disposePlayer = () => player.destroy()
    player.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) reportError()
    })
    player.on(Hls.Events.MANIFEST_PARSED, startMedia)
    player.attachMedia(element)
    player.loadSource(stream.url)
  } catch (reason) {
    if (current === session) failed(reason.message || connectionError)
  }
}

onMounted(() => {
  window.addEventListener('popstate', restoreFromUrl)
  if (initial.autoplay) play()
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', restoreFromUrl)
  release()
})
</script>

<template>
  <main class="shell">
    <header class="page-header">
      <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>RTMP 直播播放器</h1>
    </header>

    <div class="workspace">
      <section class="player-panel" aria-label="视频播放器">
        <div class="panel-header">
          <h2>直播画面</h2>
          <span class="status" :class="{ online: status === '正在播放' }" role="status">
            {{ status }}
          </span>
        </div>

        <div class="stage">
          <video
            ref="video"
            playsinline
            :controls="hasVideo"
            @playing="playing"
            @waiting="hasVideo && active && (status = '正在缓冲')"
            @pause="hasVideo && active && (status = '已暂停')"
            @ended="active && stop()"
            @error="mediaFailed"
          ></video>
          <div v-if="!hasVideo" class="placeholder">
            <div class="play-mark" aria-hidden="true"></div>
            <p>{{ status === '正在连接' ? '正在连接直播流…' : '暂无画面' }}</p>
          </div>
        </div>

        <div class="player-footer">
          <span>播放地址</span>
          <code>{{ playbackUrl || '—' }}</code>
        </div>
      </section>

      <section class="settings-panel" aria-labelledby="settings-heading">
        <h2 id="settings-heading">直播源</h2>
        <form @submit.prevent="play">
          <label for="stream-source">SRS 服务或完整播放地址</label>
          <input
            id="stream-source"
            v-model="source"
            type="text"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://srs.example.com"
            required
          />

          <label for="stream-path">SRS 流路径（填写完整播放地址时留空）</label>
          <input
            id="stream-path"
            v-model="streamPath"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="live/test"
          />

          <label for="stream-format">播放协议</label>
          <select id="stream-format" v-model="format">
            <option value="auto">自动（SRS 默认 HLS）</option>
            <option value="flv">HTTP-FLV · 低延迟</option>
            <option value="hls">HLS · 兼容移动端</option>
          </select>
          <div class="actions">
            <button class="primary" type="submit">{{ active ? '重新连接' : '开始播放' }}</button>
            <button class="secondary" type="button" :disabled="!active" @click="stop">停止</button>
          </div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </form>
      </section>
    </div>
  </main>
</template>
