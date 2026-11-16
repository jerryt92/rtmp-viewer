<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { readPlayerParams, resolveStream } from './stream-url.js'

const initial = readPlayerParams(location.search)
const source = ref(initial.source)
const origin = ref(initial.origin)
const direct = ref(initial.direct)
const format = ref(initial.direct ? 'flv' : initial.format)
const directFormat = ref(initial.direct ? initial.format : 'auto')
const video = ref(null)
const active = ref(false)
const hasVideo = ref(false)
const status = ref('等待播放')
const error = ref('')
const playbackUrl = ref('')

let disposePlayer
let session = 0
let connectionTimer

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
      origin: origin.value.trim(),
      format: direct.value ? directFormat.value : format.value,
      direct: direct.value,
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
  element.muted = initial.muted

  const connectionError = '无法读取直播流，请确认已开始推流、播放服务可访问且允许跨域请求。'
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

function changeMode(useDirect) {
  if (direct.value === useDirect) return
  stop()
  source.value = ''
  direct.value = useDirect
  status.value = '等待播放'
}

onMounted(() => {
  if (initial.autoplay) play()
})
onBeforeUnmount(release)
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
        <div class="mode-switch" role="group" aria-label="地址类型">
          <button type="button" :aria-pressed="!direct" @click="changeMode(false)">RTMP 地址</button>
          <button type="button" :aria-pressed="direct" @click="changeMode(true)">播放地址</button>
        </div>

        <form @submit.prevent="play">
          <label for="stream-source">{{ direct ? 'HTTP 播放地址' : 'RTMP 推流地址' }}</label>
          <input
            id="stream-source"
            v-model="source"
            type="text"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            :placeholder="direct ? 'http://localhost:8080/live/camera1.m3u8' : 'rtmp://localhost:1935/live/camera1'"
            required
          />

          <label for="stream-format">播放协议</label>
          <select v-if="direct" id="stream-format" v-model="directFormat">
            <option value="auto">根据播放地址自动识别</option>
            <option value="flv">HTTP-FLV · 低延迟</option>
            <option value="hls">HLS · 兼容移动端</option>
          </select>
          <template v-else>
            <select id="stream-format" v-model="format">
              <option value="flv">HTTP-FLV · 低延迟</option>
              <option value="hls">HLS · 兼容移动端</option>
            </select>

            <label for="stream-origin">SRS 播放服务 <span class="optional">可选</span></label>
            <input
              id="stream-origin"
              v-model="origin"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="http://localhost:8080"
              aria-describedby="origin-help"
            />
            <small id="origin-help">留空时使用推流主机的 HTTP 8080 端口或 HTTPS 默认端口。</small>
          </template>

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
